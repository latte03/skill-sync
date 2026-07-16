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
import { readManifest, writeManifest, manifestExists, createManifestFromFrontmatter } from '../lib/manifest.js';
import { readLock, writeLock, getLockEntry, setLockEntry, updateLockEntry, removeLockEntry, getAllLockSkillNames } from '../lib/lock.js';
import { parseFrontmatter, extractVersion, hasXmlBrackets } from '../lib/frontmatter.js';
import { sanitizeMetadata, sanitizeName, isPathSafe } from '../lib/sanitize.js';
import { getAgentSkillDir, getAgents } from '../lib/agents.js';
import { skillRepoPath, skillMdPath, backupDirPath, skillsDirPath, homePath } from '../lib/paths.js';
import { DEFAULT_MAX_BACKUPS, LOCKFILE_VERSION, BACKUP_DIR } from '../lib/constants.js';
import { copyDirRecursive } from '../lib/fs-utils.js';
import { withFileTransaction } from '../lib/persistence.js';
import {
  computeSourceHash,
  createLink,
  removeLink,
  resolveDeployMode,
} from './distribution-files.js';
import {
  assertDistributionStateUnlocked,
  beginRemovalJournal,
  recoverInterruptedRemoval,
  replaceDestination,
} from './distribution-transaction.js';
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

export { computeSourceHash, createLink, removeLink, resolveDeployMode } from './distribution-files.js';

// ==================== Manifest 路径解析 ====================

/**
 * 尝试读取 manifest
 *
 * @returns manifest（可能为 null）
 */
function tryReadManifest(name: string): { manifest: Manifest | null } {
  try {
    const manifest = readManifest(name);
    return { manifest };
  } catch {
    return { manifest: null };
  }
}

// ==================== Skill 查询 ====================

/**
 * 列出所有已管理的 skill
 */
