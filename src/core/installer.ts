/**
 * Installer — Skill 安装核心模块
 *
 * 参考 PRD §7 install 命令 + TeleAgent source.ts
 *
 * 职责：
 * - 从 GitHub 仓库下载 skill（Trees API + raw 下载）
 * - 从本地路径导入 skill
 * - 发现仓库中的多个 skill
 * - 安装到中央仓库 skills/<namespace>/<skillName>/
 * - 生成 manifest.yaml
 * - 更新 skills-lock.json
 * - 可选：分发到 Agent 目录
 * - 可选：安装包依赖
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseSource } from '../lib/source.js';
import { parseFrontmatter, extractVersion, extractDependencies } from '../lib/frontmatter.js';
import { sanitizeMetadata, sanitizeName } from '../lib/sanitize.js';
import {
  getRepoTree,
  findSkillMdPaths,
  getSkillFilePaths,
  getSkillTreeSha,
  downloadRawFile,
  getDefaultBranch,
} from '../lib/github.js';
import { createManifestFromFrontmatter, writeManifest } from '../lib/manifest.js';
import { setLockEntry, hasLockEntry, getAllLockSkillNames } from '../lib/lock.js';
import { skillRepoPath } from '../lib/paths.js';
import { extractPackageDependencies, installDependencies, checkSkillDependencies } from '../lib/dependencies.js';
import { detectInstalledAgents } from '../lib/agents.js';
import { copyDirRecursive } from '../lib/fs-utils.js';
import { deploySkill } from './skill-manager.js';
import type { SkillSyncContext } from './context.js';
import type {
  ParsedSource,
  DiscoveredSkill,
  InstallOpts,
  InstallResult,
  SkillSource,
  LockEntry,
  UserDeployMode,
} from '../lib/types.js';

// ==================== 本地 Skill 发现 ====================

/**
 * 从本地目录发现 skill（递归查找 SKILL.md）
 * 支持嵌套 skill 目录结构（如 write-a-skill/engineering/tdd）
 */
export function discoverLocalSkills(dir: string, maxDepth = 5): DiscoveredSkill[] {
  const results: DiscoveredSkill[] = [];
  if (!fs.existsSync(dir)) return results;

  const baseDir = dir;

  function walk(currentDir: string, depth: number): void {
    if (depth > maxDepth) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    // 首先检查当前目录是否有 SKILL.md（根目录除外）
    const currentSkillMd = path.join(currentDir, 'SKILL.md');
    if (depth > 0 && fs.existsSync(currentSkillMd)) {
      const relativePath = path.relative(baseDir, currentDir);
      // 使用 relativePath 作为默认 name，保持嵌套目录结构
      results.push(buildSkillEntry(relativePath, currentDir, currentSkillMd, relativePath));
      // 继续递归扫描子目录，因为可能存在嵌套 skill
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      if (entry.isDirectory() || entry.isSymbolicLink()) {
        const subDir = path.join(currentDir, entry.name);
        walk(subDir, depth + 1);
      }
    }
  }

  // 检查根目录的 SKILL.md
  const rootSkillMd = path.join(dir, 'SKILL.md');
  if (fs.existsSync(rootSkillMd)) {
    results.push(buildSkillEntry(path.basename(dir), dir, rootSkillMd, path.basename(dir)));
  }

  // 检查 skills/ 子目录
  const skillsSub = path.join(dir, 'skills');
  if (fs.existsSync(skillsSub) && fs.statSync(skillsSub).isDirectory()) {
    walk(skillsSub, 0);
  }

  walk(dir, 0);

  // 去重
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.dir)) return false;
    seen.add(r.dir);
    return true;
  });
}

/**
 * 从 SKILL.md 构建 DiscoveredSkill
 * 
 * 对于本地导入的 skill，使用 relativePath 作为 name 的默认值，保持嵌套目录结构
 * SKILL.md 中的 name 字段仅作为描述性信息，不用于路径结构
 */
