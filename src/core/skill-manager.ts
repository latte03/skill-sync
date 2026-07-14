/**
 * SkillManager — Skill 管理核心模块
 *
 * 参考 PRD §4.4 核心架构设计 + §5.3 数据建模
 *
 * 职责：
 * - Skill 的增删改查（中央仓库层面）
 * - manifest.yaml 读写
 * - skills-lock.json 同步
 * - 分发/取消分发到 Agent 目录
 * - 版本检查与更新
 *
 * 所有操作接收 SkillSyncContext，不直接访问全局状态。
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { readManifest, writeManifest, manifestExists, createManifestFromFrontmatter } from '../lib/manifest.js';
import { readLock, writeLock, getLockEntry, setLockEntry, removeLockEntry, getAllLockSkillNames } from '../lib/lock.js';
import { parseFrontmatter, extractVersion } from '../lib/frontmatter.js';
import { sanitizeMetadata, sanitizeName } from '../lib/sanitize.js';
import { getAgentSkillDir, getAgents } from '../lib/agents.js';
import { skillRepoPath, skillMdPath, backupDirPath } from '../lib/paths.js';
import { LOCKFILE_VERSION, CLI_VERSION } from '../lib/constants.js';
import type {
  SkillSyncContext,
} from './context.js';
import type {
  Manifest,
  LockFile,
  LockEntry,
  SkillInfo,
  ScannedSkill,
  DeployMode,
  UserDeployMode,
  SkillSource,
  InstallResult,
  ImportResult,
  DistributionTarget,
} from '../lib/types.js';

// ==================== 平台检测 ====================

/**
 * 解析最终的部署模式
 *
 * Windows 下 symlink 自动降级为 junction（PRD §8.2 平台兼容性）
 */
export function resolveDeployMode(userMode: UserDeployMode | undefined): DeployMode {
  const isWindows = process.platform === 'win32';
  if (userMode === 'copy') return 'copy';
  // symlink on Windows → junction
  if (isWindows) return 'junction';
  return 'symlink';
}

// ==================== 文件链接 ====================

/**
 * 创建文件链接（symlink / junction / copy）
 */
export function createLink(src: string, dest: string, mode: DeployMode): void {
  // 确保目标父目录存在
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // 如果目标已存在，先删除
  // 注意：existsSync 对 broken symlink 返回 false，需要 try-catch lstatSync
  let destExists = false;
  try {
    fs.lstatSync(dest);
    destExists = true;
  } catch {
    // 目标不存在，无需删除
  }
  if (destExists) {
    removeLink(dest);
  }

  switch (mode) {
    case 'symlink':
      fs.symlinkSync(src, dest, 'dir');
      break;
    case 'junction':
      // Windows junction via fs.symlinkSync with 'junction' type
      fs.symlinkSync(src, dest, 'junction');
      break;
    case 'copy':
      copyDirRecursive(src, dest);
      break;
  }
}

/**
 * 删除文件链接（symlink/junction 直接 unlink，copy 递归删除）
 */
export function removeLink(dest: string): void {
  const lstat = fs.lstatSync(dest);
  if (lstat.isSymbolicLink()) {
    fs.unlinkSync(dest);
  } else if (lstat.isDirectory()) {
    fs.rmSync(dest, { recursive: true, force: true });
  } else {
    fs.unlinkSync(dest);
  }
}

/**
 * 递归复制目录
 */
function copyDirRecursive(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ==================== 哈希计算 ====================

/**
 * 计算 skill 目录的 source_hash（SHA256）
 *
 * 基于所有文件内容（排除 .backup 目录）计算
 */
export function computeSourceHash(dir: string): string {
  const hash = crypto.createHash('sha256');
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const sortedNames = entries
    .filter(e => e.name !== '.backup')
    .map(e => e.name)
    .sort();

  for (const name of sortedNames) {
    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      hash.update(name + '/');
      hash.update(computeSourceHash(fullPath));
    } else {
      hash.update(name);
      const content = fs.readFileSync(fullPath);
      hash.update(content);
    }
  }
  return hash.digest('hex');
}

