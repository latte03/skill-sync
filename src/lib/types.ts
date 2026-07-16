/**
 * 全局类型定义
 *
 * 参考 PRD-SkillSync v1.2 §4.5 核心类型定义
 */

// ==================== Skill 信息 ====================

export interface SkillInfo {
  /** skill 完整名称（如 anthropics/pdf-processing 或 tdd） */
  name: string;
  version: string;
  description: string;
  tags: string[];
  deployMode: DeployMode;
  /** 已分发到的 Agent 列表 */
  agents: string[];
  /** 是否纳入管理 */
  managed: boolean;
}

export interface SkillDetail extends SkillInfo {
  source: SkillSource;
  installedAt: string;
  updatedAt: string;
  distribution: DistributionTarget[];
  backups: BackupInfo[];
  dependencies?: Dependency[];
}

// ==================== 来源信息 ====================

export interface SkillSource {
  type: 'github' | 'local';
  /** GitHub owner. Kept separately so source data is lossless. */
  owner?: string;
  /** GitHub repository name, without owner. */
  repo?: string;
  /** Path of the skill directory inside the GitHub repository. */
  skillPath?: string;
  /** @deprecated Legacy alias for skillPath; read for persisted compatibility only. */
  path?: string;
  commit?: string;
  installedVia: 'cli' | 'init-scan';
}

// ==================== 分发信息 ====================

export type DeployMode = 'symlink' | 'junction' | 'copy';

/** 用户指定的分发模式（CLI 接口），symlink 在 Windows 自动使用 junction */
export type UserDeployMode = 'symlink' | 'copy';

export interface DistributionTarget {
  agent: string;
  path: string;
  mode: DeployMode;
  version: string;
  distributedAt: string;
  sourceHash: string;
  managed: boolean;
}

// ==================== 版本管理 ====================

export interface BackupInfo {
  id: number;
  version: string;
  timestamp: string;
  backupDir: string;
}

export interface UpdateCheckResult {
  name: string;
  currentVersion: string;
  remoteVersion: string | null;
  hasUpdate: boolean;
  /** 本地 skill 无远程源 */
  isLocal: boolean;
}

export interface UpdateResult {
  name: string;
  success: boolean;
  oldVersion: string;
  newVersion: string;
  backupDir?: string;
  error?: string;
}

// ==================== 安装/搜索 ====================

export interface InstallOpts {
  /** 指定 skill 名 */
  skill?: string;
  /** Git 引用 */
  ref?: string;
  /** 目标 Agent */
  agents?: string[];
  /** 用户指定的部署方式 */
  deployType?: UserDeployMode;
  noDeploy?: boolean;
  /** Explicitly install package dependencies declared by an untrusted Skill. */
  installDeps?: boolean;
  ignoreDeps?: boolean;
  yes?: boolean;
  /** Internal compatibility hook: preserve an existing legacy key during update. */
  targetKey?: string;
  /** Internal update hook: replace the existing SkillKey after a backup. */
  replaceExisting?: boolean;
}

export interface InstallResult {
  name: string;
  version: string;
  source: SkillSource;
  /** 已分发到的 Agent */
  deployed: string[];
}

export interface SearchResult {
  source: string;
  skillId: string;
  name: string;
  description: string;
  stars?: number;
  installs?: number;
  /** 本地搜索结果 */
  isLocal?: boolean;
  /** 如果已安装 */
  localVersion?: string;
}

// ==================== 同步 ====================

export interface SyncOpts {
  message?: string;
  strategy?: ConflictStrategy;
  dryRun?: boolean;
}

export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  conflicts: string[];
  error?: string;
}

export interface SyncStatus {
  isRepo: boolean;
  hasRemote: boolean;
  uncommittedChanges: number;
  ahead: number;
  behind: number;
  lastSync?: string;
}

export type ConflictStrategy = 'ours' | 'theirs' | 'manual' | 'newer' | 'skip';

// ==================== Git 信息查询（供 Web API 使用） ====================

export interface GitCommitInfo {
  hash: string;
  date: string;
  message: string;
  author: string;
  refs: string;
}

