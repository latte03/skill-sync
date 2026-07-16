/**
 * Gitee API 集成模块
 *
 * 参考 GitHub API 模块设计，适配 Gitee Open API。
 *
 * 核心设计：
 * 1. Trees API 一次请求获取整个仓库文件树
 * 2. Tree SHA 做变更检测
 * 3. 支持通过配置或环境变量获取 token
 * 4. 代理支持（复用 git-api.ts 的代理逻辑）
 *
 * 共享逻辑（PRIORITY_PREFIXES、树操作纯函数、代理管理、HTTP 工具）
 * 已提取到 git-api.ts，本模块仅保留 Gitee 平台特有逻辑。
 */

import { readConfig, readSecrets } from '../config.js';
import {
  findSkillMdPaths,
  getSkillFilePaths,
  getSkillTreeSha,
  getProxyUrl,
  resetProxyCache,
  fetchJsonWithProxy,
  downloadFileWithProxy,
} from './git-api.js';
import type { TreeNode, TreeResponse } from './types.js';

// 重新导出共享函数，保持现有导入路径兼容
export { findSkillMdPaths, getSkillFilePaths, getSkillTreeSha, getProxyUrl, resetProxyCache };

// Gitee API 常量
export const GITEE_API_BASE = 'https://gitee.com/api/v5';
export const GITEE_RAW_BASE = 'https://gitee.com';

// ==================== Token 管理 ====================

let _rateLimitedThisSession = false;
let _cachedToken: string | null | undefined = undefined;

/**
 * 获取 Gitee token
 *
 * 策略：
 * - 优先从 secrets.yaml 获取
 * - 其次从环境变量获取
 */
export function getGiteeToken(): string | null {
  if (_cachedToken !== undefined) return _cachedToken || null;

  // 1. 从 secrets 获取
  const secrets = readSecrets();
  if (secrets.GITEE_TOKEN) {
    _cachedToken = secrets.GITEE_TOKEN;
    return _cachedToken;
  }

  // 2. 兼容旧 config.yaml 中的 token；新写入不会再落到这里。
  const config = readConfig();
  if (config.sync?.gitee?.token) {
    _cachedToken = config.sync.gitee.token;
    return _cachedToken;
  }

  // 3. 环境变量
  const envToken = process.env.GITEE_TOKEN;
  if (envToken) {
    _cachedToken = envToken;
    return envToken;
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
 * Gitee API GET 请求（带 token + rate limit 处理）
 */
export async function giteeApiGet<T>(url: string, extraHeaders?: Record<string, string>): Promise<T | null> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'skill-sync',
    ...extraHeaders,
  };

  const token = getGiteeToken();
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const data = await fetchJsonWithProxy<T>(url, headers, 'Gitee API');
    return data;
  } catch (e: unknown) {
    const msg = (e as Error).message || '';

    // 检查是否是 rate limit 错误
    if (msg.includes('rate limit') || msg.includes('403')) {
      if (!_rateLimitedThisSession) {
        markRateLimited();
      }
    }
    return null;
  }
}

/**
 * 下载文件内容（raw.gitee.com）
 */
export async function downloadRawFile(owner: string, repo: string, filePath: string, ref = 'HEAD'): Promise<string> {
  // Gitee raw 文件 URL 格式: https://gitee.com/{owner}/{repo}/raw/{ref}/{path}
  const url = `${GITEE_RAW_BASE}/${owner}/${repo}/raw/${ref}/${filePath}`;
  return downloadFileWithProxy(url);
}

// ==================== Trees API ====================

interface GiteeTreeResponse {
  sha: string;
  tree: Array<{
    path: string;
    mode: string;
    type: string;
    sha: string;
    size?: number;
  }>;
  truncated: boolean;
}

/**
 * 获取仓库的完整文件树（一次 API 请求）
 *
 * GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1
 */
export async function getRepoTree(owner: string, repo: string, ref = 'HEAD'): Promise<TreeResponse | null> {
  // 先获取分支的 HEAD sha
  let sha = ref;
  if (ref === 'HEAD') {
    const branchData = await giteeApiGet<{ commit?: { sha?: string } }>(
      `${GITEE_API_BASE}/repos/${owner}/${repo}/branches/master`
    );
    if (branchData?.commit?.sha) {
      sha = branchData.commit.sha;
    } else {
      // 尝试 main 分支
      const mainData = await giteeApiGet<{ commit?: { sha?: string } }>(
        `${GITEE_API_BASE}/repos/${owner}/${repo}/branches/main`
      );
      if (mainData?.commit?.sha) {
        sha = mainData.commit.sha;
      }
    }
  }

  const url = `${GITEE_API_BASE}/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`;
  const data = await giteeApiGet<GiteeTreeResponse>(url);

  if (!data || !data.tree) return null;

  if (data.truncated) {
    return null;
  }

  // 转换为标准 TreeResponse 格式
  return {
    sha: data.sha,
    tree: data.tree.map(item => ({
      path: item.path,
      mode: item.mode,
      type: item.type as 'blob' | 'tree' | 'commit',
      sha: item.sha,
      size: item.size,
    })),
    truncated: data.truncated,
  };
}

// ==================== 仓库信息 ====================

/**
 * 获取仓库默认分支
 */
export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const data = await giteeApiGet<{ default_branch?: string }>(`${GITEE_API_BASE}/repos/${owner}/${repo}`);
  return data?.default_branch || 'master';
}

/**
 * 获取分支最新 commit hash
 */
export async function getLatestCommitHash(owner: string, repo: string, branch?: string): Promise<string | null> {
  const ref = branch || await getDefaultBranch(owner, repo);
  const data = await giteeApiGet<{ commit?: { sha?: string } }>(
    `${GITEE_API_BASE}/repos/${owner}/${repo}/branches/${ref}`
  );
  return data?.commit?.sha ?? null;
}

/**
 * 获取所有 Tags（用于版本检查）
 */
export async function getRepoTags(owner: string, repo: string): Promise<Array<{ name: string; sha: string }>> {
  const data = await giteeApiGet<Array<{ name: string; commit: { sha: string } }>>(
    `${GITEE_API_BASE}/repos/${owner}/${repo}/tags`
  );
  if (!data) return [];
  return data.map(t => ({ name: t.name, sha: t.commit.sha }));
}

/**
 * 获取用户信息
 */
export async function getUserInfo(): Promise<{ login: string; avatar_url?: string } | null> {
  const token = getGiteeToken();
  if (!token) return null;

  return giteeApiGet<{ login: string; avatar_url?: string }>(
    `${GITEE_API_BASE}/user`,
    { 'Authorization': `token ${token}` }
  );
}
