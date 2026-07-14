/**
 * 全局类型定义
 *
 * 参考 PRD-SkillSync v1.2 §4.5 核心类型定义
 */

// ==================== Skill 信息 ====================

export interface SkillInfo {
  /** 带命名空间的完整名称: anthropics/pdf-processing */
  name: string;
  namespace: string;
  skillName: string;
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
  /** owner/repo */
  repo?: string;
  /** skill 在仓库中的路径 */
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
  ignoreDeps?: boolean;
  yes?: boolean;
}

export interface InstallResult {
  name: string;
  namespace: string;
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

// ==================== 配置 ====================

export interface Config {
  defaultAgent?: string;
  distributionMode?: UserDeployMode;
  colorOutput?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  version?: {
    maxBackups?: number;
  };
  sync?: {
    github?: {
      repo?: string;
      branch?: string;
      token?: string;
      autoCommit?: boolean;
      commitMessagePrefix?: string;
    };
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
    proxy?: string;
    timeout?: number;
    retryCount?: number;
  };
  scanPaths?: string[];
}

// ==================== manifest.yaml ====================

export interface Manifest {
  name: string;
  namespace: string;
  description: string;
  source: {
    type: 'github' | 'local';
    repo?: string;
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
    repo?: string;
    path?: string;
    commit?: string;
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
  namespace: string;
  version: string;
  deployed: string[];
}
