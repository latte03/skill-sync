/**
 * API 客户端 — 与 Hono 后端通信
 */

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ─── 类型定义 ─────────────────────────────────────

export interface SkillInfo {
  name: string;
  namespace: string;
  skillName: string;
  version: string;
  description: string;
  tags: string[];
  deployMode: string;
  agents: string[];
  managed: boolean;
}

export interface SkillDetail {
  skill: SkillInfo;
  backups: Array<{ version: string; timestamp: string; dir: string }>;
}

export interface SearchResult {
  source: string;
  skillId: string;
  name: string;
  description: string;
  stars?: number;
  installs?: number;
  isLocal?: boolean;
  localVersion?: string;
}

export interface StatusInfo {
  homeDir: string;
  skillCount: number;
  managedCount: number;
  unmanagedCount: number;
  agents: Array<{ agent: string; managed: number; unmanaged: number; total: number }>;
  installedAgents: string[];
}

export interface AgentInfo {
  name: string;
  displayName: string;
  skillsDir: string;
  installed: boolean;
}

export interface UpdateCheckResult {
  name: string;
  currentVersion: string;
  remoteVersion: string | null;
  hasUpdate: boolean;
  isLocal: boolean;
}

// ─── API 函数 ─────────────────────────────────────

export const api = {
  getStatus: () => request<StatusInfo>('/status'),

  getSkills: (params?: { agent?: string; tag?: string }) => {
    const query = new URLSearchParams();
    if (params?.agent) query.set('agent', params.agent);
    if (params?.tag) query.set('tag', params.tag);
    const qs = query.toString();
    return request<{ skills: SkillInfo[] }>(`/skills${qs ? '?' + qs : ''}`);
  },

  getSkillDetail: (name: string) =>
    request<SkillDetail>(`/skills/${encodeURIComponent(name)}`),

  search: (query: string, scope?: 'all' | 'local' | 'remote', limit?: number) => {
    const params = new URLSearchParams({ q: query });
    if (scope) params.set('scope', scope);
    if (limit) params.set('limit', String(limit));
    return request<{ local: SearchResult[]; remote: SearchResult[] }>(`/search?${params}`);
  },

  getAgents: () => request<{ agents: AgentInfo[] }>('/agents'),

  getTags: () => request<{ tags: Record<string, string[]> }>('/tags'),

  checkUpdates: (name?: string) => {
    const qs = name ? `?name=${encodeURIComponent(name)}` : '';
    return request<{ results: UpdateCheckResult[] }>(`/check${qs}`);
  },

  installSkill: (data: { source: string; skill?: string; agents?: string[]; mode?: string }) =>
    request<{ success: boolean }>('/skills/install', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deploySkill: (name: string, agents?: string[]) => {
    const qs = agents ? `?agents=${agents.join(',')}` : '';
    return request<{ success: boolean }>(`/skills/${encodeURIComponent(name)}/deploy${qs}`, {
      method: 'POST',
    });
  },

  undeploySkill: (name: string, agents?: string[]) => {
    const qs = agents ? `?agents=${agents.join(',')}` : '';
    return request<{ success: boolean }>(`/skills/${encodeURIComponent(name)}/undeploy${qs}`, {
      method: 'POST',
    });
  },

  removeSkill: (name: string, scope?: 'central' | 'all') => {
    const qs = scope ? `?scope=${scope}` : '';
    return request<{ success: boolean }>(`/skills/${encodeURIComponent(name)}${qs}`, {
      method: 'DELETE',
    });
  },
};