// ==================== Skill 查询 ====================

/**
 * 列出所有已管理的 skill
 */
export function listSkills(ctx: SkillSyncContext): SkillInfo[] {
  const lock = readLock();
  const skills: SkillInfo[] = [];

  for (const [fullName, entry] of Object.entries(lock.skills)) {
    const [namespace, skillName] = fullName.split('/');
    if (!namespace || !skillName) continue;

    let manifest: Manifest | null = null;
    try {
      manifest = readManifest(namespace, skillName);
    } catch {
      // manifest 可能不存在（损坏状态）
    }

    skills.push({
      name: fullName,
      namespace,
      skillName,
      version: entry.version,
      description: manifest?.description ?? '',
      tags: manifest?.tags ?? [],
      deployMode: manifest?.distribution.mode ?? 'symlink',
      agents: Object.keys(entry.distribution),
      managed: true,
    });
  }

  return skills;
}

/**
 * 获取 skill 详情
 */
export function getSkillDetail(ctx: SkillSyncContext, name: string): SkillInfo | null {
  const entry = getLockEntry(name);
  if (!entry) return null;

  const [namespace, skillName] = name.split('/');
  if (!namespace || !skillName) return null;

  let manifest: Manifest | null = null;
  try {
    manifest = readManifest(namespace, skillName);
  } catch {
    // ignore
  }

  return {
    name,
    namespace,
    skillName,
    version: entry.version,
    description: manifest?.description ?? '',
    tags: manifest?.tags ?? [],
    deployMode: manifest?.distribution.mode ?? 'symlink',
    agents: Object.keys(entry.distribution),
    managed: true,
  };
}

// ==================== 分发 ====================

/**
 * 分发 skill 到 Agent 目录
 */
export function deploySkill(
  ctx: SkillSyncContext,
  name: string,
  agentName: string,
  opts?: { mode?: UserDeployMode; force?: boolean },
): void {
  const entry = getLockEntry(name);
  if (!entry) {
    throw new Error(`Skill 未找到: ${name}`);
  }

  const [namespace, skillName] = name.split('/');
  if (!namespace || !skillName) {
    throw new Error(`无效的 skill 名称: ${name}`);
  }

  const manifest = readManifest(namespace, skillName);
  const repoPath = skillRepoPath(namespace, skillName);
  const agentSkillDir = getAgentSkillDir(agentName);
  const destPath = path.join(agentSkillDir, skillName);

  // 检查目标是否已存在（使用 try-catch 处理 broken symlink）
  let destExists = false;
  let destLstat: fs.Stats | null = null;
  try {
    destLstat = fs.lstatSync(destPath);
    destExists = true;
  } catch {
    destExists = false;
  }

  if (destExists && destLstat) {
    if (!opts?.force) {
      if (destLstat.isSymbolicLink()) {
        // 已是 symlink，检查是否指向同一源
        const target = fs.readlinkSync(destPath);
        if (path.resolve(target) === path.resolve(repoPath)) {
          ctx.logger.debug(`  ${agentName}: 已分发（symlink 指向同一源），跳过`);
          return;
        }
      }
      throw new Error(`目标已存在: ${destPath}（使用 --force 覆盖）`);
    }
  }

  const deployMode = resolveDeployMode(opts?.mode ?? ctx.config.distributionMode);
  ctx.logger.debug(`  分发到 ${agentName}: ${destPath} (${deployMode})`);

  if (ctx.dryRun) {
    ctx.logger.info(`[dry-run] 将分发 ${name} → ${agentName} (${deployMode})`);
    return;
  }

  createLink(repoPath, destPath, deployMode);

  // 更新 manifest
  const sourceHash = computeSourceHash(repoPath);
  const distTarget: DistributionTarget = {
    agent: agentName,
    path: destPath,
    mode: deployMode,
    version: entry.version,
    distributedAt: new Date().toISOString(),
    sourceHash,
    managed: true,
  };

  // 替换或添加 target
  const existingIdx = manifest.distribution.targets.findIndex(t => t.agent === agentName);
  if (existingIdx >= 0) {
    manifest.distribution.targets[existingIdx] = distTarget;
  } else {
    manifest.distribution.targets.push(distTarget);
  }
  manifest.distribution.mode = deployMode;
  writeManifest(namespace, skillName, manifest);

  // 更新 lock
  entry.distribution[agentName] = {
    mode: deployMode,
    distributedAt: distTarget.distributedAt,
    sourceHash,
    managed: true,
  };
  setLockEntry(name, entry);
}

