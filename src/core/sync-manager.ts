/**
 * Sync Manager — Git 同步核心模块
 *
 * 参考 PRD §7 sync 命令规范 + §12 Git 策略
 *
 * 设计要点：
 * - 使用 simple-git 封装 Git 操作
 * - push: git add → git commit → git push
 * - pull: git fetch → git merge (带冲突策略)
 * - 冲突策略: ours | theirs | manual | newer | skip
 * - dry-run: 只预览不实际执行
 */

import fs from 'node:fs';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import { getHomeDir } from '../lib/paths.js';
import { readConfig } from '../config.js';
import type { SkillSyncContext } from './context.js';
import type { SyncResult, SyncStatus, ConflictStrategy } from '../lib/types.js';

/**
 * 获取 simple-git 实例
 */
function getGit(ctx: SkillSyncContext) {
  const homeDir = getHomeDir();
  ctx.logger.debug(`  Git 目录: ${homeDir}`);
  return simpleGit(homeDir);
}

/**
 * 检查 Git 是否已初始化
 */
export function isGitInitialized(): boolean {
  const gitDir = path.join(getHomeDir(), '.git');
  return fs.existsSync(gitDir);
}

/**
 * 初始化 Git 仓库
 */
export async function initGit(ctx: SkillSyncContext): Promise<void> {
  const homeDir = getHomeDir();
  const git = simpleGit(homeDir);
  await git.init();
  ctx.logger.debug('  Git 仓库已初始化');
}

/**
 * 获取同步状态
 */
export async function getSyncStatus(ctx: SkillSyncContext): Promise<SyncStatus> {
  if (!isGitInitialized()) {
    return {
      isRepo: false,
      hasRemote: false,
      uncommittedChanges: 0,
      ahead: 0,
      behind: 0,
    };
  }

  const git = getGit(ctx);

  try {
    const status = await git.status();
    const changeCount = status.not_added.length + status.modified.length + status.deleted.length + status.staged.length;
    const remotes = await git.getRemotes(true);

    return {
      isRepo: true,
      hasRemote: remotes.length > 0,
      uncommittedChanges: changeCount,
      ahead: status.ahead,
      behind: status.behind,
    };
  } catch {
    return {
      isRepo: true,
      hasRemote: false,
      uncommittedChanges: 0,
      ahead: 0,
      behind: 0,
    };
  }
}

/**
 * 推送本地变更到远程
 *
 * 1. git add -A
 * 2. git commit (如果有变更)
 * 3. git push
 */
export async function pushSync(
  ctx: SkillSyncContext,
  opts?: { message?: string; dryRun?: boolean },
): Promise<SyncResult> {
  if (!isGitInitialized()) {
    return {
      success: false,
      pushed: 0,
      pulled: 0,
      conflicts: [],
      error: 'Git 仓库未初始化',
    };
  }

  const git = getGit(ctx);
  const config = readConfig();
  const commitPrefix = config.sync?.github?.commitMessagePrefix ?? 'skill-sync:';
  const message = opts?.message ?? `${commitPrefix} sync skills`;

  try {
    const status = await git.status();

    if (status.isClean()) {
      // 无变更可提交
      if (opts?.dryRun) {
        ctx.logger.info('[dry-run] 无变更可提交');
      }
      return {
        success: true,
        pushed: 0,
        pulled: 0,
        conflicts: [],
      };
    }

    if (opts?.dryRun) {
      const changes = [
        ...status.not_added,
        ...status.modified,
        ...status.deleted,
      ];
      ctx.logger.info(`[dry-run] 将提交 ${changes.length} 个文件变更`);
      ctx.logger.info(`[dry-run] 提交信息: ${message}`);
      return {
        success: true,
        pushed: changes.length,
        pulled: 0,
        conflicts: [],
      };
    }

    // 1. git add -A
    await git.add('-A');

    // 2. git commit
    await git.commit(message);

    // 3. git push (如果有远程)
    const remotes = await git.getRemotes(true);
    if (remotes.length > 0) {
      await git.push();
    }

    return {
      success: true,
      pushed: 1,
      pulled: 0,
      conflicts: [],
    };
  } catch (e) {
    return {
      success: false,
      pushed: 0,
      pulled: 0,
      conflicts: [],
      error: (e as Error).message,
    };
  }
}

