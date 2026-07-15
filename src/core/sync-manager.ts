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
 * - 支持多平台: GitHub / Gitee
 * - 支持代理配置
 */

import fs from 'node:fs';
import path from 'node:path';
import { simpleGit, type SimpleGitOptions } from 'simple-git';
import { getHomeDir } from '../lib/paths.js';
import { readConfig, updateConfig } from '../config.js';
import type { SkillSyncContext } from './context.js';
import type {
  SyncResult,
  SyncStatus,
  ConflictStrategy,
  GitPlatformConfig,
  GitCommitInfo,
  GitRemoteInfo,
  GitBranchInfo,
  GitPlatform,
  GitPlatformInfo,
  ProxyConfig,
} from '../lib/types.js';
import { getLazyGitHubToken } from '../lib/github.js';
import { getGiteeToken, getUserInfo as getGiteeUserInfo } from '../lib/gitee.js';

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
  const commitPrefix = config.sync?.commitMessagePrefix ?? 'skill-sync:';
  const message = opts?.message ?? `${commitPrefix} sync skills`;

  try {
    const status = await git.status();
    const remotes = await git.getRemotes(true);
    const hasRemote = remotes.length > 0;

    if (status.isClean()) {
      // 工作区干净 — 检查是否有未推送的 commits
      // 注意：status.ahead 依赖 upstream tracking branch。
      // 如果分支没有设置 upstream（首次推送场景），ahead 会返回 0，
      // 但实际上所有 commit 都是未推送的，需要通过 !status.tracking 判断。
      const hasUnpushedCommits = status.ahead > 0 || (!status.tracking && hasRemote);

      if (hasUnpushedCommits) {
        const unpushedCount = status.ahead > 0 ? status.ahead : 1;
        if (opts?.dryRun) {
          ctx.logger.info(`[dry-run] 将推送 ${unpushedCount} 个未推送的 commit`);
          return { success: true, pushed: unpushedCount, pulled: 0, conflicts: [] };
        }
        await gitPushWithUpstream(git, ctx);
        return { success: true, pushed: unpushedCount, pulled: 0, conflicts: [] };
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

      case 'newer': {
        // 按时间戳选择较新的版本 — 先尝试自动合并
        try {
          await git.merge(['origin/' + status.current]);
        } catch {
          // 合并有冲突，逐文件按最后提交时间选择较新版本
          const conflicts = await getConflictFiles(git);
          const resolved: string[] = [];
          const unresolved: string[] = [];

          for (const file of conflicts) {
            const oursTime = await getLastCommitTime(git, 'HEAD', file);
            const theirsTime = await getLastCommitTime(git, 'MERGE_HEAD', file);

            if (oursTime === null && theirsTime === null) {
              // 两边都没有提交记录，无法判断
              unresolved.push(file);
            } else if (oursTime === null || (theirsTime !== null && theirsTime > oursTime)) {
              // 远程更新，采用远程
              await git.raw(['checkout', '--theirs', '--', file]);
              await git.add(file);
              resolved.push(file);
            } else {
              // 本地更新或相同，采用本地
              await git.raw(['checkout', '--ours', '--', file]);
              await git.add(file);
              resolved.push(file);
            }
          }

          if (unresolved.length > 0) {
            return {
              success: false,
              pushed: 0,
              pulled: 0,
              conflicts: unresolved,
              error: `无法按时间戳自动解决冲突: ${unresolved.join(', ')}（请手动解决）`,
            };
          }

          // 所有冲突已解决，完成合并
          await git.commit(`Merge: 按时间戳自动解决 ${resolved.length} 个冲突`);
          ctx.logger.info(`  按时间戳自动解决 ${resolved.length} 个冲突`);
        }
        break;
      }

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

/**
 * 获取指定 ref 最后一次修改某文件的提交时间戳（Unix 秒）
 *
 * 用于 newer 冲突策略：比较 HEAD 和 MERGE_HEAD 对同一文件的最后修改时间。
 * 返回 null 表示该 ref 从未修改过此文件。
 */
async function getLastCommitTime(
  git: ReturnType<typeof simpleGit>,
  ref: string,
  file: string,
): Promise<number | null> {
  try {
    const result = await git.raw(['log', '-1', '--format=%ct', ref, '--', file]);
    const trimmed = result.trim();
    if (!trimmed) return null;
    return parseInt(trimmed, 10);
  } catch {
    return null;
  }
}

// ─── Git 信息查询（供 Web API 使用） ──────────────────────────
// 类型定义已移至 ../lib/types.ts（GitCommitInfo, GitRemoteInfo, GitBranchInfo 等）

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

// ─── 多平台 Git 支持（GitHub / Gitee）──────────────────────────

/**
 * 获取所有 Git 平台信息
 */
export function getGitPlatforms(): GitPlatformInfo[] {
  const config = readConfig();
  const platforms: GitPlatformInfo[] = [
    {
      id: 'github',
      name: 'GitHub',
      icon: 'github',
      baseUrl: 'https://github.com',
      enabled: config.sync?.github?.enabled ?? false,
      configured: !!getLazyGitHubToken(),
      username: config.sync?.github?.username,
      repo: config.sync?.github?.repo,
      branch: config.sync?.github?.branch ?? 'main',
    },
    {
      id: 'gitee',
      name: 'Gitee',
      icon: 'gitee',
      baseUrl: 'https://gitee.com',
      enabled: config.sync?.gitee?.enabled ?? false,
      configured: !!getGiteeToken(),
      username: config.sync?.gitee?.username,
      repo: config.sync?.gitee?.repo,
      branch: config.sync?.gitee?.branch ?? 'master',
    },
  ];
  return platforms;
}

/**
 * 获取指定平台的配置
 */
export function getGitPlatformConfig(platform: GitPlatform): GitPlatformConfig | undefined {
  const config = readConfig();
  return config.sync?.[platform];
}

/**
 * 设置 Git 平台配置
 */
export function setGitPlatformConfig(platform: GitPlatform, cfg: Partial<GitPlatformConfig>): void {
  const config = readConfig();
  const current = config.sync?.[platform] ?? { enabled: false };
  const updated = { ...current, ...cfg };

  updateConfig({
    sync: {
      ...config.sync,
      [platform]: updated,
    },
  });
}

/**
 * 设置 Git 平台 Token
 */
export function setGitPlatformToken(platform: GitPlatform, token: string): void {
  const config = readConfig();
  const current = config.sync?.[platform] ?? { enabled: false };

  updateConfig({
    sync: {
      ...config.sync,
      [platform]: {
        ...current,
        token,
      },
    },
  });
}

/**
 * 清除 Git 平台 Token
 */
export function removeGitPlatformToken(platform: GitPlatform): void {
  const config = readConfig();
  const current = config.sync?.[platform];
  if (!current) return;

  const { token: _, ...rest } = current;
  updateConfig({
    sync: {
      ...config.sync,
      [platform]: rest,
    },
  });
}

/**
 * 验证 Gitee Token 并获取用户信息
 */
export async function verifyGiteeToken(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch('https://gitee.com/api/v5/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: 'Token 无效或已过期' };
      }
      return { valid: false, error: `验证失败: HTTP ${response.status}` };
    }

    const data = await response.json() as { login: string };
    return { valid: true, username: data.login };
  } catch (e) {
    return { valid: false, error: `网络错误: ${(e as Error).message}` };
  }
}

/**
 * 获取当前启用的 Git 平台
 */
export function getActiveGitPlatform(): GitPlatform | null {
  const platforms = getGitPlatforms();
  const active = platforms.find(p => p.enabled);
  return active?.id ?? null;
}

/**
 * 设置代理配置
 */
export function setProxyConfig(enabled: boolean, url?: string): void {
  updateConfig({
    network: {
      proxy: {
        enabled,
        url: url || undefined,
      },
    },
  });
}

/**
 * 获取代理配置
 */
export function getProxyConfig(): ProxyConfig {
  const config = readConfig();
  return {
    enabled: config.network?.proxy?.enabled ?? false,
    url: config.network?.proxy?.url,
  };
}