function buildSkillEntry(defaultName: string, dir: string, skillMdPath: string, relativePath?: string): DiscoveredSkill {
  let rawContent = '';
  try {
    rawContent = fs.readFileSync(skillMdPath, 'utf-8');
  } catch {
    return { name: defaultName, dir, skillMdPath, relativePath };
  }

  const { data, content } = parseFrontmatter(rawContent);
  // 对于本地导入，优先使用 relativePath/defaultName 作为 skill 标识名
  // SKILL.md 中的 name 仅作为元数据，不覆盖路径结构
  const name = defaultName;
  const description = typeof data.description === 'string' ? sanitizeMetadata(data.description) : undefined;

  return {
    name,
    dir,
    skillMdPath,
    description,
    metadata: Object.keys(data).length > 0 ? data : undefined,
    rawContent: content,
    relativePath,
  };
}

// ==================== GitHub Skill 发现 ====================

/**
 * 从 GitHub 仓库发现 skill（使用 Trees API）
 */
export async function discoverGitHubSkills(
  ctx: SkillSyncContext,
  parsed: ParsedSource,
): Promise<DiscoveredSkill[]> {
  if (!parsed.owner || !parsed.repo) {
    throw new Error('GitHub source 缺少 owner/repo');
  }

  const ref = parsed.ref || await getDefaultBranch(parsed.owner, parsed.repo);
  ctx.logger.debug(`  获取仓库文件树: ${parsed.owner}/${parsed.repo}@${ref}`);

  const tree = await getRepoTree(parsed.owner, parsed.repo, ref);
  if (!tree) {
    throw new Error('无法获取仓库文件树（可能仓库过大或网络问题）');
  }

  const skillPaths = findSkillMdPaths(tree.tree);

  // 如果指定了 skillPath，只保留匹配的
  const filtered = parsed.skillPath
    ? skillPaths.filter(s => s.path === parsed.skillPath || s.path.startsWith(parsed.skillPath! + '/'))
    : skillPaths;

  // 如果指定了 skillFilter，按名称过滤
  const finalFiltered = parsed.skillFilter
    ? filtered.filter(s => s.name === parsed.skillFilter)
    : filtered;

  // 下载每个 skill 的 SKILL.md
  const skills: DiscoveredSkill[] = [];
  for (const skillInfo of finalFiltered) {
    const skillMdContent = await downloadRawFile(
      parsed.owner,
      parsed.repo,
      skillInfo.path ? `${skillInfo.path}/SKILL.md` : 'SKILL.md',
      ref,
    );

    const { data, content } = parseFrontmatter(skillMdContent);
    const name = typeof data.name === 'string' ? sanitizeMetadata(data.name) : (skillInfo.name || parsed.repo);
    const description = typeof data.description === 'string' ? sanitizeMetadata(data.description) : undefined;

    skills.push({
      name,
      dir: skillInfo.path || '',
      skillMdPath: skillInfo.path ? `${skillInfo.path}/SKILL.md` : 'SKILL.md',
      description,
      metadata: Object.keys(data).length > 0 ? data : undefined,
      rawContent: content,
    });
  }

  return skills;
}

// ==================== GitHub Skill 下载 ====================

/**
 * 从 GitHub 下载 skill 文件到中央仓库
 */
export async function downloadGitHubSkill(
  ctx: SkillSyncContext,
  parsed: ParsedSource,
  skillPath: string,
  destDir: string,
): Promise<{ commitHash: string; treeSha: string | null }> {
  if (!parsed.owner || !parsed.repo) {
    throw new Error('GitHub source 缺少 owner/repo');
  }

  const ref = parsed.ref || await getDefaultBranch(parsed.owner, parsed.repo);
  const tree = await getRepoTree(parsed.owner, parsed.repo, ref);
  if (!tree) {
    throw new Error('无法获取仓库文件树');
  }

  // 获取 skill 目录下所有文件
  const filePaths = getSkillFilePaths(tree.tree, skillPath);

  // 创建目标目录
  fs.mkdirSync(destDir, { recursive: true });

  // 下载每个文件
  for (const filePath of filePaths) {
    const fullPath = skillPath ? `${skillPath}/${filePath}` : filePath;
    const destPath = path.join(destDir, filePath);

    // 确保子目录存在
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    const content = await downloadRawFile(parsed.owner, parsed.repo, fullPath, ref);
    fs.writeFileSync(destPath, content, 'utf-8');
  }

  // 获取 tree SHA
  const treeSha = skillPath ? getSkillTreeSha(tree.tree, skillPath) : tree.sha;

  return {
    commitHash: tree.sha,
    treeSha,
  };
}

