/**
 * Search 模块 — 本地模糊搜索 + skills.sh API 搜索
 *
 * 参考 PRD §8 skills.sh 集成方案 + §7 search 命令规范
 *
 * 搜索 API: GET https://skills.sh/api/search?q={query}
 * 返回 JSON: { source, skill_id, name, description, stars, installs }
 */

import { SKILLS_SH_API_BASE } from './constants.js';
import { readLock } from './lock.js';
import { readManifest } from './manifest.js';
import { getProxyUrl } from './github.js';
import type { SearchResult } from './types.js';

// ==================== 本地搜索 ====================

/**
 * 本地模糊搜索
 *
 * 搜索范围：skill 名称 + 描述
 * 匹配方式：大小写不敏感的子串匹配
 */
export function searchLocal(query: string, limit = 20): SearchResult[] {
  const lock = readLock();
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const [fullName, entry] of Object.entries(lock.skills)) {
    const [namespace, skillName] = fullName.split('/');
    if (!namespace || !skillName) continue;

    let description = '';
    let tags: string[] = [];
    try {
      const manifest = readManifest(namespace, skillName);
      description = manifest.description ?? '';
      tags = manifest.tags ?? [];
    } catch {
      // manifest 可能不存在
    }

    // 模糊匹配
    const nameMatch = fullName.toLowerCase().includes(q);
    const descMatch = description.toLowerCase().includes(q);
    const tagMatch = tags.some(t => t.toLowerCase().includes(q));

    if (nameMatch || descMatch || tagMatch) {
      results.push({
        source: 'local',
        skillId: fullName,
        name: fullName,
        description,
        isLocal: true,
        localVersion: entry.version,
      });
    }
  }

  // 按相关度排序（名称匹配优先）
  results.sort((a, b) => {
    const aName = a.name.toLowerCase().includes(q) ? 0 : 1;
    const bName = b.name.toLowerCase().includes(q) ? 0 : 1;
    return aName - bName;
  });

  return results.slice(0, limit);
}

// ==================== skills.sh 远程搜索 ====================

/** skills.sh API 返回的原始数据结构 */
interface SkillsShResult {
  source?: string;
  skill_id?: string;
  skillId?: string;
  name?: string;
  description?: string;
  stars?: number;
  installs?: number;
  repo?: string;
  id?: string;
}

/** skills.sh API 顶层响应结构 */
interface SkillsShResponse {
  query?: string;
  searchType?: string;
  skills?: SkillsShResult[];
  results?: SkillsShResult[];
}

/**
 * skills.sh API 搜索
 *
 * GET https://skills.sh/api/search?q={query}
 */
export async function searchRemote(query: string, limit = 20): Promise<SearchResult[]> {
  const url = `${SKILLS_SH_API_BASE}/search?q=${encodeURIComponent(query)}`;
  const proxyUrl = getProxyUrl();

  const fetchOptions: RequestInit & { dispatcher?: unknown } = {
    headers: { Accept: 'application/json' },
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

  try {
    const response = await fetch(url, fetchOptions as RequestInit);
    if (!response.ok) {
      return [];
    }

    const data = await response.json() as SkillsShResult[] | SkillsShResponse;

    // API 可能返回数组、{ skills: [...] } 或 { results: [...] }
    let items: SkillsShResult[];
    if (Array.isArray(data)) {
      items = data;
    } else {
      items = data.skills ?? data.results ?? [];
    }

    // 转换为 SearchResult
    const results: SearchResult[] = items.map(item => ({
      source: item.source ?? 'unknown',
      skillId: item.skill_id ?? item.skillId ?? item.name ?? '',
      name: item.name ?? item.skill_id ?? item.skillId ?? '',
      description: item.description ?? '',
      stars: item.stars,
      installs: item.installs,
    }));

    return results.slice(0, limit);
  } catch {
    // 网络错误返回空结果
    return [];
  }
}

// ==================== 综合搜索 ====================

/**
 * 综合搜索：本地 + skills.sh
 *
 * 本地结果排在前面，远程结果排在后面
 */
export async function searchAll(query: string, opts?: {
  localOnly?: boolean;
  remoteOnly?: boolean;
  limit?: number;
}): Promise<{ local: SearchResult[]; remote: SearchResult[] }> {
  const limit = opts?.limit ?? 20;

  const localPromise = (opts?.remoteOnly) ? Promise.resolve([]) : Promise.resolve(searchLocal(query, limit));
  const remotePromise = (opts?.localOnly) ? Promise.resolve([]) : searchRemote(query, limit);

  const [local, remote] = await Promise.all([localPromise, remotePromise]);

  return { local, remote };
}
