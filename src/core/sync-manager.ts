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
 * 执行 git push，自动处理首次推送的 --set-upstream
 *
 * 如果当前分支没有设置 upstream，会自动添加 --set-upstream origin <branch>
 */
async function gitPushWithUpstream(
  git: ReturnType<typeof simpleGit>,
  ctx: SkillSyncContext,
): Promise<void> {
  const status = await git.status();
  const branch = status.current;

  if (!branch) {
    // 没有当前分支（可能是 detached HEAD），直接 push
    ctx.logger.debug('  git push (no branch info)');
    await git.push();
    return;
  }

  // 检查是否有 upstream tracking
  if (status.tracking) {
    // 已有 upstream，直接 push
    ctx.logger.debug(`  git push (${branch} → ${status.tracking})`);
    await git.push();
  } else {
    // 没有 upstream，首次推送需要 --set-upstream
    const remotes = await git.getRemotes(true);
    if (remotes.length === 0) {
      ctx.logger.debug('  git push 跳过（无远程仓库）');
      return;
    }
    const remoteName = remotes[0]!.name;
    ctx.logger.debug(`  git push --set-upstream ${remoteName} ${branch} (首次推送)`);
    await git.push(['--set-upstream', remoteName, branch]);
  }
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
 * 3. git push (如果有远程)
 *
 * 即使工作区干净，如果有未推送的 commits 也会执行 push。
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
    const remotes = await git.getRemotes(true);
    const hasRemote = remotes.length > 0;

    if (status.isClean()) {
      // 工作区干净 — 检查是否有未推送的 commits
      if (status.ahead > 0 && hasRemote) {
        if (opts?.dryRun) {
          ctx.logger.info(`[dry-run] 将推送 ${status.ahead} 个未推送的 commit`);
          return { success: true, pushed: status.ahead, pulled: 0, conflicts: [] };
        }
        await gitPushWithUpstream(git, ctx);
        return { success: true, pushed: status.ahead, pulled: 0, conflicts: [] };
      }
      // 无变更可提交，也无未推送 commits
      return { success: true, pushed: 0, pulled: 0, conflicts: [] };
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
    if (hasRemote) {
      await gitPushWithUpstream(git, ctx);
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

// ─── Git 信息查询（供 Web API 使用） ──────────────────────────

export interface GitCommitInfo {
  hash: string;
  date: string;
  message: string;
  author: string;
  refs: string;
}

export interface GitRemoteInfo {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

export interface GitBranchInfo {
  current: string | null;
  tracking: string | null;
}

/**
 * 获取远程仓库列表
 */
export async function getRemotes(ctx: SkillSyncContext): Promise<GitRemoteInfo[]> {
  if (!isGitInitialized()) return [];
  const git = getGit(ctx);
  try {
    const remotes = await git.getRemotes(true);
    return remotes.map(r => ({
      name: r.name,
      fetchUrl: r.refs?.fetch ?? '',
      pushUrl: r.refs?.push ?? '',
    }));
  } catch {
    return [];
  }
}

/**
 * 设置远程仓库 URL（如果 origin 不存在则添加，存在则修改）
 */
export async function setRemoteUrl(ctx: SkillSyncContext, name: string, url: string): Promise<void> {
  const git = getGit(ctx);
  const remotes = await git.getRemotes(true);
  const exists = remotes.some(r => r.name === name);
  if (exists) {
    await git.removeRemote(name);
  }
  await git.addRemote(name, url);
  ctx.logger.debug(`  远程仓库 ${name} 已设置为 ${url}`);
}

/**
 * 获取提交历史
 */
export async function getCommitLog(ctx: SkillSyncContext, limit: number = 20): Promise<GitCommitInfo[]> {
  if (!isGitInitialized()) return [];
  const git = getGit(ctx);
  try {
    const log = await git.log({ maxCount: limit });
    return log.all.map(entry => ({
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
      author: entry.author_name,
      refs: entry.refs ?? '',
    }));
  } catch {
    return [];
  }
}

/**
 * 获取分支信息
 */
export async function getBranchInfo(ctx: SkillSyncContext): Promise<GitBranchInfo> {
  if (!isGitInitialized()) return { current: null, tracking: null };
  const git = getGit(ctx);
  try {
    const status = await git.status();
    return {
      current: status.current,
      tracking: status.tracking,
    };
  } catch {
    return { current: null, tracking: null };
  }
}

/**
 * 获取变更文件列表（未提交的）
 */
export async function getChangedFiles(ctx: SkillSyncContext): Promise<Array<{ path: string; status: string }>> {
  if (!isGitInitialized()) return [];
  const git = getGit(ctx);
  try {
    const status = await git.status();
    const files: Array<{ path: string; status: string }> = [];
    for (const f of status.not_added) files.push({ path: f, status: 'untracked' });
    for (const f of status.modified) files.push({ path: f, status: 'modified' });
    for (const f of status.deleted) files.push({ path: f, status: 'deleted' });
    for (const f of status.staged) files.push({ path: f, status: 'staged' });
    return files;
  } catch {
    return [];
  }
}

/**
 * 获取 git diff 内容（供 AI 分析生成 commit 消息）
 *
 * 返回工作区与 HEAD 之间的所有差异（staged + unstaged）
 */
export async function getGitDiff(ctx: SkillSyncContext): Promise<{ diff: string; files: string[] }> {
  if (!isGitInitialized()) return { diff: '', files: [] };
  const git = getGit(ctx);
  try {
    const status = await git.status();
    const files = [
      ...status.not_added,
      ...status.modified,
      ...status.deleted,
      ...status.staged,
    ];
    if (files.length === 0) return { diff: '', files: [] };

    // git diff HEAD 包含所有变更（staged + unstaged）
    const diff = await git.diff(['HEAD']);
    return { diff, files };
  } catch {
    return { diff: '', files: [] };
  }
}
