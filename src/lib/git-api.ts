/**
 * Git 平台 API 共享模块
 *
 * 提取 GitHub / Gitee 共用的纯函数与 HTTP 工具，消除重复代码。
 *
 * 共享内容：
 * 1. PRIORITY_PREFIXES 常量
 * 2. 树操作纯函数：findSkillMdPaths / getSkillTreeSha / getSkillFilePaths
 * 3. 代理管理：getProxyUrl / isProxyEnabled / resetProxyCache
 * 4. HTTP 工具：fetchJsonWithProxy / downloadFileWithProxy
 */

import { execSync } from 'node:child_process';
import { readConfig } from '../config.js';
import type { TreeNode } from './types.js';

// ==================== 常量 ====================

/** 优先搜索的 SKILL.md 目录前缀 */
export const PRIORITY_PREFIXES = [
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

// ==================== 树操作纯函数 ====================

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

// ==================== 代理管理（共享） ====================

let _cachedProxy: string | null | undefined = undefined;

/**
 * 获取代理 URL
 *
 * 优先级：
 * 1. 配置文件中的代理设置（如果启用）
 * 2. HTTPS_PROXY / HTTP_PROXY 环境变量
 * 3. 自动检测常见代理端口（Clash 等）
 */
export function getProxyUrl(): string | null {
  if (_cachedProxy !== undefined) return _cachedProxy;

  // 1. 配置文件中的代理设置（如果启用）
  const config = readConfig();
  if (config.network?.proxy?.enabled && config.network.proxy.url) {
    _cachedProxy = config.network.proxy.url;
    return _cachedProxy;
  }

  // 2. 环境变量
  const envProxy = process.env.HTTPS_PROXY || process.env.https_proxy ||
    process.env.HTTP_PROXY || process.env.http_proxy;
  if (envProxy) {
    _cachedProxy = envProxy;
    return envProxy;
  }

  // 3. 自动检测常见代理端口
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
 * 检查代理是否已启用（通过配置或环境变量）
 */
export function isProxyEnabled(): boolean {
  const config = readConfig();
  if (config.network?.proxy?.enabled) {
    return true;
  }
  // 检查环境变量
  return !!(process.env.HTTPS_PROXY || process.env.https_proxy ||
    process.env.HTTP_PROXY || process.env.http_proxy);
}

/**
 * 重置代理缓存（测试用）
 */
export function resetProxyCache(): void {
  _cachedProxy = undefined;
}

// ==================== HTTP 工具（共享） ====================

/**
 * fetch JSON（带代理支持）
 *
 * @param platformName 平台名称，用于错误消息（如 "GitHub API"、"Gitee API"）
 */
export async function fetchJsonWithProxy<T>(
  url: string,
  headers?: Record<string, string>,
  platformName = 'Git',
): Promise<T> {
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
    let data: { message?: string } = {};
    try {
      data = JSON.parse(text);
    } catch {
      // ignore parse error
    }
    if (data.message) {
      if (data.message.includes('rate limit')) {
        throw new Error(`${platformName} 限流: ${data.message}`);
      }
      if (data.message !== 'Not Found') {
        throw new Error(`${platformName} 错误: ${data.message}`);
      }
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * 下载文件内容（带代理支持）
 */
export async function downloadFileWithProxy(url: string): Promise<string> {
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
