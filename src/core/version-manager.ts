/**
 * Version Manager — 版本检查 + 备份 + 恢复
 *
 * 参考 PRD §6 版本管理 + §7 update/switch 命令规范
 *
 * 设计要点：
 * - 单一活跃版本（中央仓库始终只有一个版本）
 * - 升级前自动备份当前版本到 .backup/
 * - 恢复 = 从备份目录复制回中央仓库
 * - tree SHA 做变更检测（比 commit hash 更精准）
 * - 本地 skill 无远程源 → 跳过版本检查
 */

import fs from 'node:fs';
import path from 'node:path';
import { SkillSyncError, ExitCode } from '../lib/errors.js';
import { getLockEntry, setLockEntry, getAllLockSkillNames, readLock } from '../lib/lock.js';
import { readManifest, writeManifest } from '../lib/manifest.js';
import { skillRepoPath, backupDirPath } from '../lib/paths.js';
import { getAgentSkillDir } from '../lib/agents.js';
import { getRepoTree, getSkillTreeSha, getLatestCommitHash, getDefaultBranch } from '../lib/github.js';
import { computeSourceHash, createBackup, deploySkill, listBackups } from './skill-manager.js';
import { installGitHubSkill } from './installer.js';
import { parseSource } from '../lib/source.js';
import { extractVersion } from '../lib/frontmatter.js';
import { copyDirRecursive } from '../lib/fs-utils.js';
import { getGitHubSkillLocation } from '../lib/skill-key.js';
import type { SkillSyncContext } from './context.js';
import type { UpdateCheckResult, UpdateResult, BackupInfo, LockEntry } from '../lib/types.js';

// ==================== 版本检查 ====================

/**
 * 检查单个 skill 是否有更新
 *
 * 对于 GitHub 来源：对比本地 treeSha 与远程 treeSha
 * 对于本地来源：无远程，返回 isLocal=true
 */
export async function checkForUpdate(ctx: SkillSyncContext, name: string): Promise<UpdateCheckResult> {
  const entry = getLockEntry(name);
  if (!entry) {
    throw new SkillSyncError(`Skill 未找到: ${name}`, ExitCode.GeneralError);
  }

  const currentVersion = entry.version;

  // 本地来源 — 无远程版本可查
  if (entry.source.type === 'local') {
    return {
      name,
      currentVersion,
      remoteVersion: null,
      hasUpdate: false,
      isLocal: true,
    };
  }

  // GitHub 来源 — 检查远程 tree SHA
  const githubLocation = getGitHubSkillLocation(entry.source);
  if (githubLocation) {
    const { owner, repo, skillPath } = githubLocation;
    if (!owner || !repo) {
      return {
        name,
        currentVersion,
        remoteVersion: null,
        hasUpdate: false,
        isLocal: false,
      };
    }

    try {
      const branch = await getDefaultBranch(owner, repo);
      const tree = await getRepoTree(owner, repo, branch);

      if (!tree) {
        return {
          name,
          currentVersion,
          remoteVersion: null,
          hasUpdate: false,
          isLocal: false,
        };
      }

      const remoteTreeSha = skillPath ? getSkillTreeSha(tree.tree, skillPath) : tree.sha;
      const hasUpdate = remoteTreeSha !== null && remoteTreeSha !== entry.treeSha;

      return {
        name,
        currentVersion,
        remoteVersion: hasUpdate ? 'remote' : currentVersion,
        hasUpdate,
        isLocal: false,
      };
    } catch {
      // 网络错误，返回无更新
      return {
        name,
        currentVersion,
        remoteVersion: null,
        hasUpdate: false,
        isLocal: false,
      };
    }
  }

  return {
    name,
    currentVersion,
    remoteVersion: null,
    hasUpdate: false,
    isLocal: false,
  };
}

/**
 * 检查所有 skill 的更新
 */