/**
 * 取消分发（从 Agent 目录移除）
 */
export function undeploySkill(
  ctx: SkillSyncContext,
  name: string,
  agentName: string,
): void {
  const entry = getLockEntry(name);
  if (!entry) {
    throw new Error(`Skill 未找到: ${name}`);
  }

  const [namespace, skillName] = name.split('/');
  const agentSkillDir = getAgentSkillDir(agentName);
  const destPath = path.join(agentSkillDir, skillName);

  if (!fs.existsSync(destPath) && !fs.lstatSync(destPath).isSymbolicLink()) {
    ctx.logger.debug(`  ${agentName}: 目标不存在，跳过`);
    return;
  }

  if (ctx.dryRun) {
    ctx.logger.info(`[dry-run] 将取消分发 ${name} ← ${agentName}`);
    return;
  }

  removeLink(destPath);

  // 更新 manifest
  const manifest = readManifest(namespace, skillName);
  manifest.distribution.targets = manifest.distribution.targets.filter(t => t.agent !== agentName);
  writeManifest(namespace, skillName, manifest);

  // 更新 lock
  delete entry.distribution[agentName];
  setLockEntry(name, entry);
}

// ==================== 导入散落 skill ====================

/**
 * 将散落 skill 导入到中央仓库
 *
 * 1. 复制 skill 文件到 skills/<namespace>/<skillName>/
 * 2. 生成 manifest.yaml
 * 3. 更新 skills-lock.json
 * 4. 可选：替换原位置为 symlink
 */
export function importSkill(
  ctx: SkillSyncContext,
  scanned: ScannedSkill,
  namespace: string,
  opts?: { replaceWithLink?: boolean; mode?: UserDeployMode },
): ImportResult {
  const skillName = sanitizeName(scanned.name);
  const repoPath = skillRepoPath(namespace, skillName);

  ctx.logger.debug(`  导入 ${skillName} → ${repoPath}`);

  if (ctx.dryRun) {
    ctx.logger.info(`[dry-run] 将导入 ${scanned.name} → ${namespace}/${skillName}`);
    return {
      name: `${namespace}/${skillName}`,
      namespace,
      version: '0.0.0',
      deployed: [],
    };
  }

  // 1. 复制文件到中央仓库
  copyDirRecursive(scanned.dir, repoPath);

  // 2. 读取 SKILL.md frontmatter
  let frontmatterData: Record<string, unknown> = {};
  if (fs.existsSync(scanned.skillMdPath)) {
    const raw = fs.readFileSync(scanned.skillMdPath, 'utf-8');
    frontmatterData = parseFrontmatter(raw).data;
  }

  // 3. 生成 manifest.yaml
  const source: SkillSource = {
    type: 'local',
    installedVia: 'init-scan',
  };
  const manifest = createManifestFromFrontmatter(frontmatterData, namespace, skillName, source);
  const version = extractVersion(frontmatterData) ?? '0.0.0';
  manifest.currentVersion = version;
  manifest.initialVersion = version;
  writeManifest(namespace, skillName, manifest);

  // 4. 更新 skills-lock.json
  const fullName = `${namespace}/${skillName}`;
  const lockEntry: LockEntry = {
    source: {
      type: 'local',
    },
    version,
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    distribution: {},
  };
  setLockEntry(fullName, lockEntry);

  // 5. 可选：替换原位置为 symlink
  const deployed: string[] = [];
  if (opts?.replaceWithLink) {
    const deployMode = resolveDeployMode(opts.mode ?? ctx.config.distributionMode);
    removeLink(scanned.dir);
    createLink(repoPath, scanned.dir, deployMode);

    // 更新 manifest 和 lock
    const sourceHash = computeSourceHash(repoPath);
    manifest.distribution.targets.push({
      agent: scanned.agentName,
      path: scanned.dir,
      mode: deployMode,
      version,
      distributedAt: new Date().toISOString(),
      sourceHash,
      managed: true,
    });
    manifest.distribution.mode = deployMode;
    writeManifest(namespace, skillName, manifest);

    lockEntry.distribution[scanned.agentName] = {
      mode: deployMode,
      distributedAt: new Date().toISOString(),
      sourceHash,
      managed: true,
    };
    setLockEntry(fullName, lockEntry);
    deployed.push(scanned.agentName);
  }

  return {
    name: fullName,
    namespace,
    version,
    deployed,
  };
}

