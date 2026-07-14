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
 */

import { execSync } from 'node:child_process';
import { GITHUB_API_BASE, GITHUB_RAW_BASE } from './constants.js';
import { getGitHubToken as getConfigToken } from '../config.js';
import type { TreeNode, TreeResponse } from './types.js';

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

// ==================== 代理检测 ====================

let _cachedProxy: string | null | undefined = undefined;

/**
 * 获取代理 URL
 *
 * 优先级：
 * 1. HTTPS_PROXY / HTTP_PROXY 环境变量
 * 2. 自动检测常见代理端口（Clash 等）
 */
export function getProxyUrl(): string | null {
  if (_cachedProxy !== undefined) return _cachedProxy;

  // 1. 环境变量
  const envProxy = process.env.HTTPS_PROXY || process.env.https_proxy ||
    process.env.HTTP_PROXY || process.env.http_proxy;
  if (envProxy) {
    _cachedProxy = envProxy;
    return envProxy;
  }

  // 2. 自动检测常见代理端口
  for (const port of [7890, 7891, 7892, 7893, 1080]) {
    try {
      execSync(`curl -s --proxy http://127.0.0.1:${port} --connect-timeout 3 -o /dev/null https://api.github.com`, {
        stdio: 'pipe',
        timeout: 5000,
      });
      _cachedProxy = `http://127.0.0.1:${port}`;
      return _cachedProxy;
    } catch {
      // not available
    }
  }

  _cachedProxy = null;
  return null;
}

/**
 * 重置代理缓存（测试用）
 */
export function resetProxyCache(): void {
  _cachedProxy = undefined;
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
    const data = await fetchJson<T>(url, headers);
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
            return await fetchJson<T>(url, headers);
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
 * fetch JSON（带代理支持）
 */
async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const proxyUrl = getProxyUrl();

  // Node 24+ 支持全局 dispatcher 代理
  const fetchOptions: RequestInit & { dispatcher?: unknown } = {
    headers,
    signal: AbortSignal.timeout(15000),
  };

  if (proxyUrl) {
    // 使用 undici 的 ProxyAgent（Node 24+ 内置）
    try {
      // @ts-ignore — undici is built-in but lacks type declarations
      const { ProxyAgent } = await import('undici');
      fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
    } catch {
      // undici 不可用，回退到无代理
    }
  }

  const response = await fetch(url, fetchOptions as RequestInit);

  if (!response.ok) {
    const text = await response.text();
    const data = JSON.parse(text);
    if (data.message) {
      if (data.message.includes('rate limit')) {
        throw new Error(`GitHub API 限流: ${data.message}`);
      }
      if (data.message !== 'Not Found') {
        throw new Error(`GitHub API 错误: ${data.message}`);
      }
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * 下载文件内容（raw.githubusercontent.com）
 */
export async function downloadRawFile(owner: string, repo: string, filePath: string, ref = 'HEAD'): Promise<string> {
  const url = `${GITHUB_RAW_BASE}/${owner}/${repo}/${ref}/${filePath}`;
  const proxyUrl = getProxyUrl();

  const fetchOptions: RequestInit & { dispatcher?: unknown } = {
    signal: AbortSignal.timeout(15000),
  };

  if (proxyUrl) {
    try {
      // @ts-ignore — undici is built-in but lacks type declarations
      const { ProxyAgent } = await import('undici');
      fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
    } catch {
      // ignore
    }
  }

  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    throw new Error(`下载失败: ${url} (HTTP ${response.status})`);
  }
  return response.text();
}

// ==================== Trees API ====================

/** 优先搜索的 SKILL.md 目录前缀 */
const PRIORITY_PREFIXES = [
  '',                      // 仓库根
  'skills/',               // 最常见
  'skills/.curated/',
  'skills/.experimental/',
  '.agents/skills/',
  '.claude/skills/',
  '.codex/skills/',
  '.cursor/skills/',
  '.github/skills/',
  '.qoder/skills/',
  '.windsurf/skills/',
  '.aider/skills/',
  '.cline/skills/',
  '.room/skills/',
  '.amp/skills/',
  '.goose/skills/',
  '.opencode/skills/',
  '.roo/skills/',
  '.kiro/skills/',
];

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

/**
 * 从仓库文件树中发现所有 SKILL.md 路径
 */
export function findSkillMdPaths(tree: TreeNode[]): Array<{ path: string; name: string }> {
  const skillMdNodes = tree.filter(n => n.type === 'blob' && n.path.endsWith('/SKILL.md'));

  const rootSkillMd = tree.find(n => n.type === 'blob' && n.path === 'SKILL.md');
  if (rootSkillMd) {
    skillMdNodes.push(rootSkillMd);
  }

  const skills = skillMdNodes.map(node => {
    let dirPath: string;
    let name: string;

    if (node.path === 'SKILL.md') {
      dirPath = '';
      name = '';
    } else {
      dirPath = node.path.replace(/\/SKILL\.md$/, '');
      name = dirPath.split('/').pop()!;
    }

    return { path: dirPath, name, node };
  });

  skills.sort((a, b) => {
    const aIdx = PRIORITY_PREFIXES.findIndex(p => a.path.startsWith(p));
    const bIdx = PRIORITY_PREFIXES.findIndex(p => b.path.startsWith(p));
    const ai = aIdx === -1 ? PRIORITY_PREFIXES.length : aIdx;
    const bi = bIdx === -1 ? PRIORITY_PREFIXES.length : bIdx;
    return ai - bi;
  });

  return skills.map(s => ({ path: s.path, name: s.name }));
}

/**
 * 获取 skill 目录的 tree SHA
 */
export function getSkillTreeSha(tree: TreeNode[], skillPath: string): string | null {
  const node = tree.find(n => n.type === 'tree' && n.path === skillPath);
  return node?.sha ?? null;
}

/**
 * 获取 skill 目录下的所有文件路径
 */
export function getSkillFilePaths(tree: TreeNode[], skillPath: string): string[] {
  const prefix = skillPath ? `${skillPath}/` : '';
  return tree
    .filter(n => n.type === 'blob' && n.path.startsWith(prefix) && (skillPath || !n.path.includes('/')))
    .map(n => skillPath ? n.path.slice(prefix.length) : n.path);
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
