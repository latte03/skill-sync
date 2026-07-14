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
  skillMd: string;
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

export interface ConflictInfo {
  skillName: string;
  agent: string;
  destPath: string;
  type: 'managed-mismatch' | 'unmanaged' | 'broken-symlink';
  detail: string;
}

// ─── Git 同步类型 ──────────────────────────────────

export interface SyncStatusInfo {
  isRepo: boolean;
  hasRemote: boolean;
  uncommittedChanges: number;
  ahead: number;
  behind: number;
  remotes: Array<{ name: string; fetchUrl: string; pushUrl: string }>;
  branch: string | null;
  tracking: string | null;
  changedFiles: Array<{ path: string; status: string }>;
}

export interface SyncCommit {
  hash: string;
  date: string;
  message: string;
  author: string;
  refs: string;
}

export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  conflicts: string[];
  error?: string;
}

// ─── AI 提供商类型 ──────────────────────────────────

export interface AIProviderInfo {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  defaultModel: string;
  iconColor?: string;
  custom?: boolean;
  hasKey: boolean;
  isActive: boolean;
}

export interface AIProvidersResponse {
  providers: AIProviderInfo[];
  activeProvider: string | null;
  activeModel: string | null;
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

  manageTag: (name: string, action: 'add' | 'remove', tag: string) =>
    request<{ success: boolean; tags: string[] }>(`/skills/${encodeURIComponent(name)}/tags`, {
      method: 'POST',
      body: JSON.stringify({ action, tag }),
    }),

  getConflicts: () => request<{ conflicts: ConflictInfo[] }>('/conflicts'),

  // ─── Git 同步 ─────────────────────────────────────

  getSyncStatus: () => request<SyncStatusInfo>('/sync/status'),

  getSyncLog: (limit?: number) => {
    const qs = limit ? `?limit=${limit}` : '';
    return request<{ commits: SyncCommit[] }>(`/sync/log${qs}`);
  },

  pushSync: (message?: string) =>
    request<SyncResult>('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  pullSync: (strategy?: string) =>
    request<SyncResult>('/sync/pull', {
      method: 'POST',
      body: JSON.stringify({ strategy }),
    }),

  initGit: () =>
    request<{ success: boolean }>('/sync/init', {
      method: 'POST',
    }),

  setRemote: (url: string, name?: string) =>
    request<{ success: boolean }>('/sync/remote', {
      method: 'POST',
      body: JSON.stringify({ url, name }),
    }),

  // ─── AI 提供商 ────────────────────────────────────────

  getAIProviders: () => request<AIProvidersResponse>('/ai/providers'),

  setActiveProvider: (provider: string, model: string) =>
    request<{ success: boolean }>('/ai/active', {
      method: 'POST',
      body: JSON.stringify({ provider, model }),
    }),

  setAPIKey: (provider: string, key: string) =>
    request<{ success: boolean }>('/ai/key', {
      method: 'POST',
      body: JSON.stringify({ provider, key }),
    }),

  removeAPIKey: (provider: string) =>
    request<{ success: boolean }>(`/ai/key/${encodeURIComponent(provider)}`, {
      method: 'DELETE',
    }),

  addCustomProvider: (data: { id: string; name: string; baseUrl: string; models: string[]; defaultModel: string; iconColor?: string }) =>
    request<{ success: boolean }>('/ai/custom', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeCustomProvider: (provider: string) =>
    request<{ success: boolean }>(`/ai/custom/${encodeURIComponent(provider)}`, {
      method: 'DELETE',
    }),

  generateCommitMessage: () =>
    request<{ message: string; fileCount: number }>('/ai/generate-commit', {
      method: 'POST',
    }),
};