// ==================== 本地 Skill 安装 ====================

/**
 * 从本地路径安装 skill
 */
export function installLocalSkill(
  ctx: SkillSyncContext,
  localPath: string,
  namespace: string,
  opts?: InstallOpts,
): InstallResult {
  const resolved = path.resolve(localPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`本地路径不存在: ${resolved}`);
  }

  // 发现 skill
  let skills = discoverLocalSkills(resolved);

  // 如果指定了 skill 名称，过滤
  if (opts?.skill) {
    skills = skills.filter(s => s.name === opts.skill);
  }

  if (skills.length === 0) {
    throw new Error(`未在 ${resolved} 中找到 skill${opts?.skill ? `: ${opts.skill}` : ''}`);
  }

  if (skills.length > 1 && !opts?.skill) {
    const names = skills.map(s => s.name).join(', ');
    throw new Error(`发现多个 skill: ${names}\n请使用 -s/--skill 指定要安装的 skill`);
  }

  const skill = skills[0]!;
  return installFromDiscovered(ctx, skill, namespace, {
    type: 'local',
    installedVia: 'cli',
  }, opts);
}

// ==================== GitHub Skill 安装 ====================

/**
 * 从 GitHub 安装 skill
 */
export async function installGitHubSkill(
  ctx: SkillSyncContext,
  sourceStr: string,
  opts?: InstallOpts,
): Promise<InstallResult> {
  const parsed = parseSource(sourceStr);

  if (parsed.type !== 'github') {
    throw new Error(`非 GitHub 来源，请使用 installLocalSkill: ${sourceStr}`);
  }

  // 发现仓库中的 skill
  const skills = await discoverGitHubSkills(ctx, parsed);

  if (skills.length === 0) {
    throw new Error(`未在 ${parsed.owner}/${parsed.repo} 中找到 skill`);
  }

  // 过滤
  let targetSkill = skills[0]!;
  if (opts?.skill) {
    const found = skills.find(s => s.name === opts.skill);
    if (!found) {
      const names = skills.map(s => s.name).join(', ');
      throw new Error(`未找到 skill "${opts.skill}"，可用: ${names}`);
    }
    targetSkill = found;
  } else if (skills.length > 1) {
    const names = skills.map(s => s.name).join(', ');
    throw new Error(`发现多个 skill: ${names}\n请使用 -s/--skill 指定要安装的 skill`);
  }

  const namespace = parsed.owner!;
  const skillName = sanitizeName(targetSkill.name);
  const repoPath = skillRepoPath(namespace, skillName);

  // 下载到中央仓库
  ctx.logger.debug(`  下载到: ${repoPath}`);

  if (ctx.dryRun) {
    ctx.logger.info(`[dry-run] 将安装 ${namespace}/${skillName}`);
    return {
      name: `${namespace}/${skillName}`,
      namespace,
      version: extractVersion(targetSkill.metadata ?? {}) ?? '0.0.0',
      source: { type: 'github', repo: `${parsed.owner}/${parsed.repo}`, path: targetSkill.dir || undefined, installedVia: 'cli' },
      deployed: [],
    };
  }

  const { commitHash, treeSha } = await downloadGitHubSkill(
    ctx,
    parsed,
    targetSkill.dir,
    repoPath,
  );

  // 生成 manifest
  const frontmatterData = targetSkill.metadata ?? {};
  const skillSource: SkillSource = {
    type: 'github',
    repo: `${parsed.owner}/${parsed.repo}`,
    path: targetSkill.dir || undefined,
    installedVia: 'cli',
  };

  return finalizeInstall(ctx, repoPath, namespace, skillName, frontmatterData, skillSource, opts, {
    commit: commitHash,
    treeSha,
  });
}

// ==================== 通用安装逻辑 ====================