export async function checkAllUpdates(ctx: SkillSyncContext): Promise<UpdateCheckResult[]> {
  const names = getAllLockSkillNames();
  const results: UpdateCheckResult[] = [];

  for (const name of names) {
    try {
      const result = await checkForUpdate(ctx, name);
      results.push(result);
    } catch (e) {
      // 单个 skill 检查失败不影响其他
      const entry = getLockEntry(name);
      results.push({
        name,
        currentVersion: entry?.version ?? 'unknown',
        remoteVersion: null,
        hasUpdate: false,
        isLocal: entry?.source.type === 'local',
      });
    }
  }

  return results;
}

// ==================== 更新 ====================

/**
 * 更新单个 skill
 *
 * 1. 创建当前版本备份
 * 2. 重新从远程下载
 * 3. 更新 manifest + lock
 * 4. 恢复分发
 *
 * @returns 更新结果
 */
export async function updateSkill(
  ctx: SkillSyncContext,
  name: string,
  opts?: { noBackup?: boolean; dryRun?: boolean; force?: boolean },
): Promise<UpdateResult> {
  const entry = getLockEntry(name);
  if (!entry) {
    return {
      name,
      success: false,
      oldVersion: 'unknown',
      newVersion: 'unknown',
      error: `Skill 未找到: ${name}`,
    };
  }

  const oldVersion = entry.version;

  // 本地来源 — 无法更新
  if (entry.source.type === 'local') {
    return {
      name,
      success: false,
      oldVersion,
      newVersion: oldVersion,
      error: '本地 skill 无远程源，无法更新',
    };
  }

  // GitHub 来源
  const githubLocation = getGitHubSkillLocation(entry.source);
  if (!githubLocation) {
    return {
      name,
      success: false,
      oldVersion,
      newVersion: oldVersion,
      error: `不支持的来源类型: ${entry.source.type}`,
    };
  }

  // dry-run 模式
  if (opts?.dryRun) {
    ctx.logger.info(`[dry-run] 将更新 ${name} ${oldVersion} → latest`);
    return {
      name,
      success: true,
      oldVersion,
      newVersion: 'latest',
    };
  }

  // 在替换中央仓库前拒绝覆盖手动修改过的受管 copy，避免更新半成功。
  assertManagedCopiesUnmodified(name, entry);

  // 记录当前分发状态（更新后恢复）
  const distributionBackup = { ...entry.distribution };

  // 1. 创建备份
  let backupDir: string | undefined;
  if (!opts?.noBackup) {
    try {
      backupDir = createBackup(ctx, name);
      ctx.logger.debug(`  备份: ${backupDir}`);
    } catch (e) {
      ctx.logger.warn(`  备份失败: ${(e as Error).message}`);
    }
  }
  // 备份会写入 lastBackup，因此在备份后快照所有本地管理字段。
  const previousManifest = structuredClone(readManifest(name));

  // 2. 重新安装
  try {
    const source = `${githubLocation.owner}/${githubLocation.repo}`;
    const sourceStr = githubLocation.skillPath
      ? `${source}/${githubLocation.skillPath}`
      : source;

    // 重新安装（覆盖）
    const result = await installGitHubSkill(ctx, sourceStr, {
      noDeploy: true,
      ignoreDeps: true,
      yes: true,
      targetKey: name,
      replaceExisting: true,
    });

    // 3. 恢复本地管理元数据，并同步仍受管的 copy 副本。
    const newEntry = getLockEntry(name);
    if (newEntry) {
      newEntry.distribution = distributionBackup;
      setLockEntry(name, newEntry);
    }
    const updatedManifest = readManifest(name);
    updatedManifest.distribution = previousManifest.distribution;
    updatedManifest.tags = previousManifest.tags;
    updatedManifest.lastBackup = previousManifest.lastBackup;
    updatedManifest.initialVersion = previousManifest.initialVersion;
    writeManifest(name, updatedManifest);

    for (const [agentName, distribution] of Object.entries(distributionBackup)) {
      if (distribution.managed && distribution.mode === 'copy') {
        deploySkill(ctx, name, agentName, { mode: 'copy' });
      }
    }

    return {
      name,
      success: true,
      oldVersion,
      newVersion: result.version,
      backupDir,
    };
  } catch (e) {
    return {
      name,
      success: false,
      oldVersion,
      newVersion: oldVersion,
      error: (e as Error).message,
      backupDir,
    };
  }
}