/**
 * 拉取远程变更到本地
 *
 * 1. git fetch
 * 2. git merge (带冲突策略)
 *
 * 冲突策略:
 * - ours: 保留本地变更
 * - theirs: 采用远程变更
 * - manual: 不自动解决，留给用户手动处理
 * - newer: 按时间戳选择较新的
 * - skip: 跳过有冲突的文件
 */
export async function pullSync(
  ctx: SkillSyncContext,
  opts?: { strategy?: ConflictStrategy; dryRun?: boolean },
): Promise<SyncResult> {
  if (!isGitInitialized()) {
    return {
      success: false,
      pushed: 0,
      pulled: 0,
      conflicts: [],
      error: 'Git 仓库未初始化',
    };
  }

  const git = getGit(ctx);
  const strategy = opts?.strategy ?? readConfig().conflict?.defaultStrategy ?? 'manual';

  try {
    const remotes = await git.getRemotes(true);
    if (remotes.length === 0) {
      return {
        success: false,
        pushed: 0,
        pulled: 0,
        conflicts: [],
        error: '无远程仓库配置',
      };
    }

    if (opts?.dryRun) {
      ctx.logger.info('[dry-run] 将拉取远程变更');
      ctx.logger.info(`[dry-run] 冲突策略: ${strategy}`);
      return {
        success: true,
        pushed: 0,
        pulled: 1,
        conflicts: [],
      };
    }

    // 1. git fetch
    await git.fetch();

    // 2. 检查是否有远程变更
    const status = await git.status();
    if (status.behind === 0) {
      return {
        success: true,
        pushed: 0,
        pulled: 0,
        conflicts: [],
      };
    }

    // 3. 根据策略处理
    switch (strategy) {
      case 'ours':
        // 保留本地，merge --strategy=ours
        await git.merge(['--strategy=ours', 'origin/' + status.current]);
        break;

      case 'theirs':
        // 采用远程
        await git.merge(['--strategy-option=theirs', 'origin/' + status.current]);
        break;

      case 'manual':
        // 普通合并，可能产生冲突
        try {
          await git.merge(['origin/' + status.current]);
        } catch (mergeError) {
          // 有冲突
          const conflicts = await getConflictFiles(git);
          return {
            success: false,
            pushed: 0,
            pulled: 0,
            conflicts,
            error: `合并冲突: ${conflicts.join(', ')}（请手动解决后 git commit）`,
          };
        }
        break;

      case 'newer':
        // 按时间戳 — 先尝试自动合并，失败则 manual
        try {
          await git.merge(['origin/' + status.current]);
        } catch {
          const conflicts = await getConflictFiles(git);
          return {
            success: false,
            pushed: 0,
            pulled: 0,
            conflicts,
            error: `自动合并失败，需手动解决: ${conflicts.join(', ')}`,
          };
        }
        break;

      case 'skip':
        // 跳过 — reset 回 fetch 前的状态
        // 实际上不做 merge，只更新 fetch
        return {
          success: true,
          pushed: 0,
          pulled: 0,
          conflicts: [],
        };
    }

    return {
      success: true,
      pushed: 0,
      pulled: 1,
      conflicts: [],
    };
  } catch (e) {
    return {
      success: false,
      pushed: 0,
      pulled: 0,
      conflicts: [],
      error: (e as Error).message,
    };
  }
}

/**
 * 获取冲突文件列表
 */
async function getConflictFiles(git: ReturnType<typeof simpleGit>): Promise<string[]> {
  try {
    const status = await git.status();
    return status.conflicted;
  } catch {
    return [];
  }
}