/**
 * 从 DiscoveredSkill 安装到中央仓库
 */
function installFromDiscovered(
  ctx: SkillSyncContext,
  skill: DiscoveredSkill,
  namespace: string,
  source: SkillSource,
  opts?: InstallOpts,
): InstallResult {
  const skillName = sanitizeName(skill.name);
  const repoPath = skillRepoPath(namespace, skillName);

  if (ctx.dryRun) {
    ctx.logger.info(`[dry-run] 将安装 ${namespace}/${skillName}`);
    return {
      name: `${namespace}/${skillName}`,
      namespace,
      version: extractVersion(skill.metadata ?? {}) ?? '0.0.0',
      source,
      deployed: [],
    };
  }

  // 复制文件到中央仓库
  fs.mkdirSync(repoPath, { recursive: true });
  copyDirRecursive(skill.dir, repoPath, ['.backup']);

  return finalizeInstall(ctx, repoPath, namespace, skillName, skill.metadata ?? {}, source, opts);
}

/**
 * 完成安装：生成 manifest + 更新 lock + 分发 + 依赖
 */
function finalizeInstall(
  ctx: SkillSyncContext,
  repoPath: string,
  namespace: string,
  skillName: string,
  frontmatterData: Record<string, unknown>,
  source: SkillSource,
  opts?: InstallOpts,
  remote?: { commit?: string; treeSha?: string | null },
): InstallResult {
  const fullName = `${namespace}/${skillName}`;

  // 检查是否已安装
  if (hasLockEntry(fullName)) {
    ctx.logger.debug(`  ${fullName} 已存在，将更新`);
  }

  // 生成 manifest
  const manifest = createManifestFromFrontmatter(frontmatterData, namespace, skillName, source);
  const version = extractVersion(frontmatterData) ?? '0.0.0';
  manifest.currentVersion = version;
  manifest.initialVersion = version;

  // 提取依赖
  const deps = extractDependencies(frontmatterData);
  if (deps.length > 0) {
    manifest.dependsOn = deps;
  }

  writeManifest(namespace, skillName, manifest);

  // 更新 lock
  const lockEntry: LockEntry = {
    source: {
      type: source.type,
      repo: source.repo,
      path: source.path,
      commit: remote?.commit,
    },
    version,
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    treeSha: remote?.treeSha ?? undefined,
    distribution: {},
  };
  setLockEntry(fullName, lockEntry);

  // 检查 skill 间依赖
  if (!opts?.ignoreDeps && deps.length > 0) {
    const installedSkills = new Set(getAllLockSkillNames());
    const missing = checkSkillDependencies(deps, installedSkills);
    if (missing.length > 0) {
      ctx.logger.warn(`  缺少依赖: ${missing.join(', ')}（使用 --ignore-deps 跳过）`);
    }
  }

  // 安装包依赖
  const pkgDeps = extractPackageDependencies(frontmatterData);
  if (!isEmptyDependenciesSafe(pkgDeps)) {
    ctx.logger.debug(`  安装包依赖...`);
    installDependencies(repoPath, pkgDeps);
  }

  // 分发到 Agent
  const deployed: string[] = [];
  if (!opts?.noDeploy) {
    const agents = opts?.agents ?? detectDefaultAgents();
    for (const agent of agents) {
      try {
        deploySkill(ctx, fullName, agent, { mode: opts?.deployType, force: true });
        deployed.push(agent);
      } catch (e) {
        ctx.logger.warn(`  分发到 ${agent} 失败: ${(e as Error).message}`);
      }
    }
  }

  return {
    name: fullName,
    namespace,
    version,
    source,
    deployed,
  };
}

// ==================== 辅助函数 ====================

/**
 * 检测默认应分发到的 Agent（已安装的）
 */
function detectDefaultAgents(): string[] {
  return detectInstalledAgents();
}

/**
 * 安全检查依赖是否为空
 */
function isEmptyDependenciesSafe(deps: unknown): boolean {
  if (!deps || typeof deps !== 'object') return true;
  const obj = deps as Record<string, unknown>;
  return Object.values(obj).every(arr => !Array.isArray(arr) || arr.length === 0);
}