function assertManagedCopiesUnmodified(name: string, entry: LockEntry): void {
  for (const [agentName, distribution] of Object.entries(entry.distribution)) {
    if (!distribution.managed || distribution.mode !== 'copy') continue;
    const copyPath = path.join(getAgentSkillDir(agentName), name);
    if (!fs.existsSync(copyPath)) continue;
    if (computeSourceHash(copyPath) !== distribution.sourceHash) {
      throw new Error(`受管 copy 已被手动修改: ${copyPath}（请先处理副本再更新）`);
    }
  }
}

/**
 * 更新所有有更新的 skill
 *
 * 非原子：逐个升级，每个独立成功/失败
 */
export async function updateAllSkills(
  ctx: SkillSyncContext,
  opts?: { noBackup?: boolean; dryRun?: boolean; force?: boolean },
): Promise<UpdateResult[]> {
  const checks = await checkAllUpdates(ctx);
  const toUpdate = checks.filter(c => c.hasUpdate);

  if (toUpdate.length === 0) {
    return [];
  }

  const results: UpdateResult[] = [];
  for (const check of toUpdate) {
    const result = await updateSkill(ctx, check.name, opts);
    results.push(result);
  }

  return results;
}

// ==================== 版本恢复 ====================

/**
 * 列出 skill 的所有备份
 */
export function listSkillBackups(name: string): BackupInfo[] {
  const backups = listBackups(name);
  return backups.map((b, idx) => ({
    id: idx + 1,
    version: b.version,
    timestamp: b.timestamp,
    backupDir: b.dir,
  }));
}

/**
 * 从备份恢复 skill
 *
 * 1. 将当前版本备份（如果未备份过）
 * 2. 从指定备份目录复制文件回中央仓库
 * 3. 更新 manifest + lock
 * 4. 注意：恢复后不自动重新 deploy（PRD D-20）
 *
 * @param backupId 备份 ID（1-based），不指定则恢复最近的
 */
export function restoreFromBackup(
  ctx: SkillSyncContext,
  name: string,
  backupId?: number,
): { version: string; backupDir: string } {
  const entry = getLockEntry(name);
  if (!entry) {
    throw new SkillSyncError(`Skill 未找到: ${name}`, ExitCode.GeneralError);
  }

  const backups = listSkillBackups(name);
  if (backups.length === 0) {
    throw new SkillSyncError(`无可用备份: ${name}`, ExitCode.GeneralError);
  }

  // 选择备份
  const target = backupId
    ? backups.find(b => b.id === backupId)
    : backups[0]; // 最近的

  if (!target) {
    throw new SkillSyncError(`备份 ID ${backupId} 不存在，可用: ${backups.map(b => b.id).join(', ')}`, ExitCode.InvalidArgs);
  }

  const repoPath = skillRepoPath(name);

  // 替换中央仓库内容
  if (fs.existsSync(repoPath)) {
    // 保留 .backup 目录
    const backupDir = backupDirPath(name);
    const entries = fs.readdirSync(repoPath, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === '.backup') continue;
      const fullPath = path.join(repoPath, e.name);
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }

  // 从备份复制
  copyDirRecursive(target.backupDir, repoPath, ['.backup']);

  // 读取恢复后的 manifest
  const manifest = readManifest(name);
  const restoredVersion = target.version;

  // 更新 manifest 版本
  manifest.currentVersion = restoredVersion;
  writeManifest(name, manifest);

  // 更新 lock
  entry.version = restoredVersion;
  entry.updatedAt = new Date().toISOString();
  setLockEntry(name, entry);

  ctx.logger.debug(`  恢复 ${name} → v${restoredVersion} (from ${target.backupDir})`);

  return {
    version: restoredVersion,
    backupDir: target.backupDir,
  };
}
