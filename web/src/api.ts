/**
 * API 客户端 — 与 Hono 后端通信
 *
 * skill 的唯一标识为不透明 SkillKey：本地为规范化相对路径，GitHub 为 owner/repo/skill-path，
 * 始终通过 URLSearchParams 作为一个不透明字符串传给 query 参数 name。
 * 不将斜杠拆成路径段，避免 %2F 在不同框架/代理下被歧义处理。
 * 不将 key 拆成来源、目录或显示名称；来源元数据由 API 单独返回。
 */

const API_BASE = '/api';

/** 把多个 key/value 安全编码成 query string */
function qs(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      if (v.length) search.set(k, v.join(','));
    } else {
      search.set(k, v);
    }
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

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

// ─── 共享类型（从后端 types.ts 导入并重导出） ─────────

import type {
  SkillInfo,
  SkillDetail as CoreSkillDetail,
  SkillSource,
  SearchResult,
  UpdateCheckResult,
  SyncResult,
  SyncStatusInfo,
  ConflictInfo,
  AgentInfo,
  StatusInfo,
  AIProviderInfo,
  GitPlatformInfo,
  ProxyConfig,
  GitCommitInfo,
} from '../../src/lib/types.js';

export type {
  SkillInfo,
  SkillSource,
  SearchResult,
  UpdateCheckResult,
  SyncResult,
  SyncStatusInfo,
  ConflictInfo,
  AgentInfo,
  StatusInfo,
  AIProviderInfo,
  GitPlatformInfo,
  ProxyConfig,
};

// GitCommitInfo 重导出为 SyncCommit（前端历史命名）
export type SyncCommit = GitCommitInfo;

// ─── 前端专属类型 ─────────────────────────────────────

/** /api/skill/detail 响应包装 */
export interface SkillDetail {
  skill: CoreSkillDetail;
  backups: Array<{ version: string; timestamp: string; dir: string }>;
  skillMd: string;
}

export interface AIProvidersResponse {
  providers: AIProviderInfo[];
  activeProvider: string | null;
  activeModel: string | null;
}

export interface GitPlatformsResponse {
  platforms: GitPlatformInfo[];
  active: 'github' | 'gitee' | null;
}

export interface SourceCandidate extends SearchResult {
  matchedQueries: string[];
}

export interface VerifiedGitHubSource {
  source: SkillSource;
  branch: string;
  treeSha: string | null;
  warning: string;
}

export interface SourceAssociationInput {
  source: string;
  skillId?: string;
  repo?: string;
  candidateName?: string;
}

export interface SkillDependencyReview {
  name: string;
  version: string;
  skillDependencies: Array<{ name: string; version: string; installed: boolean }>;
  packageDependencies: { npm?: string[]; pip?: string[] };
  requiresExplicitInstall: boolean;
}

export interface SkillFileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: SkillFileEntry[];
}

export interface SkillFileContent {
  path: string;
  content: string;
  size: number;
}

export interface DeployOptions {
  mode?: 'symlink' | 'copy';
  force?: boolean;
  dryRun?: boolean;
}

// ─── API 函数 ─────────────────────────────────────