// ==================== 删除 ====================

/**
 * 从中央仓库删除 skill
 *
 * 1. 取消所有分发
 * 2. 删除 manifest.yaml
 * 3. 删除 skill 目录
 * 4. 从 skills-lock.json 移除
 */
export function removeSkill(
  ctx: SkillSyncContext,
  name: string,
  scope: 'all' | 'central' | 'agent' = 'all',
  agentName?: string,
): void {
  const entry = getLockEntry(name);
  if (!entry) {
    throw new Error(`Skill 未找到: ${name}`);
  }

  const [namespace, skillName] = name.split('/');

  if (scope === 'agent' && agentName) {
    // 仅从指定 Agent 取消分发
    undeploySkill(ctx, name, agentName);
    return;
  }

  if (scope === 'central' || scope === 'all') {
    // 取消所有分发
    for (const agent of Object.keys(entry.distribution)) {
      try {
        undeploySkill(ctx, name, agent);
      } catch (e) {
        ctx.logger.warn(`  取消分发到 ${agent} 失败: ${(e as Error).message}`);
      }
    }

    if (scope === 'all') {
      // 删除 manifest
      // 删除 skill 目录
      const repoPath = skillRepoPath(namespace, skillName);
      if (fs.existsSync(repoPath)) {
        fs.rmSync(repoPath, { recursive: true, force: true });
      }

      // 从 lock 移除
      removeLockEntry(name);
    }
  }
}

// ==================== 备份 ====================

/**
 * 创建 skill 备份
 */
export function createBackup(
  ctx: SkillSyncContext,
  name: string,
): string {
  const entry = getLockEntry(name);
  if (!entry) {
    throw new Error(`Skill 未找到: ${name}`);
  }

  const [namespace, skillName] = name.split('/');
  const repoPath = skillRepoPath(namespace, skillName);
  const backupDir = backupDirPath(namespace, skillName);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `${entry.version}_${timestamp}`);
  copyDirRecursive(repoPath, backupPath);

  // 更新 manifest
  const manifest = readManifest(namespace, skillName);
  manifest.lastBackup = {
    timestamp: new Date().toISOString(),
    fromVersion: entry.version,
    backupDir: backupPath,
  };
  writeManifest(namespace, skillName, manifest);

  ctx.logger.debug(`  备份创建: ${backupPath}`);
  return backupPath;
}

/**
 * 列出所有 skill 的备份
 */
export function listBackups(name: string): Array<{ version: string; timestamp: string; dir: string }> {
  const [namespace, skillName] = name.split('/');
  const backupDir = backupDirPath(namespace, skillName);

  if (!fs.existsSync(backupDir)) return [];

  return fs.readdirSync(backupDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => {
      const [version, ...tsParts] = e.name.split('_');
      return {
        version: version ?? 'unknown',
        timestamp: tsParts.join('_'),
        dir: path.join(backupDir, e.name),
      };
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
