/**
 * Source 字符串解析模块
 *
 * 参考 TeleAgent source.ts，适配 PRD v1.2 的 source 格式规范。
 *
 * 支持格式：
 * 1. 本地路径:     /path/to/skill, ./skill, ~/skill
 * 2. GitHub 简写:  owner/repo, owner/repo/path/to/skill
 * 3. GitHub URL:   https://github.com/owner/repo, https://github.com/owner/repo/tree/branch/path
 * 4. GitHub SSH:   git@github.com:owner/repo.git
 * 5. 带前缀:       github:owner/repo, local:/path, git:https://...
 * 6. 带 ref 片段:  owner/repo#main, https://github.com/owner/repo#v1.0
 * 7. 带 skill 过滤: owner/repo#main?skill=pdf-processing
 */

import path from 'node:path';
import os from 'node:os';
import type { ParsedSource } from './types.js';

/**
 * 解析 source 字符串
 */
export function parseSource(source: string): ParsedSource {
  const trimmed = source.trim();

  // local: 前缀
  if (trimmed.startsWith('local:')) {
    return {
      type: 'local',
      url: null,
      owner: null,
      repo: null,
      skillPath: resolveLocalPath(trimmed.slice(6)),
      ref: null,
      skillFilter: null,
    };
  }

  // github: 前缀
  if (trimmed.startsWith('github:')) {
    return parseGitHubShorthand(trimmed.slice(7));
  }

  // git: 前缀
  if (trimmed.startsWith('git:')) {
    return {
      type: 'git',
      url: trimmed.slice(4),
      owner: null,
      repo: null,
      skillPath: null,
      ref: null,
      skillFilter: null,
    };
  }

  // 本地路径（绝对路径、相对路径、~开头）
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../') || trimmed.startsWith('~')) {
    return {
      type: 'local',
      url: null,
      owner: null,
      repo: null,
      skillPath: resolveLocalPath(trimmed),
      ref: null,
      skillFilter: null,
    };
  }

  // HTTPS URL
  if (trimmed.startsWith('https://')) {
    return parseHttpsUrl(trimmed);
  }

  // SSH URL (git@github.com:owner/repo.git)
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (sshMatch) {
    return {
      type: 'github',
      url: `https://github.com/${sshMatch[1]}/${sshMatch[2]}.git`,
      owner: sshMatch[1]!,
      repo: sshMatch[2]!,
      skillPath: null,
      ref: null,
      skillFilter: null,
    };
  }

  // GitHub 简写（owner/repo ...）
  const shorthandMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  if (shorthandMatch && !trimmed.includes('://')) {
    return parseGitHubShorthand(trimmed);
  }

  throw new Error(
    `无法解析 source: ${source}\n` +
    '支持格式: owner/repo, github:owner/repo, https://github.com/owner/repo, local:/path, ./path',
  );
}

/**
 * 解析 GitHub 简写格式
 *
 * 支持：
 * - owner/repo
 * - owner/repo/path/to/skill
 * - owner/repo#ref
 * - owner/repo/path#ref
 */
function parseGitHubShorthand(input: string): ParsedSource {
  let rest = input;
  let ref: string | null = null;

  // 提取 #ref 片段
  const hashIndex = rest.indexOf('#');
  if (hashIndex > 0) {
    ref = rest.slice(hashIndex + 1) || null;
    rest = rest.slice(0, hashIndex);
  }

  const parts = rest.split('/').filter(Boolean);
  const owner = parts[0] ?? null;
  const repo = parts[1] ?? null;
  const skillPath = parts.slice(2).join('/') || null;

  return {
    type: 'github',
    url: owner && repo ? `https://github.com/${owner}/${repo}.git` : null,
    owner,
    repo,
    skillPath,
    ref,
    skillFilter: null,
  };
}

/**
 * 解析 HTTPS URL
 */
function parseHttpsUrl(source: string): ParsedSource {
  let url = source;
  let ref: string | null = null;

  // 提取 #ref 片段
  const hashIndex = url.indexOf('#');
  if (hashIndex > 0) {
    ref = url.slice(hashIndex + 1) || null;
    url = url.slice(0, hashIndex);
  }

  // GitHub URL
  const githubMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (githubMatch) {
    const owner = githubMatch[1]!;
    const repo = githubMatch[2]!;

    // 检查 /tree/branch/path 格式
    let skillPath: string | null = null;
    const treeMatch = url.match(/github\.com\/[^/]+\/[^/]+\/tree\/([^/]+)\/?(.*)/);
    if (treeMatch) {
      ref = treeMatch[1]!;
      skillPath = treeMatch[2] || null;
    }

    return {
      type: 'github',
      url: `https://github.com/${owner}/${repo}.git`,
      owner,
      repo,
      skillPath,
      ref,
      skillFilter: null,
    };
  }

  // GitLab URL
  const gitlabMatch = url.match(/gitlab\.com\/([^/]+)\/([^/]+)/);
  if (gitlabMatch) {
    return {
      type: 'git',
      url: url.endsWith('.git') ? url : `${url}.git`,
      owner: gitlabMatch[1]!,
      repo: gitlabMatch[2]!,
      skillPath: null,
      ref,
      skillFilter: null,
    };
  }

  // 其他 Git URL
  return {
    type: 'git',
    url: url.endsWith('.git') ? url : `${url}.git`,
    owner: null,
    repo: null,
    skillPath: null,
    ref,
    skillFilter: null,
  };
}

/**
 * 解析本地路径（展开 ~ 和相对路径）
 */
function resolveLocalPath(p: string): string {
  if (p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return path.resolve(p);
}

/**
 * 判断 source 是否为本地路径
 */
export function isLocalSource(source: string): boolean {
  return source.startsWith('/') || source.startsWith('./') || source.startsWith('../') ||
    source.startsWith('~') || source.startsWith('local:');
}

/**
 * 判断 source 是否为 GitHub 来源
 */
export function isGitHubSource(source: string): boolean {
  return source.startsWith('github:') || source.startsWith('https://github.com/') ||
    source.startsWith('git@github.com:') || /^\w+\/\w+/.test(source);
}
