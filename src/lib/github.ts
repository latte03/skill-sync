/**
 * GitHub API 集成模块
 *
 * 参考 TeleAgent github.ts，适配 PRD v1.2。
 *
 * 核心设计：
 * 1. Trees API 一次请求获取整个仓库文件树（替代递归 Contents API）
 * 2. Tree SHA 做变更检测（比 commit hash 更精准）
 * 3. Lazy token 管理（仅在 rate limit 后尝试获取 token）
 * 4. 代理检测（环境变量 + 常见端口自动检测）
 * 5. 使用 Node.js 原生 fetch（Node 24+ 内置），替代 curl
 *
 * 共享逻辑（PRIORITY_PREFIXES、树操作纯函数、代理管理、HTTP 工具）
 * 已提取到 git-api.ts，本模块仅保留 GitHub 平台特有逻辑。
 */

import { execSync } from 'node:child_process';
import { GITHUB_API_BASE, GITHUB_RAW_BASE } from './constants.js';
import { getGitHubToken as getConfigToken } from '../config.js';
import {
  findSkillMdPaths,
  getSkillFilePaths,
  getSkillTreeSha,
  getProxyUrl,
  isProxyEnabled,
  resetProxyCache,
  fetchJsonWithProxy,
  downloadFileWithProxy,
} from './git-api.js';
import type { TreeNode, TreeResponse } from './types.js';

// 重新导出共享函数，保持现有导入路径兼容
export { findSkillMdPaths, getSkillFilePaths, getSkillTreeSha, getProxyUrl, isProxyEnabled, resetProxyCache };

// ==================== Lazy Token 管理 ====================

let _rateLimitedThisSession = false;
let _cachedToken: string | null | undefined = undefined;

/**
 * 懒加载 GitHub token
 *
 * 策略（参考 vercel-labs/skills）：
 * - 优先从 secrets.yaml / 环境变量获取
 * - 仅在收到 rate limit 响应后，才尝试 gh auth token
 */
export function getLazyGitHubToken(): string | null {
  if (_cachedToken !== undefined) return _cachedToken || null;

  // 1. 从 config/secrets 获取（包含环境变量回退）
  const configToken = getConfigToken();
  if (configToken) {
    _cachedToken = configToken;
    return configToken;
  }

  // 2. 非 rate limit 场景不主动调用 gh auth token
  if (!_rateLimitedThisSession) return null;

  // 3. rate limit 后尝试 gh auth token
  try {
    const token = execSync('gh auth token', {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (token) {
      _cachedToken = token;
      return token;
    }
  } catch {
    // gh CLI 不可用或未登录
  }

  _cachedToken = null;
  return null;
}

/**
 * 标记本次会话收到了 rate limit 响应
 */
export function markRateLimited(): void {
  _rateLimitedThisSession = true;
}

/**
 * 重置 token 缓存（测试用）
 */
export function resetTokenCache(): void {
  _cachedToken = undefined;
  _rateLimitedThisSession = false;
}

// ==================== HTTP 工具 ====================

/**
 * GitHub API GET 请求（带 lazy token + rate limit 处理）
 *
 * 使用 Node.js 原生 fetch（Node 24+ 内置）
 */
export async function githubApiGet<T>(url: string, extraHeaders?: Record<string, string>): Promise<T | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'skill-sync',
    ...extraHeaders,
  };

  const token = getLazyGitHubToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const data = await fetchJsonWithProxy<T>(url, headers, 'GitHub API');
    return data;
  } catch (e: unknown) {
    const msg = (e as Error).message || '';

    // 检查是否是 rate limit 错误
    if (msg.includes('rate limit') || msg.includes('403')) {
      if (!_rateLimitedThisSession) {
        markRateLimited();

        // 重试（这次会尝试用 token）
        const retryToken = getLazyGitHubToken();
        if (retryToken) {
          headers['Authorization'] = `Bearer ${retryToken}`;
          try {
            return await fetchJsonWithProxy<T>(url, headers, 'GitHub API');
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }
}

/**
 * 下载文件内容（raw.githubusercontent.com）
 */
export async function downloadRawFile(owner: string, repo: string, filePath: string, ref = 'HEAD'): Promise<string> {
  const url = `${GITHUB_RAW_BASE}/${owner}/${repo}/${ref}/${filePath}`;
  return downloadFileWithProxy(url);
}

// ==================== Trees API ====================

/**
 * 获取仓库的完整文件树（一次 API 请求）
 *
 * GET /repos/{owner}/{repo}/git/trees/{ref}?recursive=1
 */
export async function getRepoTree(owner: string, repo: string, ref = 'HEAD'): Promise<TreeResponse | null> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;
  const data = await githubApiGet<TreeResponse>(url);

  if (!data || !data.tree) return null;

  if (data.truncated) {
    return null;
  }

  return data;
}

// ==================== 仓库信息 ====================

/**
 * 获取仓库默认分支
 */
export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const data = await githubApiGet<{ default_branch?: string }>(`${GITHUB_API_BASE}/repos/${owner}/${repo}`);
  return data?.default_branch || 'main';
}

/**
 * 获取分支最新 commit hash
 */
export async function getLatestCommitHash(owner: string, repo: string, branch?: string): Promise<string | null> {
  const ref = branch || await getDefaultBranch(owner, repo);
  const data = await githubApiGet<{ sha?: string }>(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${ref}`);
  return data?.sha ?? null;
}

/**
 * 获取所有 Tags（用于版本检查）
 */
export async function getRepoTags(owner: string, repo: string): Promise<Array<{ name: string; sha: string }>> {
  const data = await githubApiGet<Array<{ name: string; commit: { sha: string } }>>(`${GITHUB_API_BASE}/repos/${owner}/${repo}/tags`);
  if (!data) return [];
  return data.map(t => ({ name: t.name, sha: t.commit.sha }));
}