export interface GitRemoteInfo {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

export interface GitBranchInfo {
  current: string | null;
  tracking: string | null;
}

export type GitPlatform = 'github' | 'gitee';

export interface GitPlatformInfo {
  id: GitPlatform;
  name: string;
  icon: string;
  baseUrl: string;
  enabled: boolean;
  configured: boolean;
  username?: string;
  repo?: string;
  branch?: string;
}

// ==================== 网络代理 ====================

export interface ProxyConfig {
  enabled: boolean;
  url?: string;
}

// ==================== API 响应类型（前后端共享） ====================

/** 变更文件信息 */
export interface ChangedFile {
  path: string;
  status: string;
}

/** 同步状态详情（SyncStatus + Git 仓库信息），/api/sync/status 响应 */
export interface SyncStatusInfo extends SyncStatus {
  remotes: GitRemoteInfo[];
  branch: string | null;
  tracking: string | null;
  changedFiles: ChangedFile[];
}

/** 冲突信息，/api/conflicts 响应 */
export interface ConflictInfo {
  skillName: string;
  agent: string;
  destPath: string;
  type: 'managed-mismatch' | 'unmanaged' | 'broken-symlink';
  detail: string;
}

/** Agent 信息，/api/agents 响应 */
export interface AgentInfo {
  name: string;
  displayName: string;
  skillsDir: string;
  installed: boolean;
}

/** 全局状态信息，/api/status 响应 */
export interface StatusInfo {
  homeDir: string;
  skillCount: number;
  managedCount: number;
  unmanagedCount: number;
  agents: AgentStatus[];
  installedAgents: string[];
}

/** AI 提供商信息（含运行时状态），/api/ai/providers 响应 */
export interface AIProviderInfo extends AIProviderConfig {
  hasKey: boolean;
  isActive: boolean;
}

// ==================== 状态 ====================

export interface StatusReport {
  repoPath: string;
  repoClean: boolean;
  lastSync?: string;
  totalManaged: number;
  totalUnmanaged: number;
  agents: AgentStatus[];
  updatesAvailable: number;
  warnings: string[];
}

export interface AgentStatus {
  agent: string;
  managed: number;
  unmanaged: number;
  total: number;
}

// ==================== 删除/部署/更新选项 ====================

export type RemoveScope = 'all' | 'central' | 'agent';

export interface DeployOpts {
  /** 用户指定的部署方式 */
  mode?: UserDeployMode;
  force?: boolean;
  dryRun?: boolean;
}

export interface UpdateOpts {
  version?: string;
  noBackup?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

export interface SkillFilter {
  agent?: string;
  tag?: string;
  managed?: boolean;
}

// ==================== 依赖 ====================

export interface Dependency {
  name: string;
  /** SemVer range */
  version: string;
}

// ==================== AI 提供商 ====================

export interface AIProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  defaultModel: string;
  iconColor?: string;
  custom?: boolean;
}

export interface AIConfig {
  activeProvider?: string;
  activeModel?: string;
  customProviders?: AIProviderConfig[];
}

// ==================== 配置 ====================

export interface GitPlatformConfig {
  enabled: boolean;
  repo?: string;
  branch?: string;
  token?: string;
  username?: string;
}

export interface Config {
  defaultAgent?: string;
  distributionMode?: UserDeployMode;
  colorOutput?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  version?: {
    maxBackups?: number;
  };
  sync?: {
    github?: GitPlatformConfig;
    gitee?: GitPlatformConfig;
    autoCommit?: boolean;
    commitMessagePrefix?: string;
  };
  conflict?: {
    defaultStrategy?: ConflictStrategy;
  };
  agents?: Record<string, {
    path?: string;
    enabled?: boolean;
  }>;
  install?: {
    allowScripts?: 'none' | 'prompt' | 'always';
  };
  network?: {
    proxy?: {
      enabled: boolean;
      url?: string;
    };
    timeout?: number;
    retryCount?: number;
  };
  scanPaths?: string[];
  ai?: AIConfig;
}

// ==================== manifest.yaml ====================

export interface Manifest {
  name: string;
  description: string;
  source: {
    type: 'github' | 'local';
    /** GitHub owner. Kept separately so manifest source data is lossless. */
    owner?: string;
    /** GitHub repository name, without owner. */
    repo?: string;
    /** Path of the skill directory inside the repository. */
    skillPath?: string;
    /** @deprecated Legacy alias for skillPath. */
    path?: string;
    installedVia: 'cli' | 'init-scan';
  };
  currentVersion: string;
  initialVersion?: string;
  lastBackup?: {
    timestamp: string;
    fromVersion: string;
    backupDir: string;
  };
  tags?: string[];
  dependsOn?: Dependency[];
    distribution: {
    mode: DeployMode;
    targets: Array<{
      agent: string;
      path: string;
      mode: DeployMode;
      version: string;
      distributedAt: string;
      sourceHash: string;
      managed: boolean;
    }>;
  };
}

// ==================== skills-lock.json ====================

export interface LockFile {
  lockfileVersion: number;
  generatedAt: string;
  generator: string;
  skills: Record<string, LockEntry>;
}

export interface LockEntry {
  source: {
    type: 'github' | 'local';
    owner?: string;
    repo?: string;
    skillPath?: string;
    /** @deprecated Legacy alias for skillPath. */
    path?: string;
    commit?: string;
    installedVia?: 'cli' | 'init-scan';
  };
  version: string;
  installedAt: string;
  updatedAt: string;
  treeSha?: string;
  distribution: Record<string, {
    mode: DeployMode;
    distributedAt: string;
    sourceHash: string;
    managed: boolean;
  }>;
  postInstallRan?: boolean;
}

// ==================== 扫描结果 ====================

export interface ScannedSkill {
  /** skill 名称（优先取 frontmatter name，回退到目录名） */
  name: string;
  /** skill 目录绝对路径 */
  dir: string;
  /** SKILL.md 文件绝对路径 */
  skillMdPath: string;
  /** frontmatter 中的 description */
  description?: string;
  /** skill 来自哪个 Agent */
  agentName: string;
  /** 是否是 symlink */
  isSymlink: boolean;
  /** symlink 指向的路径 */
  linkTarget?: string;
  /** 相对路径（用于保持目录结构，如 write-a-skill/engineering/tdd） */
  relativePath?: string;
}

// ==================== Agent 配置 ====================

export interface AgentConfig {
  name: string;
  displayName: string;
  /** skill 目录名（相对于 agent 配置目录，如 .claude/skills） */
  skillsDir: string;
  /** 检测该 Agent 是否已安装 */
  detectInstalled: () => boolean;
}

// ==================== frontmatter 解析 ====================

export interface FrontmatterResult {
  /** YAML frontmatter 中的键值对 */
  data: Record<string, unknown>;
  /** frontmatter 之后的正文内容 */
  content: string;
}

// ==================== 导入结果 ====================

export interface ImportResult {
  name: string;
  version: string;
  deployed: string[];
}

// ==================== Source 解析 ====================

export interface ParsedSource {
  type: 'github' | 'git' | 'local';
  url: string | null;
  owner: string | null;
  repo: string | null;
  /** skill 在仓库中的路径（GitHub Trees API 用） */
  skillPath: string | null;
  /** Git 引用（branch/tag/commit） */
  ref: string | null;
  /** skill 名称过滤器（多 skill 仓库中指定安装哪个） */
  skillFilter: string | null;
}

// ==================== Skill 发现 ====================

export interface DiscoveredSkill {
  /** skill 名称（来自 frontmatter 或目录名） */
  name: string;
  /** skill 目录绝对路径 */
  dir: string;
  /** SKILL.md 文件绝对路径 */
  skillMdPath: string;
  /** frontmatter 中的 description */
  description?: string;
  /** frontmatter 原始数据 */
  metadata?: Record<string, unknown>;
  /** SKILL.md 正文内容 */
  rawContent?: string;
  /** 相对路径（用于保持目录结构） */
  relativePath?: string;
}

// ==================== 依赖声明 ====================

export type PackageManager = 'npm' | 'pip';

export type SkillDependencies = Partial<Record<PackageManager, string[]>>;

// ==================== GitHub API ====================

export interface TreeNode {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
}

export interface TreeResponse {
  sha: string;
  tree: TreeNode[];
  truncated: boolean;
}