export function listSkills(ctx: SkillSyncContext): SkillInfo[] {
  const lock = readLock();
  const skills: SkillInfo[] = [];

  for (const [fullName, entry] of Object.entries(lock.skills)) {
    const { manifest } = tryReadManifest(fullName);

    skills.push({
      name: fullName,
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

  const { manifest } = tryReadManifest(name);

  return {
    name,
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
  opts?: { mode?: UserDeployMode; force?: boolean; stateLockHeld?: boolean },
): void {
  deploySkills(ctx, name, [agentName], opts);
}

/**
 * Deploy a skill to several Agents as one all-or-nothing state transition.
 *
 * Every destination is validated before the first replacement. Replaced
 * directories are held aside until the common manifest and lock update has
 * committed, so a later failure restores every earlier destination.
 */
export function deploySkills(
  ctx: SkillSyncContext,
  name: string,
  agentNames: string[],
  opts?: { mode?: UserDeployMode; force?: boolean; stateLockHeld?: boolean },
): void {
  if (!opts?.stateLockHeld) {
    return withFileTransaction(homePath('.state'), () =>
      deploySkills(ctx, name, agentNames, { ...opts, stateLockHeld: true }),
    );
  }

  const entry = getLockEntry(name);
  if (!entry) {
    throw new Error(`Skill 未找到: ${name}`);
  }

  // 读取 manifest
  const resolved = tryReadManifest(name);
  if (!resolved.manifest) {
    throw new Error(`无法读取 skill 的 manifest: ${name}`);
  }
  const manifest = resolved.manifest;
  const originalManifest = structuredClone(manifest);
  const originalLockEntry = structuredClone(entry);
  const repoPath = skillRepoPath(name);
  const skillName = manifest.name;
  const deployMode = resolveDeployMode(opts?.mode ?? ctx.config.distributionMode);
  const sourceHash = computeSourceHash(repoPath);
  const plans: Array<{ agentName: string; destPath: string; distTarget: DistributionTarget }> = [];

  for (const agentName of uniqueAgentNames(agentNames)) {
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
          const targetPath = path.resolve(path.dirname(destPath), target);
          if (targetPath === path.resolve(repoPath)) {
            ctx.logger.debug(`  ${agentName}: 已分发（symlink 指向同一源），跳过`);
            continue;
          }
        } else {
          const previous = entry.distribution[agentName];
          if (previous?.managed && previous.mode === 'copy') {
            const currentHash = computeSourceHash(destPath);
            if (currentHash !== previous.sourceHash) {
              throw new Error(`目标已被手动修改: ${destPath}（使用 --force 覆盖）`);
            }
          } else {
            throw new Error(`目标已存在: ${destPath}（使用 --force 覆盖）`);
          }
        }
        if (destLstat.isSymbolicLink()) {
          throw new Error(`目标已存在且指向其他来源: ${destPath}（使用 --force 覆盖）`);
        }
      }
    }

    plans.push({
      agentName,
      destPath,
      distTarget: {
        agent: agentName,
        path: destPath,
        mode: deployMode,
        version: entry.version,
        distributedAt: new Date().toISOString(),
        sourceHash,
        managed: true,
      },
    });
  }

  if (ctx.dryRun) {
    for (const plan of plans) {
      ctx.logger.info(`[dry-run] 将分发 ${name} → ${plan.agentName} (${deployMode})`);
    }
    return;
  }

  if (plans.length === 0) return;

  const nextManifest = structuredClone(manifest);
  for (const plan of plans) {
    const existingIdx = nextManifest.distribution.targets.findIndex(target => target.agent === plan.agentName);
    if (existingIdx >= 0) {
      nextManifest.distribution.targets[existingIdx] = plan.distTarget;
    } else {
      nextManifest.distribution.targets.push(plan.distTarget);
    }
  }
  nextManifest.distribution.mode = deployMode;

  assertDistributionStateUnlocked(name);
  const destinations: ReturnType<typeof replaceDestination>[] = [];
  let lockUpdated = false;
  try {
    for (const plan of plans) {
      ctx.logger.debug(`  分发到 ${plan.agentName}: ${plan.destPath} (${deployMode})`);
      destinations.push(replaceDestination(plan.destPath, () => createLink(repoPath, plan.destPath, deployMode)));
    }
    writeManifest(name, nextManifest);
    updateLockEntry(name, latest => {
      for (const plan of plans) {
        latest.distribution[plan.agentName] = {
          mode: deployMode,
          distributedAt: plan.distTarget.distributedAt,
          sourceHash,
          managed: true,
        };
      }
    });
    lockUpdated = true;
    for (const destination of destinations) destination.commit();
  } catch (error) {
    try {
      writeManifest(name, originalManifest);
      if (lockUpdated) setLockEntry(name, originalLockEntry);
      for (const destination of destinations.reverse()) destination.rollback();
    } catch {
      // Preserve the original state-write error; the state lock prevents
      // another skill-sync operation from racing this best-effort recovery.
    }
    throw error;
  }
}

/**
 * 取消分发（保留副本，标记 managed = false）
 *
 * 参考 PRD §10.5 + docs/design-distribution.md §10.5：
 * - symlink/junction: 解除链接 → 复制中央仓库内容到 Agent 目录
 * - copy: 保持不变（已是副本）
 * - 更新 manifest 和 lock 中的 managed = false（不删除 distribution 条目）
 * - 此后该 Agent 下的 skill 副本不会被 update 更新（D-18）
 */
export function undeploySkill(
  ctx: SkillSyncContext,
  name: string,
  agentName: string,
): void {
  undeploySkills(ctx, name, [agentName]);
}

/** Convert multiple managed links into retained copies as one transaction. */
export function undeploySkills(
  ctx: SkillSyncContext,
  name: string,
  agentNames: string[],
): void {
  return withFileTransaction(homePath('.state'), () =>
    undeploySkillsWithStateLock(ctx, name, agentNames),
  );
}

function undeploySkillsWithStateLock(
  ctx: SkillSyncContext,
  name: string,
  agentNames: string[],
): void {
  const entry = getLockEntry(name);
  if (!entry) {
    throw new Error(`Skill 未找到: ${name}`);
  }

  // 使用 tryReadManifest 获取 manifest
  const resolved = tryReadManifest(name);
  if (!resolved.manifest) {
    throw new Error(`无法读取 skill 的 manifest: ${name}`);
  }
  const manifest = resolved.manifest;
  const originalManifest = structuredClone(manifest);
  const originalLockEntry = structuredClone(entry);
  const repoPath = skillRepoPath(name);
  const skillName = manifest.name;
  const plans: Array<{ agentName: string; destPath: string; replaceLink: boolean; currentMode?: DeployMode }> = [];

  for (const agentName of uniqueAgentNames(agentNames)) {
    const destPath = path.join(getAgentSkillDir(agentName), skillName);
    // lstatSync does not follow a broken link, so it still identifies a
    // managed destination that exists only as a dangling symlink.
    let destLstat: fs.Stats;
    try {
      destLstat = fs.lstatSync(destPath);
    } catch {
      ctx.logger.debug(`  ${agentName}: 目标不存在，跳过`);
      continue;
    }
    plans.push({
      agentName,
      destPath,
      replaceLink: destLstat.isSymbolicLink(),
      currentMode: entry.distribution[agentName]?.mode,
    });
  }

  if (ctx.dryRun) {
    for (const plan of plans) {
      ctx.logger.info(`[dry-run] 将取消分发 ${name} ← ${plan.agentName}（保留副本）`);
    }
    return;
  }

  if (plans.length === 0) return;

  const nextManifest = structuredClone(manifest);
  for (const plan of plans) {
    const targetIdx = nextManifest.distribution.targets.findIndex(target => target.agent === plan.agentName);
    if (targetIdx >= 0) nextManifest.distribution.targets[targetIdx]!.managed = false;
  }
  assertDistributionStateUnlocked(name);
  const destinations: Array<{ plan: typeof plans[number]; transition: ReturnType<typeof replaceDestination> }> = [];
  let lockUpdated = false;
  try {
    for (const plan of plans) {
      if (plan.replaceLink) {
        destinations.push({
          plan,
          transition: replaceDestination(plan.destPath, () => copyDirRecursive(repoPath, plan.destPath, ['.backup'])),
        });
      }
    }
    writeManifest(name, nextManifest);
    updateLockEntry(name, latest => {
      for (const plan of plans) {
        const latestInfo = latest.distribution[plan.agentName];
        if (latestInfo) {
          latest.distribution[plan.agentName] = { ...latestInfo, managed: false };
        } else {
          latest.distribution[plan.agentName] = {
            mode: 'copy',
            distributedAt: new Date().toISOString(),
            sourceHash: computeSourceHash(repoPath),
            managed: false,
          };
        }
      }
    });
    lockUpdated = true;
    for (const { transition } of destinations) transition.commit();
    for (const plan of plans) {
      if (plan.replaceLink) ctx.logger.debug(`  ${plan.agentName}: 解除链接并复制副本到 ${plan.destPath}`);
      else ctx.logger.debug(`  ${plan.agentName}: 保留现有副本或手动目录（记录模式: ${plan.currentMode ?? 'unknown'}）`);
    }
  } catch (error) {
    try {
      writeManifest(name, originalManifest);
      if (lockUpdated) setLockEntry(name, originalLockEntry);
      for (const { transition } of destinations.reverse()) transition.rollback();
    } catch {
      // Preserve the original state-write error.
    }
    throw error;
  }
}

function uniqueAgentNames(agentNames: string[]): string[] {
  return [...new Set(agentNames)];
}

// ==================== 导入散落 skill ====================

/**
 * 将散落 skill 导入到中央仓库
 *
 * 1. 复制 skill 文件到 skills/<skillName>/
 * 2. 生成 manifest.yaml
 * 3. 更新 skills-lock.json
 * 4. 可选：替换原位置为 symlink
 */
export function importSkill(
  ctx: SkillSyncContext,
  scanned: ScannedSkill,
  opts?: { replaceWithLink?: boolean; mode?: UserDeployMode },
): ImportResult {
  // 优先使用 relativePath 保持目录结构，如 write-a-skill/engineering/tdd
  const skillName = scanned.relativePath
    ? sanitizeName(scanned.relativePath)
    : sanitizeName(scanned.name);
  const repoPath = skillRepoPath(skillName);

  if (!isPathSafe(repoPath, skillsDirPath())) {
    throw new Error(`SkillKey 对应的存储路径不安全: ${repoPath}`);
  }
  if (pathsOverlap(scanned.dir, repoPath)) {
    throw new Error(`拒绝将 skill 导入到自身目录: ${scanned.dir}`);
  }

  ctx.logger.debug(`  导入 ${skillName} → ${repoPath}`);

  // name 就是完整路径标识
  const fullName = skillName;

  if (ctx.dryRun) {
    ctx.logger.info(`[dry-run] 将导入 ${scanned.name} → ${fullName}`);
    return {
      name: fullName,
      version: '0.0.0',
      deployed: [],
    };
  }

  // 1. 读取并校验 SKILL.md frontmatter
  let frontmatterData: Record<string, unknown> = {};
  if (fs.existsSync(scanned.skillMdPath)) {
    const raw = fs.readFileSync(scanned.skillMdPath, 'utf-8');
    frontmatterData = parseFrontmatter(raw).data;
  }
  if (hasXmlBrackets(frontmatterData)) {
    throw new Error(`SKILL.md frontmatter 包含不允许的 XML 尖括号: ${skillName}`);
  }

  // 2. 复制文件到中央仓库
  copyDirRecursive(scanned.dir, repoPath);

  // 3. 生成 manifest.yaml
  const source: SkillSource = {
    type: 'local',
    installedVia: 'init-scan',
  };
  const manifest = createManifestFromFrontmatter(frontmatterData, skillName, source);
  const version = extractVersion(frontmatterData) ?? '0.0.0';
  manifest.currentVersion = version;
  manifest.initialVersion = version;
  writeManifest(skillName, manifest);

  // 4. 更新 skills-lock.json
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
    withFileTransaction(homePath('.state'), () => {
      const deployMode = resolveDeployMode(opts.mode ?? ctx.config.distributionMode);
      const originalManifest = structuredClone(manifest);
      const originalLockEntry = structuredClone(lockEntry);
      const distributedAt = new Date().toISOString();
      const sourceHash = computeSourceHash(repoPath);
      manifest.distribution.targets.push({
        agent: scanned.agentName,
        path: scanned.dir,
        mode: deployMode,
        version,
        distributedAt,
        sourceHash,
        managed: true,
      });
      manifest.distribution.mode = deployMode;
      lockEntry.distribution[scanned.agentName] = {
        mode: deployMode,
        distributedAt,
        sourceHash,
        managed: true,
      };

      assertDistributionStateUnlocked(skillName);
      const destination = replaceDestination(scanned.dir, () => createLink(repoPath, scanned.dir, deployMode));
      try {
        writeManifest(skillName, manifest);
        setLockEntry(fullName, lockEntry);
        destination.commit();
        deployed.push(scanned.agentName);
      } catch (error) {
        try {
          writeManifest(skillName, originalManifest);
          setLockEntry(fullName, originalLockEntry);
          destination.rollback();
        } catch {
          // Preserve the original state-write error.
        }
        throw error;
      }
    });
  }

  return {
    name: fullName,
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
  if (scope === 'agent' && agentName) {
    return withFileTransaction(homePath('.state'), () => removeSkillFromAgent(ctx, name, agentName));
  }
  if (scope === 'central' || scope === 'all') {
    return withFileTransaction(homePath('.state'), () => removeCentralSkill(ctx, name, scope));
  }

  const entry = getLockEntry(name);
  if (!entry) {
    throw new Error(`Skill 未找到: ${name}`);
  }

  // 使用 tryReadManifest 获取 manifest
  const resolved = tryReadManifest(name);
  const skillName = resolved.manifest?.name ?? name;

  // scope 已在入口处理；保留该分支仅让非法调用显式无副作用。
  void ctx;
  void entry;
  void skillName;
}

/** Remove central metadata and repository only after every Agent change is reversible. */
function removeCentralSkill(
  ctx: SkillSyncContext,
  name: string,
  scope: 'central' | 'all',
): void {
  const entry = getLockEntry(name);
  if (!entry) throw new Error(`Skill 未找到: ${name}`);
  const skillName = tryReadManifest(name).manifest?.name ?? name;
  const repoPath = skillRepoPath(name);
  const transitions: ReturnType<typeof replaceDestination>[] = [];
  assertDistributionStateUnlocked(name);
  recoverInterruptedRemoval();
  const journal = beginRemovalJournal(name);
  const transactionOptions = { beforeMove: journal.prepareMove };

  try {
    for (const [agentName, distribution] of Object.entries(entry.distribution)) {
      const destination = path.join(getAgentSkillDir(agentName), skillName);
      if (scope === 'all') {
        try {
          fs.lstatSync(destination);
          transitions.push(replaceDestination(destination, () => undefined, transactionOptions));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        continue;
      }

      // central-only retains copies; only live managed links need converting.
      if (!distribution.managed) continue;
      try {
        if (fs.lstatSync(destination).isSymbolicLink()) {
          transitions.push(replaceDestination(destination, () => copyDirRecursive(repoPath, destination, ['.backup']), transactionOptions));
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }

    const central = replaceDestination(repoPath, () => undefined, transactionOptions);
    transitions.push(central);
    removeLockEntry(name);
  } catch (error) {
    for (const transition of transitions.reverse()) {
      try {
        transition.rollback();
      } catch {
        // Preserve the original error; the remaining moved-aside paths are safer
        // than completing a destructive delete after a failed state update.
      }
    }
    journal.clear();
    throw error;
  }

  // The durable state transition is complete. A stale retired directory is safer
  // than rolling the operation back after users already observe it as deleted.
  for (const transition of transitions) {
    try {
      transition.commit();
    } catch (error) {
      ctx.logger.warn(`  清理已删除的旧目录失败: ${(error as Error).message}`);
    }
  }
  journal.clear();
}

/** Remove one Agent target with rollback for metadata or filesystem failures. */
function removeSkillFromAgent(
  _ctx: SkillSyncContext,
  name: string,
  agentName: string,
): void {
  const entry = getLockEntry(name);
  if (!entry) throw new Error(`Skill 未找到: ${name}`);

  const resolved = tryReadManifest(name);
  const manifest = resolved.manifest;
  const originalManifest = manifest ? structuredClone(manifest) : null;
  const skillName = manifest?.name ?? name;
  const destinationPath = path.join(getAgentSkillDir(agentName), skillName);

  if (manifest) {
    manifest.distribution.targets = manifest.distribution.targets.filter(target => target.agent !== agentName);
  }

  assertDistributionStateUnlocked(name);
  let destination: ReturnType<typeof replaceDestination> | null = null;
  try {
    fs.lstatSync(destinationPath);
    destination = replaceDestination(destinationPath, () => undefined);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  try {
    if (manifest) writeManifest(name, manifest);
    updateLockEntry(name, latest => {
      delete latest.distribution[agentName];
    });
    destination?.commit();
  } catch (error) {
    try {
      if (originalManifest) writeManifest(name, originalManifest);
      destination?.rollback();
    } catch {
      // Preserve the original state-write error.
    }
    throw error;
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

  const repoPath = skillRepoPath(name);
  const backupDir = backupDirPath(name);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `${entry.version}_${timestamp}`);
  copyDirRecursive(repoPath, backupPath, [BACKUP_DIR]);
  // An update that opted into backups must retain at least the snapshot it
  // just created; users who want no snapshot can use update --no-backup.
  pruneBackups(backupDir, Math.max(1, ctx.config.version?.maxBackups ?? DEFAULT_MAX_BACKUPS));

  // 更新 manifest
  const manifest = readManifest(name);
  manifest.lastBackup = {
    timestamp: new Date().toISOString(),
    fromVersion: entry.version,
    backupDir: backupPath,
  };
  writeManifest(name, manifest);

  ctx.logger.debug(`  备份创建: ${backupPath}`);
  return backupPath;
}

function pruneBackups(backupDir: string, maxBackups: number): void {
  const backups = fs.readdirSync(backupDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      path: path.join(backupDir, entry.name),
      mtimeMs: fs.statSync(path.join(backupDir, entry.name)).mtimeMs,
      name: entry.name,
    }))
    .sort((a, b) => a.mtimeMs - b.mtimeMs || a.name.localeCompare(b.name));

  const excess = Math.max(0, backups.length - Math.max(0, maxBackups));
  for (const backup of backups.slice(0, excess)) {
    fs.rmSync(backup.path, { recursive: true, force: true });
  }
}

/**
 * 列出所有 skill 的备份
 */
export function listBackups(name: string): Array<{ version: string; timestamp: string; dir: string }> {
  const { manifest } = tryReadManifest(name);

  const backupDir = backupDirPath(name);

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

function pathsOverlap(left: string, right: string): boolean {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
}