export const api = {
  getStatus: () => request<StatusInfo>('/status'),

  getSkills: (params?: { agent?: string; tag?: string }) => {
    const query = new URLSearchParams();
    if (params?.agent) query.set('agent', params.agent);
    if (params?.tag) query.set('tag', params.tag);
    const q = query.toString();
    return request<{ skills: SkillInfo[] }>(`/skills${q ? '?' + q : ''}`);
  },

  getSkillDetail: (name: string) =>
    request<SkillDetail>(`/skill/detail${qs({ name })}`),

  getSkillFiles: (name: string) =>
    request<{ files: SkillFileEntry[] }>(`/skill/files${qs({ name })}`),

  getSkillFileContent: (name: string, filePath: string) =>
    request<SkillFileContent>(`/skill/file${qs({ name, path: filePath })}`),

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

  installSkill: (data: { source: string; skill?: string; agents?: string[]; mode?: 'symlink' | 'copy'; noDeploy?: boolean; installDeps?: boolean }) =>
    request<{ success: boolean }>('/skills/install', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deploySkill: (name: string, agents?: string[], options: DeployOptions = {}) =>
    request<{ success: boolean }>(`/skill/deploy${qs({ name, agents })}`, {
      method: 'POST',
      body: JSON.stringify({ agents, ...options }),
    }),

  undeploySkill: (name: string, agents?: string[], options: Pick<DeployOptions, 'dryRun'> = {}) =>
    request<{ success: boolean }>(`/skill/undeploy${qs({ name, agents })}`, {
      method: 'POST',
      body: JSON.stringify({ agents, ...options }),
    }),

  removeSkill: (name: string, scope?: 'central' | 'all' | 'agent', agent?: string) =>
    request<{ success: boolean }>(`/skill${qs({ name, scope, agent })}`, {
      method: 'DELETE',
    }),

  manageTag: (name: string, action: 'add' | 'remove', tag: string) =>
    request<{ success: boolean; tags: string[] }>(`/skill/tags${qs({ name })}`, {
      method: 'POST',
      body: JSON.stringify({ action, tag }),
    }),

  getConflicts: () => request<{ conflicts: ConflictInfo[] }>('/conflicts'),

  // ─── 来源关联、更新与依赖审查 ────────────────────────

  getSourceCandidates: (name: string, limit?: number) =>
    request<{ candidates: SourceCandidate[] }>(`/skill/source-candidates${qs({ name, limit: limit ? String(limit) : undefined })}`),

  verifySourceCandidate: (input: SourceAssociationInput) =>
    request<{ verified: VerifiedGitHubSource }>('/skill/source-candidates/verify', {
      method: 'POST', body: JSON.stringify(input),
    }),

  associateSource: (name: string, input: SourceAssociationInput) =>
    request<{ success: boolean; source: VerifiedGitHubSource['source']; branch: string; warning: string }>(`/skill/source-association${qs({ name })}`, {
      method: 'POST', body: JSON.stringify(input),
    }),

  checkSkillUpdate: (name: string) =>
    request<{ result: UpdateCheckResult }>(`/skill/update${qs({ name })}`),

  updateSkill: (name: string, options: { force?: boolean; noBackup?: boolean } = {}) =>
    request<{ success: boolean; result: { name: string; success: boolean; oldVersion: string; newVersion: string; backupDir?: string; error?: string } }>(`/skill/update${qs({ name })}`, {
      method: 'POST', body: JSON.stringify(options),
    }),

  getSkillBackups: (name: string) =>
    request<{ backups: Array<{ id: string; version: string; timestamp: string; dir: string }> }>(`/skill/backups${qs({ name })}`),

  getDependencyReview: (name: string) =>
    request<{ review: SkillDependencyReview }>(`/skill/dependencies${qs({ name })}`),

  installReviewedDependencies: (name: string, managers?: Array<'npm' | 'pip'>) =>
    request<{ success: boolean; review: SkillDependencyReview; installedManagers: Array<'npm' | 'pip'> }>(`/skill/dependencies/install${qs({ name })}`, {
      method: 'POST', body: JSON.stringify(managers ? { managers } : {}),
    }),

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

  // ─── Git 平台身份凭证 ───────────────────────────────

  getGitPlatforms: () => request<GitPlatformsResponse>('/git/platforms'),

  enableGitPlatform: (platform: string, enabled: boolean) =>
    request<{ success: boolean }>(`/git/platforms/${platform}/enable`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),

  setGitPlatformToken: (platform: string, token: string, username?: string) =>
    request<{ success: boolean }>(`/git/platforms/${platform}/token`, {
      method: 'POST',
      body: JSON.stringify({ token, username }),
    }),

  removeGitPlatformToken: (platform: string) =>
    request<{ success: boolean }>(`/git/platforms/${platform}/token`, {
      method: 'DELETE',
    }),

  setGitPlatformRepo: (platform: string, repo?: string, branch?: string) =>
    request<{ success: boolean }>(`/git/platforms/${platform}/repo`, {
      method: 'POST',
      body: JSON.stringify({ repo, branch }),
    }),

  // ─── 网络代理配置 ────────────────────────────────────

  getProxyConfig: () => request<ProxyConfig>('/network/proxy'),

  setProxyConfig: (enabled: boolean, url?: string) =>
    request<{ success: boolean }>('/network/proxy', {
      method: 'POST',
      body: JSON.stringify({ enabled, url }),
    }),
};
