# SkillSync — 跨端跨 Agent Skill 管理工具

> **文档版本**: v1.2.1
> **创建日期**: 2026-07-13
> **更新日期**: 2026-07-13
> **状态**: Draft（v1.2.1: 文档拆分，将详细设计文档外置引用；v1.2: 整合 D-08~D-21 全部决策）
> **作者**: SkillSync 项目组

---

## 目录

### 本文档（主 PRD）

1. [产品概述](#1-产品概述)
2. [需求分析](#2-需求分析)
3. [技术决策总览](#3-技术决策总览)
4. [系统架构](#4-系统架构)
5. [数据模型与存储设计](#5-数据模型与存储设计)
6. [版本管理方案（摘要）](#6-版本管理方案摘要)
7. [同步机制设计（摘要）](#7-同步机制设计摘要)
8. [skills.sh 集成方案（摘要）](#8-skills-sh-集成方案摘要)
9. [CLI 命令规范](#9-cli-命令规范)
10. [分发机制（摘要）](#10-分发机制摘要)
11. [安全设计 / 错误处理 / 依赖管理（摘要）](#11-安全设计--错误处理--依赖管理摘要)
12. [Git 仓库结构与 .gitignore 策略（摘要）](#12-git-仓库结构与-gitignore-策略摘要)
13. [测试策略（摘要）](#13-测试策略摘要)
14. [参考项目分析 / 技术选型 / 决策记录（摘要）](#14-参考项目分析--技术选型--决策记录摘要)
15. [路线图](#15-路线图)

### 外部详细设计文档（`docs/` 目录）

| 文档 | 内容 | 何时参考 |
|------|------|----------|
| [design-version-management.md](docs/design-version-management.md) | 版本管理方案（升级/恢复/备份/undeploy 状态） | 开发 `version-manager.ts` 时 |
| [design-distribution.md](docs/design-distribution.md) | 分发机制（命名规则/symlink·junction·copy/增量同步/source_hash/冲突检测） | 开发 `dispatcher.ts` / `deploy.ts` 时 |
| [design-sync-git.md](docs/design-sync-git.md) | 同步机制 + Git 仓库结构（push/pull/冲突解决/.gitignore/secrets.yaml） | 开发 `sync-manager.ts` 时 |
| [design-integration.md](docs/design-integration.md) | skills.sh 集成方案（搜索 API/安装流程/参数映射） | 开发 `installer.ts` 时 |
| [design-security-errors-deps.md](docs/design-security-errors-deps.md) | 安全设计 + 错误处理 + 依赖管理（退出码/恢复机制/依赖检查/post_install） | 全局参考，开发各模块时查阅 |
| [design-testing.md](docs/design-testing.md) | 测试策略（灰度约束/框架/分层/Mock/覆盖率） | 编写测试时 |
| [reference.md](docs/reference.md) | 参考项目分析 + 技术选型对比 + 决策记录(D-01~D-21) + 引用来源 + 术语表 + 配置示例 | 需要了解背景/决策/技术选型时 |

---

## 1. 产品概述

### 1.1 产品定位

SkillSync 是一款**以 CLI 为核心、文件系统为真相源（Source of Truth）**的 AI Agent Skill 管理工具。**本项目目的是管理 skill，不涉及创建 skill。** 核心能力包括：

- **统一管理**：集中管理所有 AI Agent 的 Skill 文件（SKILL.md + scripts + references + assets）
- **跨端同步**：通过 Git 仓库实现多客户端之间的 Skill 数据同步
- **跨 Agent 分发**：将 Skill 一键分发到 Claude Code、Cursor、OpenCode、Codex 等 Agent 的目标目录
- **简化版本管理**：单一活跃版本 + 升级时自动备份 + 按需恢复
- **生态接入**：兼容 skills.sh 生态，支持从社区 Skill 中搜索和安装
- **Web Dashboard**：提供 skill 浏览/搜索/管理页面（Phase 2）

### 1.2 核心价值主张

| 维度 | 痛点 | SkillSync 的解法 |
|------|------|------------------|
| 多端一致性 | 在不同机器上手动拷贝 Skill，容易遗漏或版本不一致 | Git 仓库同步，单仓库收敛 |
| 多 Agent 管理 | 每个 Agent 的 Skill 目录结构不同，维护成本高 | 统一目录结构 + 自动适配分发 |
| 版本回溯 | 不知道哪个 Skill 用了哪个版本，无法回滚 | 升级自动备份 + `switch` 恢复 |
| 生态发现 | 不知去哪找好用的 Skill | 接入 skills.sh 搜索 API + GitHub API |
| 散落管理 | Skill 散落在各 Agent 目录，缺乏统一视图 | `init` 扫描散落 skill + 集中管理 |

### 1.3 与现有产品的差异化

| 产品 | 定位 | 云同步 | 版本管理 | UI |
|------|------|--------|----------|-----|
| **Skiller** ([AFunc-OPC/Skiller](https://github.com/AFunc-OPC/Skiller)) | Tauri 桌面应用 | ❌ 无 | ❌ 无 | ✅ React GUI |
| **npx skills** ([vercel-labs/skills](https://github.com/vercel-labs/skills)) | 安装工具 | ❌ 仅本地 lock | ⚠️ commit 级别 | ❌ CLI |
| **skills.sh** ([skills.sh](https://skills.sh)) | 发现平台 | N/A | N/A | ✅ Web |
| **SkillSync（本项目）** | 管理平台 | ✅ Git | ✅ 备份+恢复 | ✅ CLI + Web Dashboard |

### 1.4 CLI 优先策略

**决策结论**：先做 CLI，再做 Web Dashboard。两者共享同一套 Core 引擎。

**理由**：

1. **Skill 的本质是文件操作**。CLI 直接操作文件系统，没有中间层，出问题最容易定位。
2. **简化版本管理**大大降低了 Core 层复杂度，CLI 可以更快落地。
3. **skills.sh API 已确认可用**，搜索/发现功能可以在 CLI 中先验证，再搬到 UI。
4. **Core 层从一开始就用纯 TypeScript 模块设计**，不依赖任何 CLI 框架或 HTTP 框架。CLI 命令只是 Core API 的薄封装。Phase 2 做 UI 时，HTTP API 层也是 Core API 的薄封装。

---

## 2. 需求分析

### 2.1 功能性需求

#### FR-01: 跨客户端同步

| ID | 描述 | 优先级 | 验收标准 |
|----|------|--------|----------|
| FR-01-01 | 支持 Git 仓库作为同步后端 | P0 | `skill-sync sync push/pull` 可正常推拉 |
| FR-01-02 | 同步冲突检测与解决 | P1 | 检测到两端同时修改时提示用户选择 |
| FR-01-03 | 增量同步 | P1 | 只传输变更文件，不全量覆盖 |
| FR-01-04 | 手动同步（不做自动同步） | P0 | 用户手动执行 sync 命令（D-13） |

> **决策来源**：D-13 — 先不实现自动同步。

#### FR-02: 跨 Agent 分发

| ID | 描述 | 优先级 | 验收标准 |
|----|------|--------|----------|
| FR-02-01 | 支持分发到 Claude Code (`~/.claude/skills`) | P0 | 分发后 agent 可正常加载 skill |
| FR-02-02 | 支持分发到 Cursor (`~/.cursor/skills`) | P0 | 同上 |
| FR-02-03 | 支持分发到 OpenCode、Codex 等 12+ Agent | P1 | 通过 `-a` 参数指定目标 |
| FR-02-04 | 支持软链接和复制两种分发模式 | P1 | 默认软链接，Windows 降级为复制 |
| FR-02-05 | 撤销分发（undeploy）后 Agent 保留复制版本 | P1 | 解除软链接，保留文件副本，该 Agent 不再纳入管理 |

#### FR-03: 简化版本管理

| ID | 描述 | 优先级 | 验收标准 |
|----|------|--------|----------|
| FR-03-01 | 升级时自动备份当前版本 | P0 | 升级前自动备份到 `.backup/<timestamp>-v<old>/` |
| FR-03-02 | 从备份恢复版本 | P0 | `switch` 命令从 `.backup/` 恢复 |
| FR-03-03 | 检查远程更新 | P1 | `check` 对比本地与远程版本 |
| FR-03-04 | 全局更新 | P0 | `update [name]` 更新指定或全部 skill |

> **决策来源**：D-19 — 不保留多版本并存，升级时自动备份，`switch` 从备份恢复。

#### FR-04: skills.sh 生态集成

| ID | 描述 | 优先级 | 验收标准 |
|----|------|--------|----------|
| FR-04-01 | 搜索 skills.sh 上的 skill | P0 | `search` 命令调用 `https://skills.sh/api/search?q={}` |
| FR-04-02 | 从 GitHub 安装 skill | P0 | `install` 命令自建下载逻辑 |
| FR-04-03 | 安装后自动适配目录结构 | P0 | 不破坏原有 skill 内容 |
| FR-04-04 | 检查已安装 skill 是否有更新 | P1 | `check` 对比本地与远程 |

> **决策来源**：D-11 — skills.sh 搜索 API: `https://skills.sh/api/search?q={}`。

#### FR-05: UI 层（Web Dashboard）— Phase 2

| ID | 描述 | 优先级 | 验收标准 |
|----|------|--------|----------|
| FR-05-01 | Skills 浏览/搜索页 | P1 | 展示本地 skill 列表 + skills.sh 搜索 |
| FR-05-02 | Skill 详情预览页 | P1 | SKILL.md 渲染、版本信息、一键安装 |
| FR-05-03 | 本地 Skill 管理页 | P1 | 分发状态、标签筛选 |
| FR-05-04 | `skill-sync ui` 启动本地 HTTP 服务 | P1 | 自动选择可用端口并打开浏览器 |

#### FR-06: 本地管理

| ID | 描述 | 优先级 | 验收标准 |
|----|------|--------|----------|
| FR-06-01 | 扫描散落 skill 并纳入管理 | P0 | `init` 扫描各 Agent 目录，交互式导入 |
| FR-06-02 | 标签分类与筛选 | P1 | 多对多关联，命令行筛选 |
| FR-06-03 | 搜索 Skill（本地模糊 + skills.sh） | P1 | 支持模糊搜索 |
| FR-06-04 | 环境健康检查 | P1 | `doctor` 检测软链接断裂、配置缺失等 |

> **注意**：项目级管理已删除（D-09）。本项目不涉及创建/编辑 SKILL.md（用户自行编辑源文件）。

### 2.2 非功能性需求

| ID | 描述 | 目标值 |
|----|------|--------|
| NFR-01 | 启动时间 | CLI 冷启动 < 500ms |
| NFR-02 | 同步延迟（百个 Skill 量级） | push/pull < 10s |
| NFR-03 | 跨平台支持 | macOS / Windows / Linux |
| NFR-04 | 数据可移植性 | 整个数据目录可直接拷贝迁移 |
| NFR-05 | 离线可用性 | 核心 CRUD 操作无需网络 |
| NFR-06 | Git 仓库大小控制 | 百个 Skill 仓库 < 50MB（不含二进制 assets） |
| NFR-07 | 测试覆盖率 | ≥ 90% |

---

## 3. 技术决策总览

### 3.1 决策一：CLI 优先，UI 作为正式功能层（Phase 2）

**决策结论**：CLI 是核心引擎入口，Web Dashboard（`skill-sync ui`）是 Phase 2 正式功能。两者共享同一套 Core 引擎 API。

**理由**：
1. Skill 的本质是文件系统资产，CLI 操作文件系统的成本远低于 GUI。
2. 目标用户是开发者群体，天然习惯命令行。
3. CI/CD 与自动化集成的需要。
4. Core 层用纯 TypeScript 模块设计，CLI 和 HTTP API 都是其薄封装。

> **决策来源**：D-06 / D-07

### 3.2 决策二：文件系统作为唯一真相源

**决策结论**：所有 Skill 数据以标准化文件结构存储在文件系统中。

**理由**：
1. **Git 友好性**。文本文件可以被 diff、merge、code review、回滚。
2. **可移植性**。整个技能库就是一个文件夹，可以拷贝、备份、挂载到任何位置。
3. **Agent 兼容性**：所有 Agent 都是通过读取文件系统中的 SKILL.md 来加载 Skill 的。
4. **数据损坏恢复**：扫描文件系统即可重建索引。

### 3.3 决策三：简化版本管理（备份 + 升级模式）

**决策结论**：不保留多版本并存。单一活跃版本，升级时自动备份，`switch` 从备份恢复。

> **决策来源**：D-19。详见 [§6 版本管理方案摘要](#6-版本管理方案摘要)。

### 3.4 决策四：Git 仓库作为同步后端

**决策结论**：`~/.skill-sync/` 整体是一个 Git 仓库，通过 `git push/pull` 实现多端同步。

> **决策来源**：D-08。详见 [§12 Git 仓库结构摘要](#12-git-仓库结构与-gitignore-策略摘要)。

---

## 4. 系统架构

### 4.1 架构分层图

```
┌──────────────────────────────────────────────────────────┐
│                       用户交互层                           │
│  ┌──────────┐    ┌──────────────────────────────────────┐  │
│  │   CLI     │    │  Web Dashboard (Vue 3 + Naive UI      │  │
│  │ (核心入口) │    │  + UnoCSS + md-editor-v3)             │  │
│  │           │    │  skill-sync ui → localhost:PORT       │  │
│  └────┬─────┘    └──────────────┬───────────────────────┘  │
│       │                          │                          │
└───────┼──────────────────────────┼──────────────────────────┘
        │                          │
┌───────▼──────────────────────────▼──────────────────────────┐
│                   核心引擎层 (Core)                          │
│  (纯 TypeScript 模块，通过 Context 依赖注入，无 CLI/HTTP 依赖) │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐       │
│  │ SkillMgr │  │ VersionMgr│  │ Dispatcher         │       │
│  │ 搜索/管理 │  │ 备份/恢复  │  │ 分发到各 Agent 目录  │       │
│  └────┬─────┘  └────┬─────┘  └────────┬───────────┘       │
│       │              │                 │                    │
│  ┌────▼──────────────▼─────────────────▼───────────────┐    │
│  │              Installer / SearchProvider              │    │
│  │  GitHub Trees API / skills.sh API / 本地扫描          │    │
│  └──────────────────────┬──────────────────────────────┘    │
└─────────────────────────┼────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────┐
│                  文件系统 (Source of Truth)                    │
│           ~/.skill-sync/ (Git 仓库)                           │
│  skills/  config.yaml  secrets.yaml  skills-lock.json  tags/  │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 核心模块职责

| 模块 | 职责 | 关键接口 |
|------|------|----------|
| **SkillManager** | Skill 的搜索、列表、详情、标签管理 | `list`, `find`, `info`, `tag` |
| **VersionManager** | 备份、升级、恢复版本 | `update`, `switch`, `check` |
| **Dispatcher** | 将 Skill 分发到各 Agent 目标目录 | `deploy`, `undeploy`, `status` |
| **Installer** | 从 GitHub/skills.sh 安装 skill | `install`, `search` |
| **SyncManager** | Git 同步操作 | `push`, `pull`, `conflict-check` |
| **Scanner** | 扫描散落 skill（init 时） | `scanAll`, `importScanned` |
| **ConfigManager** | 配置读写 | `get`, `set`, `init` |

### 4.3 数据流：从安装到分发的完整链路

```
用户执行: skill-sync install anthropics/skills --skill pdf-processing
    │
    ▼
[Installer] GitHub Trees API 发现 skill → 下载文件 → 复制到中央仓库
    │
    ▼
[SkillManager] 解析 SKILL.md frontmatter → 生成 manifest.yaml
    │
    ▼
[SkillManager] 更新 skills-lock.json → 记录来源+版本信息
    │
    ▼
用户执行: skill-sync deploy pdf-processing --to claude-code
    │
    ▼
[Dispatcher] 读取 skills-lock.json 确认版本
    │
    ▼
[Dispatcher] 软链接/复制 ~/.claude/skills/pdf-processing → 中央仓库目录
    │
    ▼
[Dispatcher] 更新 skills-lock.json 记录分发状态 + source_hash 校验
```

### 4.4 Core 层 API 设计

Core 层通过 **Context 依赖注入** 设计，不依赖 CLI 框架或 HTTP 框架。所有 Core 模块接收一个 `SkillSyncContext`，包含路径、配置、锁文件等运行时上下文：

```typescript
// src/core/context.ts
export interface SkillSyncContext {
  homeDir: string;                    // 中央仓库根目录（默认: ~/.skill-sync/）
  config: Config;                     // 已加载的配置对象
  lockFile: LockFile;                 // 锁文件读写器
  logger: Logger;                     // 日志接口
  isDryRun: boolean;                  // 是否为预览模式
}

// 工厂函数
export function createContext(opts?: Partial<ContextOpts>): SkillSyncContext
// opts.homeDir 可被 SKILL_SYNC_HOME 环境变量或 --home 参数覆盖

// src/core/skill-manager.ts
export class SkillManager {
  constructor(private ctx: SkillSyncContext) {}
  list(filter?: SkillFilter): SkillInfo[]
  find(query: string): SkillInfo[]          // 本地模糊搜索
  info(name: string): SkillDetail
  remove(name: string, scope: RemoveScope): void
  tag(name: string, tags: string[]): void
  importLocal(path: string, namespace?: string): ImportResult  // 增量导入本地 skill
}

// src/core/version-manager.ts
export class VersionManager {
  constructor(private ctx: SkillSyncContext) {}
  check(name?: string): UpdateCheckResult[]
  update(name?: string, opts?: UpdateOpts): UpdateResult[]
  switch(name: string, backupId: string): void
  listBackups(name: string): BackupInfo[]
}

// src/core/dispatcher.ts
export class Dispatcher {
  constructor(private ctx: SkillSyncContext) {}
  deploy(name: string, agent: string, opts?: DeployOpts): void
  undeploy(name: string, agent: string): void
  status(): StatusReport
}

// src/core/installer.ts
export class Installer {
  constructor(private ctx: SkillSyncContext) {}
  install(source: string, opts?: InstallOpts): InstallResult
  search(query: string): SearchResult[]
}

// src/core/sync-manager.ts
export class SyncManager {
  constructor(private ctx: SkillSyncContext) {}
  push(opts?: SyncOpts): SyncResult
  pull(opts?: SyncOpts): SyncResult
  status(): SyncStatus
}
```

**Phase 1**：CLI 命令创建 Context → 实例化 Core → 调用方法：
```typescript
const ctx = createContext();
const mgr = new SkillManager(ctx);
mgr.list();
```

**Phase 2**：HTTP API = Hono 路由调用同一个 Core：
```typescript
const ctx = createContext();
const mgr = new SkillManager(ctx);
app.get('/api/skills', (c) => c.json(mgr.list()));
```

### 4.5 核心类型定义

```typescript
// src/lib/types.ts

interface SkillInfo {
  name: string;                    // 带命名空间的完整名称: anthropics/pdf-processing
  namespace: string;
  skillName: string;
  version: string;
  description: string;
  tags: string[];
  deployMode: 'symlink' | 'junction' | 'copy';  // junction = Windows 目录链接
  agents: string[];                // 已分发到的 Agent 列表
  managed: boolean;                 // 是否纳入管理
}

interface SkillDetail extends SkillInfo {
  source: SkillSource;
  installedAt: string;
  updatedAt: string;
  distribution: DistributionTarget[];
  backups: BackupInfo[];
  dependencies?: Dependency[];
}

interface SkillSource {
  type: 'github' | 'local';
  repo?: string;                   // owner/repo
  path?: string;                   // skill 在仓库中的路径
  commit?: string;
  installedVia: 'cli' | 'init-scan';
}

interface DistributionTarget {
  agent: string;
  path: string;
  mode: 'symlink' | 'junction' | 'copy';  // 实际使用的分发模式
  version: string;
  distributedAt: string;
  sourceHash: string;
  managed: boolean;
}

interface BackupInfo {
  id: number;
  version: string;
  timestamp: string;
  backupDir: string;
}

interface UpdateCheckResult {
  name: string;
  currentVersion: string;
  remoteVersion: string | null;
  hasUpdate: boolean;
  isLocal: boolean;                // 本地 skill 无远程源
}

interface UpdateResult {
  name: string;
  success: boolean;
  oldVersion: string;
  newVersion: string;
  backupDir?: string;
  error?: string;
}

interface InstallOpts {
  skill?: string;                  // 指定 skill 名
  ref?: string;                    // Git 引用
  agents?: string[];               // 目标 Agent
  deployType?: 'symlink' | 'copy';  // 用户指定 symlink 时，Windows 自动使用 junction
  noDeploy?: boolean;
  ignoreDeps?: boolean;
  yes?: boolean;
}

interface InstallResult {
  name: string;
  namespace: string;
  version: string;
  source: SkillSource;
  deployed: string[];              // 已分发到的 Agent
}

interface SearchResult {
  source: string;                  // GitHub owner
  skillId: string;
  name: string;
  description: string;
  stars?: number;
  installs?: number;
  isLocal?: boolean;               // 本地搜索结果
  localVersion?: string;           // 如果已安装
}

interface SyncOpts {
  message?: string;
  strategy?: 'ours' | 'theirs' | 'manual' | 'newer' | 'skip';
  dryRun?: boolean;
}

interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  conflicts: string[];
  error?: string;
}

interface SyncStatus {
  isRepo: boolean;
  hasRemote: boolean;
  uncommittedChanges: number;
  ahead: number;
  behind: number;
  lastSync?: string;
}

interface StatusReport {
  repoPath: string;
  repoClean: boolean;
  lastSync?: string;
  totalManaged: number;
  totalUnmanaged: number;
  agents: AgentStatus[];
  updatesAvailable: number;
  warnings: string[];
}

interface AgentStatus {
  agent: string;
  managed: number;
  unmanaged: number;
  total: number;
}

type RemoveScope = 'all' | 'central' | 'agent';

interface DeployOpts {
  mode?: 'symlink' | 'copy';  // 用户指定 symlink 时，Windows 自动使用 junction
  force?: boolean;
  dryRun?: boolean;
}

interface UpdateOpts {
  version?: string;
  noBackup?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

interface SkillFilter {
  agent?: string;
  tag?: string;
  managed?: boolean;
}

interface Dependency {
  name: string;
  version: string;                 // SemVer range
}
```

---

## 5. 数据模型与存储设计

### 5.1 文件系统目录结构

```
~/.skill-sync/                              # 全局根目录（Git 仓库）
│
├── config.yaml                             # 全局配置文件（不含敏感信息）
├── secrets.yaml                            # 敏感信息（.gitignore，不同步）
├── skills-lock.json                        # 全局分发锁定文件
├── tags.yaml                               # 标签定义
│
├── skills/                                 # Skill 仓库（Source of Truth）
│   └── <namespace>/                        #   命名空间避免冲突（D-14）
│       └── <skill-name>/                   #   每个 skill 一个目录
│           ├── SKILL.md                    #   核心 skill 定义
│           ├── scripts/                    #   可选脚本目录
│           ├── references/                 #   可选参考资料
│           ├── assets/                     #   可选静态资源
│           ├── manifest.yaml               #   skill 级元数据
│           └── .backup/                    #   升级时的备份目录（.gitignore）
│               └── <timestamp>-v<version>/ #     上一个版本的快照
│
├── cache/                                  # 缓存目录（.gitignore）
│   ├── index.jsonl                         #   索引缓存
│   └── registry/                           #   远程 skill 注册表缓存
│       └── <owner>/<repo>.json             #     各仓库的 tag/release 信息
│
└── temp/                                   # 临时暂存区（.gitignore）
```

**关键设计**：
- 去掉 `versions/` 目录和 `latest` 软链接（简化版本管理）
- `manifest.yaml` 只记录当前版本和上次升级前的备份信息
- 升级时：当前内容 → `.backup/<timestamp>-v<old>/`，新内容 → skill 目录
- `switch` 命令变为：从 `.backup/` 恢复某个备份
- 命名空间（`<namespace>/<skill-name>`）避免不同来源的 skill 名称冲突（D-14）

### 5.2 tags.yaml 格式定义

标签定义文件，用于 skill 分类管理（纯分类标签，非版本标签）：

```yaml
# ~/.skill-sync/tags.yaml

tags:
  - name: pdf
    description: PDF 相关处理
  - name: document
    description: 文档处理
  - name: web-design
    description: Web 设计相关

# skill 与标签的关联（多对多）
mappings:
  anthropics/pdf-processing: [pdf, document]
  vercel-labs/web-design: [web-design]
  local/my-custom-skill: [document]
```

- `tag add/remove` 命令操作此文件
- `tag list` 列出所有标签或指定标签下的 skill
- `list --tag <tag>` 按标签筛选 skill

### 5.3 核心数据模型

#### manifest.yaml（每个 skill 必备）

```yaml
# === 基本信息 ===
name: pdf-processing
namespace: anthropics                    # 命名空间（D-14），全称: anthropics/pdf-processing
description: Use this skill whenever the user wants to do anything with PDF

# === 来源信息 ===
source:
  type: github                           # github | local
  repo: anthropics/skills                # GitHub owner/repo
  path: skills/pdf-processing            # skill 在仓库中的路径
  installed_via: cli                     # cli | init-scan

# === 版本信息（简化版） ===
current_version: "1.1.0"                 # 当前版本
initial_version: "0.0.0"                 # 初始版本（D-12: 本地创建的 skill 初始为 0.0.0）
last_backup:                             # 最近一次升级前的备份信息
  timestamp: "2026-07-13T10:00:00Z"
  from_version: "1.0.0"
  backup_dir: ".backup/20260713-100000-v1.0.0"

# === 分类与依赖 ===
tags: [pdf, document, processing]        # 分类标签（非版本标签）
depends_on:
  - name: image-processor
    version: ">=1.0.0"

# === 分发记录 ===
distribution:
  mode: symlink                          # symlink | junction | copy（junction = Windows 自动选择）
  targets:
    - agent: claude-code
      path: ~/.claude/skills/pdf-processing
      version: "1.1.0"
      distributed_at: 2026-07-13T10:00:00Z
      source_hash: sha256:abc123...
      managed: true                      # true = 纳入管理; false = undeploy 后的副本
```

#### SKILL.md frontmatter 扩展规范

> **决策来源（D-02）**：扩展字段统一收纳到 Anthropic 官方预留的 `metadata` 容器中。

```yaml
---
name: pdf-processing
description: Use this skill whenever the user wants to do anything with PDF
license: MIT
compatibility: Requires Python 3.8+ and PyPDF2
metadata:                               # ★ 官方扩展容器
  version: "1.1.0"
  depends_on:
    - name: image-processor
      version: ">=1.0.0"
  author: anthropics
---

# Instructions
（标准 SKILL.md 正文内容）
```

**字段放置规则**：

| 字段 | 放置位置 | 理由 |
|------|----------|------|
| `name` | 顶层 | 官方必填 |
| `description` | 顶层 | 官方必填 |
| `license` | 顶层 | 官方可选字段 |
| `compatibility` | 顶层 | 官方可选字段（环境兼容性） |
| `version` | `metadata.*` 内 | SkillSync 扩展 |
| `depends_on` | `metadata.*` 内 | SkillSync 扩展 |
| `author` | `metadata.*` 内 | SkillSync 扩展 |

**硬性安全约束**：frontmatter 中任何位置不得出现 XML 尖括号（`<` / `>`）。

**版本降级处理策略**（针对不带扩展字段的已有 Skill）：

```
优先级链：
  1. metadata.version（显式声明，推荐位置）
  2. 顶层 version（兼容社区旧写法，不拒绝但警告）
  3. Git tag 解析（v1.0.0 → 1.0.0）
  4. manifest.yaml.current_version（安装时记录）
  5. "0.0.0"（标记为 unversioned，D-12）
```

#### skills-lock.json（全局锁定文件）

```json
{
  "lockfile_version": 2,
  "generated_at": "2026-07-13T10:00:00Z",
  "generator": "skill-sync v0.1.0",
  "skills": {
    "anthropics/pdf-processing": {
      "source": {
        "type": "github",
        "repo": "anthropics/skills",
        "path": "skills/pdf-processing",
        "commit": "abc123def456..."
      },
      "version": "1.1.0",
      "installed_at": "2026-07-10T08:00:00Z",
      "updated_at": "2026-07-13T10:00:00Z",
      "tree_sha": "sha:xyz789...",
      "distribution": {
        "claude-code": {
          "mode": "symlink",
          "distributed_at": "2026-07-13T10:00:00Z",
          "source_hash": "sha256:abc123...",
          "managed": true
        },
        "cursor": {
          "mode": "copy",
          "distributed_at": "2026-07-13T10:00:00Z",
          "source_hash": "sha256:def456...",
          "managed": false
        }
      }
    }
  }
}
```

> **注意**：`managed: false` 表示该 Agent 下的 skill 是 `undeploy` 后的副本，不再纳入管理，不会被 `update` 更新（D-18）。

#### manifest.yaml 与 skills-lock.json 的数据边界

两份文件存在部分字段重叠，边界划分如下：

| 字段 | manifest.yaml | skills-lock.json | 说明 |
|------|:---:|:---:|------|
| name / namespace / description | ✅ 主 | ❌ 不存 | manifest 是 skill 自描述 |
| source (type/repo/path/commit) | ✅ 主 | ✅ 冗余 | manifest 记录来源，lock 记录精确 commit |
| current_version | ✅ 主 | ✅ 冗余 | manifest 是真相源，lock 镜像 |
| tags | ✅ 主 | ❌ 不存 | 标签由 tags.yaml 管理，manifest 记录声明 |
| depends_on | ✅ 主 | ❌ 不存 | manifest 记录依赖声明 |
| distribution.targets | ✅ 主 | ✅ 冗余 | manifest 记录分发状态，lock 镜像 |
| tree_sha | ❌ 不存 | ✅ 主 | 仅 lock 记录（用于变更检测） |
| installed_at / updated_at | ❌ 不存 | ✅ 主 | 仅 lock 记录（安装时间线） |
| postInstallRan | ❌ 不存 | ✅ 主 | 仅 lock 记录 |
| last_backup | ✅ 主 | ❌ 不存 | 仅 manifest 记录（本地状态） |

**同步规则**：
1. **manifest.yaml 是 skill 级真相源**，lock 文件是全局镜像 + 补充字段
2. 任何写操作先更新 manifest.yaml，再同步到 skills-lock.json
3. 如果两者冲突，以 manifest.yaml 为准，lock 文件自动修正
4. `doctor` 命令检测两者不一致并修复

### 5.4 Agent 注册表

支持 12+ 个 Agent，每个 Agent 有独立的 skill 目录路径和检测逻辑：

| Agent | 默认 Skill 目录 | 检测方式 |
|-------|-----------------|----------|
| Claude Code | `~/.claude/skills/` | `~/.claude` 存在 |
| Cursor | `~/.cursor/skills/` | `~/.cursor` 存在 |
| OpenCode | `~/.config/opencode/skills/` | `~/.config/opencode` 存在 |
| Codex | `~/.codex/skills/` | `~/.codex` 存在 |
| CodeBuddy | `~/.codebuddy/skills/` | `~/.codebuddy` 存在 |
| Hermes Agent | `~/.hermes/skills/` | `~/.hermes` 存在 |
| Qoder | `~/.qoder/skills/` | `~/.qoder` 存在 |
| Qoder CN | `~/.qoder-cn/skills/` | `~/.qoder-cn` 存在 |
| Trae | `~/.trae/skills/` | `~/.trae` 存在 |
| Trae CN | `~/.trae-cn/skills/` | `~/.trae-cn` 存在 |
| TeleAgent | `~/.config/TeleAgent/skills/` | `~/.config/TeleAgent` 存在 |
| OpenClaw | `~/.openclaw/skills/` | `~/.openclaw` 存在 |

> 支持环境变量覆盖（如 `CLAUDE_CONFIG_DIR`、`CODEX_HOME`）。用户可在 `config.yaml` 中添加自定义 Agent 路径。

---

## 6. 版本管理方案摘要

> **详细设计**：[docs/design-version-management.md](docs/design-version-management.md)
> **决策来源**：D-19

**核心要点**：
- **单一活跃版本**：不保留多版本并存，扁平目录 + `.backup/`
- **升级流程**：检查远程版本 → 备份当前版本到 `.backup/<timestamp>-v<old>/` → 下载新版本 → 更新 manifest.yaml + skills-lock.json → 提示重新 deploy
- **远程版本判定优先级**：`metadata.version` → 顶层 `version` → Git tag → commit hash → "unknown"
- **恢复流程**：`switch` 从 `.backup/` 恢复，恢复后需手动重新 `deploy`（D-20）
- **备份清理**：默认保留最近 5 个，可配置 `config.yaml → version.max_backups`
- **undeploy 后状态**：Agent 目录保留副本，`managed = false`，不被 `update` 更新（D-18）

---

## 7. 同步机制设计摘要

> **详细设计**：[docs/design-sync-git.md](docs/design-sync-git.md)（含 §12 Git 仓库结构）

**核心要点**：
- **Git 同步**：`~/.skill-sync/` 整体是 Git 仓库，`sync push/pull` 操作
- **提交信息格式**：`chore(skills): <action> <skill-name> [<detail>]`
- **冲突解决策略**：`ours` / `theirs` / `manual` / `newer` / `skip`（默认 `manual`，可在 config.yaml 配置）
- **GitHub API**：Trees API 发现 skill、commit hash 获取版本、raw.githubusercontent.com 下载文件
- **Lazy Token 策略**：默认不主动获取 token，仅在 rate limit 后尝试（`GITHUB_TOKEN` → `GH_TOKEN` → `gh auth token`）

---

## 8. skills.sh 集成方案摘要

> **详细设计**：[docs/design-integration.md](docs/design-integration.md)
> **决策来源**：D-11

**核心要点**：
- **搜索 API**：`GET https://skills.sh/api/search?q={query}`，返回 JSON（含 `source`、`skill_id`、`name`、`description`、`stars`、`installs`）
- **搜索结果到 install 参数映射**：`source` → `owner`，`skill_id` → `--skill <name>`，`repo` 需推断（优先用 `skill_id` 尝试，失败后 Trees API 搜索）
- **安装流程**：解析来源 → Trees API 发现 SKILL.md → 获取 tree SHA + commit hash → 下载文件 → 复制到中央仓库 → 生成 manifest.yaml → 更新 skills-lock.json
- **搜索展示**：本地匹配 + skills.sh 搜索结果并列展示

---

## 9. CLI 命令规范

### 9.1 命令总览

```
skill-sync <command> [options] [arguments]

核心命令:
  init                   初始化中央仓库 + 扫描散落 skill
  install                从 GitHub/skills.sh 安装 skill
  import                 增量导入本地 skill 到中央仓库（init 后可用）
  remove, rm             删除 skill（支持范围参数）
  list, ls               列出 skill（参考 fnm/mise 风格）
  search, find           搜索 skill（本地模糊 + skills.sh）
  info                   查看 skill 详情

版本管理:
  check                  检查更新
  update                 升级 skill（自动备份当前版本）
  switch                 从备份恢复版本

分发管理:
  deploy                 分发 skill 到 Agent 目录
  undeploy               撤销分发（保留副本，不再纳入管理）
  status                 全局状态概览

同步管理:
  sync push              推送变更到远程
  sync pull              拉取远程变更
  sync status            查看同步状态

标签管理:
  tag add                添加标签
  tag remove             删除标签
  tag list               列出标签

配置:
  config set             设置配置项
  config get             查看配置项
  config list            列出所有配置
  config init            初始化配置文件

其他:
  clean                  清理缓存/备份/孤儿文件
  ui                     启动 Web Dashboard（Phase 2）
  doctor                 环境健康检查
  help                   显示帮助信息
  version                显示版本号
```

> **注意**：已删除 `create`/`add`/`bump`/`project` 命令。`bump` 合并到 `update`（D-16）。

### 9.2 关键命令详细规格

#### `skill-sync init`

```bash
skill-sync init [options]

# 初始化中央仓库 + 扫描散落 skill
--path <path>           # 指定中央仓库路径（默认: ~/.skill-sync/）
--agent <list>          # 指定要扫描的 Agent（逗号分隔，默认: 自动检测所有已知 Agent）
--scan-path <path>      # 用户自定义扫描路径（可多次指定，D-17）
--no-scan               # 跳过扫描步骤
-y, --yes               # 跳过所有交互确认

# 交互流程:
# 1. 确认中央仓库路径
# 2. 创建目录结构 + config.yaml + .gitignore + secrets.yaml
# 3. git init + 首次 commit
# 4. 扫描已检测到的 Agent 目录 + 用户自定义路径（D-17）
# 5. 列出发现的 skill，逐个询问:
#    - "纳入管理" → 复制到中央仓库 + 在 Agent 目录创建软链接
#    - "跳过" → 不纳入管理
# 6. 生成 skills-lock.json
# 7. git commit
# 8. 询问是否关联远程仓库

示例:
skill-sync init
skill-sync init --scan-path ~/projects/my-skills --scan-path ~/work/shared-skills
skill-sync init --no-scan -y
```

#### `skill-sync import`

```bash
skill-sync import <path> [options]

# 增量导入本地 skill 到中央仓库（init 之后随时可用）
<path>                  # 本地 skill 目录路径（必须含 SKILL.md）

选项:
-n, --namespace <name>  # 命名空间（默认: local）
-a, --agents <list>     # 导入后分发到指定 Agent（逗号分隔）
--deploy <type>         # 部署方式: symlink | copy（默认: symlink）
--no-deploy             # 只导入到中央仓库，不自动分发
-y, --yes               # 跳过确认提示

示例:
skill-sync import ~/my-skills/pdf-tools
skill-sync import ~/my-skills/pdf-tools --namespace myname -a claude-code
```

**命名空间分配规则**：

| 来源 | 命名空间 | 示例 |
|------|---------|------|
| GitHub 安装 | GitHub `owner` | `anthropics/pdf-processing` |
| 本地导入（默认） | `local` | `local/my-skill` |
| 本地导入（指定） | 用户指定 | `myname/my-skill` |
| init 扫描导入 | 原始所在 Agent 目录名 | `claude-code/imported-skill` |

#### `skill-sync install`

```bash
skill-sync install <source> [options]

<source>                # 安装来源
  owner/repo             # GitHub 简写
  https://github.com/... # 完整 URL
  ./local-path           # 本地路径

选项:
-s, --skill <name>      # 指定安装哪个 skill（仓库含多个 skill 时必填）
--ref <ref>             # 指定 Git 引用（commit/tag/branch，默认: HEAD）
-a, --agents <list>     # 安装后分发到指定 Agent（逗号分隔，默认: 已检测到的全部）
--deploy <type>         # 部署方式: symlink | copy（默认: symlink）
--no-deploy             # 只安装到中央仓库，不自动分发
--ignore-deps           # 跳过依赖检查（见依赖管理逻辑）
-y, --yes               # 跳过确认提示

示例:
skill-sync install anthropics/skills --skill pdf-processing
skill-sync install vercel-labs/agent-skills --skill web-design -a claude-code,cursor
skill-sync install ./my-local-skill --deploy copy
```

#### `skill-sync remove`

```bash
skill-sync remove <name> [options]

<name>                  # skill 名称（支持命名空间: anthropics/pdf-processing）

选项:
--all                   # 删除中央仓库 + 所有 Agent 下的分发
--central               # 仅删除中央仓库（Agent 下的分发变为副本，不再管理）
--agent <name>          # 仅删除某个 Agent 下的分发（中央仓库保留）
-f, --force             # 跳过确认

# remove --central vs undeploy --all 的区别:
#   remove --central:
#     - 删除中央仓库中的 skill 文件 + manifest.yaml
#     - Agent 下的分发变为孤儿副本（不再管理）
#     - skills-lock.json 中移除该 skill 记录
#     - 不可逆（除非从备份恢复）
#   undeploy --all:
#     - 中央仓库保留
#     - Agent 下的分发变为副本（不再管理）
#     - skills-lock.json 中 distribution.*.managed = false
#     - 可逆（重新 deploy 即可）

示例:
skill-sync remove pdf-processing --all
skill-sync remove pdf-processing --central
skill-sync remove pdf-processing --agent cursor
```

#### `skill-sync list`

```bash
skill-sync list [options]

# 参考 fnm list / mise list 风格，紧凑表格输出

选项:
--agent <name>          # 只列出指定 Agent 的 skill
--tag <tag>             # 按标签筛选
--managed               # 只列出已管理的 skill
--unmanaged             # 只列出未管理的 skill

示例输出:
$ skill-sync list

  NAMESPACE/NAME                    VERSION   DEPLOY    AGENTS
  ────────────────────────────────  ────────  ────────  ──────────────────
  anthropics/pdf-processing         1.1.0     symlink   claude-code, cursor
  vercel-labs/web-design            1.0.0     copy      claude-code
  local/my-custom-skill             0.0.0     symlink   cursor, opencode
```

#### `skill-sync search`

```bash
skill-sync search <query> [options]

<query>                 # 搜索关键词（模糊匹配）
                        # `find` 是 `search` 的别名

选项:
--local                 # 仅搜索本地（默认: 本地 + skills.sh）
--remote                # 仅搜索 skills.sh
--limit <n>             # 返回结果数量限制（默认: 20）

示例:
skill-sync search pdf
skill-sync search pdf --local
skill-sync search "web design" --remote --limit 5
```

#### `skill-sync info`

```bash
skill-sync info <name>

<name>                  # skill 名称（支持命名空间）

示例输出:
$ skill-sync info anthropics/pdf-processing

  anthropics/pdf-processing
  ════════════════════════════════════════════════════

  Description:  Use this skill whenever the user wants to do anything with PDF
  Version:      1.1.0
  Source:       github:anthropics/skills/skills/pdf-processing
  Deploy mode:  symlink
  Tags:         pdf, document
  Installed:    2026-07-10
  Updated:      2026-07-13

  Distribution:
    claude-code  ✓ managed    → ~/.claude/skills/pdf-processing
    cursor       ✓ managed    → ~/.cursor/skills/pdf-processing
    opencode     ✗ unmanaged  → ~/.opencode/skills/pdf-processing (copy)

  Backups:
    20260713-100000-v1.0.0   (2 days ago)
```

#### `skill-sync check`

```bash
skill-sync check [name]

# 全局检查更新（或检查指定 skill）
[name]                  # 可选: 指定 skill 名称

示例输出:
$ skill-sync check

  Checking for updates...
  ════════════════════════════════════════════════════

  ✓  anthropics/pdf-processing      1.1.0  (up to date)
  ↑  vercel-labs/web-design         1.0.0 → 1.1.0  (update available)
  ✓  local/my-custom-skill          0.0.0  (local, no remote)

  1 update available. Run 'skill-sync update web-design' to update.
```

#### `skill-sync update`

```bash
skill-sync update [name] [options]

# 升级 skill（自动备份当前版本，D-16: bump 合并到 update）
[name]                  # 可选: 指定 skill 名称（不指定则升级全部有更新的）

选项:
--version <semver>      # 指定升级到某个版本（默认: latest）
--no-backup             # 不保留备份
--dry-run               # 预览将要发生的变化
-f, --force             # 跳过确认

# update [name]（不指定名称）的原子性策略:
#   - 非原子：逐个 skill 升级，每个独立成功/失败
#   - 单个 skill 升级失败不影响其他 skill
#   - 最终汇总报告：N 成功, M 失败
#   - 退出码：全部成功=0，部分失败=8，全部失败=1

示例:
skill-sync update                       # 升级所有有更新的 skill
skill-sync update pdf-processing        # 升级指定 skill
skill-sync update pdf-processing --version 1.2.0
skill-sync update --dry-run
```

#### `skill-sync switch`

```bash
skill-sync switch <name> [options]

# 从备份恢复版本（D-20: 恢复后需手动重新 deploy）
<name>                  # skill 名称

选项:
--list                  # 列出可用备份（不执行恢复）
--backup <id>           # 指定恢复的备份 ID
-f, --force             # 跳过确认

示例:
skill-sync switch pdf-processing --list
skill-sync switch pdf-processing --backup 1
```

#### `skill-sync deploy`

```bash
skill-sync deploy <name> [options]

<name>                  # skill 名称

选项:
--to <agent>            # 目标 Agent（可多次指定，或逗号分隔）
--all                   # 分发到所有已检测到的 Agent
-m, --mode <mode>       # 分发模式: symlink | copy（默认: symlink）
-f, --force             # 强制覆盖已存在的分发
--dry-run               # 预览分发操作但不实际执行

示例:
skill-sync deploy pdf-processing --to claude-code
skill-sync deploy pdf-processing --all
skill-sync deploy --all --to cursor -m copy
```

#### `skill-sync undeploy`

```bash
skill-sync undeploy <name> [options]

# 撤销分发: 解除软链接，保留文件副本，该 Agent 不再纳入管理（D-18）
<name>                  # skill 名称

选项:
--agent <name>          # 指定 Agent（可多次指定）
--all                   # 从所有 Agent 撤销分发
-f, --force             # 跳过确认

示例:
skill-sync undeploy pdf-processing --agent cursor
skill-sync undeploy pdf-processing --all
```

#### `skill-sync status`

```bash
skill-sync status

# 全局状态概览（类似 git status，面向 skill 管理全局视图）

示例输出:
$ skill-sync status

  Central Repository: ~/.skill-sync/  (clean, last sync: 2h ago)
  ════════════════════════════════════════════════════

  Skills: 24 managed, 3 unmanaged

  Distribution Status:
  ─────────────────────────────────────────────────────
  Agent           Managed    Unmanaged    Total
  ───────         ────────   ─────────    ─────
  claude-code     22         1            23
  cursor          18         2            20
  opencode        5          0            5

  Sync Status:
  ─────────────────────────────────────────────────────
  ●  No uncommitted changes
  ↑  3 skills have updates available (run 'skill-sync check')

  Warnings:
  ⚠  ~/.claude/skills/pdf-processing: symlink broken (target moved)
  ⚠  ~/.cursor/skills/web-design: manually modified since last deploy
```

#### `skill-sync sync`

```bash
skill-sync sync <action> [options]

action:
push                    # 推送本地变更到远程
pull                    # 拉取远程变更到本地
status                  # 显示同步状态

选项:
--message <msg>         # 自定义提交信息（push）
--strategy <strat>      # 冲突策略: ours | theirs | manual | newer | skip（pull）
--dry-run               # 预览操作但不实际执行
```

#### `skill-sync tag`

```bash
skill-sync tag <action> [options]

action:
add <name> <tag>        # 给 skill 添加标签
remove <name> <tag>     # 移除 skill 的标签
list [tag]              # 列出所有标签或指定标签下的 skill

示例:
skill-sync tag add pdf-processing document
skill-sync tag remove pdf-processing document
skill-sync tag list
skill-sync tag list document
```

#### `skill-sync config`

```bash
skill-sync config <action> [options]

action:
set <key> <value>       # 设置配置项
get <key>               # 查看配置项
list                    # 列出所有配置
init                    # 初始化配置文件

示例:
skill-sync config set default_agent claude-code
skill-sync config get distribution_mode
skill-sync config list
```

#### `skill-sync clean`

```bash
skill-sync clean [options]

# 清理缓存/备份/孤儿文件
--cache                 # 清理缓存目录
--backups <name>        # 清理指定 skill 的所有备份
--orphans               # 清理 Agent 目录中不在 manifest 中的 skill（仅删 symlink）
--all                   # 清理以上所有
-f, --force             # 允许删除真实目录（默认只删 symlink）
```

#### `skill-sync doctor`

```bash
skill-sync doctor

# 环境健康检查
# 检测项:
# - 中央仓库是否存在且完整
# - config.yaml 是否有效
# - secrets.yaml 是否存在（可选）
# - Git 是否已初始化
# - 各 Agent 目录是否可访问
# - 软链接是否完好
# - skills-lock.json 是否与文件系统一致
# - 磁盘空间是否充足
```

#### `skill-sync ui`（Phase 2）

```bash
skill-sync ui [options]

# 启动 Web Dashboard
--port <port>           # 指定端口（默认: 自动选择可用端口）
--no-open               # 不自动打开浏览器
--host <host>           # 监听地址（默认: localhost）

# 自动选择可用端口（从 17170 开始递增）并打开浏览器
```

### 9.3 全局选项与环境变量

**全局选项**：

```
--config <path>         # 指定配置文件路径（默认: ~/.skill-sync/config.yaml）
--home <path>           # 指定中央仓库根目录（默认: ~/.skill-sync/）
--verbose, -v           # 详细输出
--quiet, -q             # 静默模式
--no-color              # 禁用彩色输出
--help, -h              # 显示帮助
```

**环境变量**：

| 环境变量 | 用途 | 默认值 |
|---------|------|--------|
| `SKILL_SYNC_HOME` | 覆盖中央仓库根目录 | `~/.skill-sync/` |
| `SKILL_SYNC_AGENTS_DIR` | 覆盖 Agent 目录根路径（用于测试隔离） | `~`（真实 home） |
| `GITHUB_TOKEN` / `GH_TOKEN` | GitHub API token（Lazy Token 策略） | 无 |
| `HTTP_PROXY` / `HTTPS_PROXY` | 网络代理 | 无 |

> **`SKILL_SYNC_HOME` 优先级**：`--home` 参数 > `SKILL_SYNC_HOME` 环境变量 > `config.yaml → home` > `~/.skill-sync/`
>
> **`SKILL_SYNC_AGENTS_DIR`** 用于测试隔离：设置后所有 Agent 路径（如 `~/.claude/skills`）将重定向到 `<SKILL_SYNC_AGENTS_DIR>/.claude/skills`。

---

## 10. 分发机制摘要

> **详细设计**：[docs/design-distribution.md](docs/design-distribution.md)

**核心要点**：
- **目标目录命名**：默认 `<skill-name>`；同名冲突时 `<namespace>-<skill-name>`；用户可配置覆盖
- **分发模式**：macOS/Linux 默认 symlink，Windows 默认 **junction**（不需要管理员权限），junction 失败时降级为 copy
- **分发流程**：检测目标存在 → 判断是否被手动修改（source_hash）→ 创建/覆盖/提示
- **增量同步**（copy 模式）：只复制新增和变更文件，删除多余文件
- **source_hash**：SHA256(文件列表 + 每个文件的 SHA256)，用于检测手动修改
- **undeploy**：symlink/junction 解除链接+复制内容，copy 保持不变；`managed = false`
- **`remove --central` vs `undeploy --all`**：前者删除中央仓库+Agent 变孤儿；后者保留中央仓库+Agent 变副本

---

## 11. 安全设计 / 错误处理 / 依赖管理摘要

> **详细设计**：[docs/design-security-errors-deps.md](docs/design-security-errors-deps.md)

### 安全设计
- 最小权限、敏感配置分离（`secrets.yaml`）、Skill 内容不记录日志、执行前确认
- source_hash 校验、路径安全校验（sanitize）、路径重叠检测、远程代码审计、Lazy Token

### 错误处理
- **退出码**：0 成功 / 1 通用错误 / 2 参数错误 / 3 未初始化 / 4 网络错误 / 5 文件系统错误 / 6 冲突错误 / 7 依赖缺失 / 8 部分失败
- **错误恢复**：安装回滚、升级回滚、lock 重建、manifest 重建、软链接修复

### 依赖管理
- **声明位置**：`manifest.yaml` + SKILL.md frontmatter `metadata.depends_on`
- **处理逻辑**：安装时检查依赖、删除时检查反向依赖、SemVer range 匹配、传递性依赖（深度限制 10 层）、循环依赖检测
- **简化策略**：仅警告级别，不强制阻止，`--ignore-deps` 可跳过
- **post_install**：仅在 copy 模式执行，执行前展示脚本内容需确认

---

## 12. Git 仓库结构与 .gitignore 策略摘要

> **详细设计**：[docs/design-sync-git.md](docs/design-sync-git.md)（§14 部分）
> **决策来源**：D-08

**核心要点**：
- **Git 仓库范围**：`~/.skill-sync/` 整体是一个 Git 仓库
- **同步**：`skills/`、`config.yaml`、`skills-lock.json`、`tags.yaml`
- **不同步**（.gitignore）：`cache/`、`temp/`、`secrets.yaml`、`skills/*/.backup/`、OS/编辑器/Node.js 文件
- **secrets.yaml 机制**：用户手动创建，`config.yaml` 通过 `${secrets.github.token}` 变量引用；`init` 自动创建模板

---

## 13. 测试策略摘要

> **详细设计**：[docs/design-testing.md](docs/design-testing.md)

**核心要点**：
- **灰度测试约束**：禁止动用用户真实 skill 目录，使用 `SKILL_SYNC_HOME` + `SKILL_SYNC_AGENTS_DIR` 环境变量重定向到模拟沙箱
- **测试沙箱**：`test-env/.skill-sync/` + `test-env/agents/`，集成测试自动设置到 `os.tmpdir()`
- **框架**：Vitest + msw (HTTP mock) + simple-git (Git mock)
- **测试分层**：单元测试（core/ + lib/）→ 集成测试 → E2E 测试（可选）
- **覆盖率**：总体 ≥ 90%，Core 层 ≥ 95%，CLI 层 ≥ 80%

---

## 14. 参考项目分析 / 技术选型 / 决策记录摘要

> **详细设计**：[docs/reference.md](docs/reference.md)

### 参考项目
- **TeleAgent skill-sync**：TypeScript + Commander.js 小型实现，直接参考 agents/scanner/deploy/github/source/dependencies/post-install/manifest/lock 模块
- **Skiller**：Tauri + Rust 桌面应用，UI 交互逻辑参考（不采用技术栈）

### 技术栈
| 维度 | 选型 |
|------|------|
| 语言 | TypeScript / Node.js (≥ 20.0.0) |
| CLI 框架 | Commander.js |
| Git 操作 | simple-git |
| YAML 解析 | yaml |
| UI 框架（Phase 2） | Vue 3 + Vite + Naive UI + UnoCSS + md-editor-v3 (D-21) |
| HTTP 框架（Phase 2） | Hono（76KB，TS 原生，零依赖） |
| 测试框架 | Vitest |

### 决策记录
D-01~D-21 全部决策详见 [docs/reference.md](docs/reference.md)。

---

## 15. 路线图

### Phase 0: 基础设施（Week 1-2）

- [ ] 项目初始化（TypeScript + Commander.js + chalk + yaml）
- [ ] 配置系统实现（`config.yaml` / `secrets.yaml` 读写）
- [ ] 目录结构初始化（`skill-sync init`）
- [ ] Agent 注册表实现（12+ Agent，含 `detectInstalled`）
- [ ] 散落 skill 扫描器（`scanner.ts`，支持 `--scan-path`）
- [ ] SKILL.md 解析与 frontmatter 提取（含 `metadata` 扩展字段）
- [ ] **Core 层 API 设计**（纯 TypeScript 模块，为 UI 层预留）
- [ ] Git 仓库初始化 + `.gitignore` + `secrets.yaml` 模板

### Phase 1: 核心能力（Week 3-5）

- [ ] `skill-sync install` — GitHub Trees API 安装 + 自建下载逻辑
- [ ] `skill-sync list` / `skill-sync info` — 列表与详情
- [ ] `skill-sync search` — 本地模糊搜索 + skills.sh API 搜索
- [ ] `skill-sync deploy` / `skill-sync undeploy` — 分发与撤销
- [ ] `skill-sync status` — 全局状态概览
- [ ] `skill-sync remove` — 删除（支持范围参数）
- [ ] `skill-sync check` / `skill-sync update` — 检查更新与升级（自动备份）
- [ ] `skill-sync switch` — 从备份恢复
- [ ] `skill-sync tag` — 标签管理
- [ ] `skill-sync config` — 配置管理
- [ ] `skill-sync clean` — 清理
- [ ] `skill-sync doctor` — 环境健康检查
- [ ] `skill-sync sync push/pull` — Git 同步
- [ ] 依赖管理逻辑实现
- [ ] 错误处理与异常恢复机制
- [ ] 测试：单元测试 + 集成测试（覆盖率 ≥ 90%）

### Phase 2: UI 层 + 增强（Week 6-9）

- [ ] `skill-sync ui` — 启动 Web Dashboard（自动选择端口 + 打开浏览器）
- [ ] HTTP API 层实现（Hono 框架，Core API 的薄封装）
- [ ] Vue 3 + Vite + Naive UI + UnoCSS 脚手架
- [ ] Skills 浏览/搜索页（本地 + skills.sh）
- [ ] Skill 详情预览页（md-editor-v3 MdPreview 渲染 SKILL.md、版本信息、一键安装）
- [ ] 本地 Skill 管理页（分发状态、标签筛选）
- [ ] 冲突检测与解决（5 种策略）
- [ ] 更多 Agent 适配验证

### Phase 3: 生态与体验（Week 10-12）

- [ ] skills.sh 搜索结果缓存与刷新
- [ ] 国际化（中/英）
- [ ] CHANGELOG 自动生成
- [ ] 单文件二进制打包
- [ ] 性能优化（大仓库增量同步）

---

> **文档结束（v1.2.1）**
>
> **v1.2.0 → v1.2.1 变更**：
> - 文档拆分：将 §6 版本管理、§7 同步机制、§8 skills.sh 集成、§10 分发机制、§11 安全设计、§12 错误处理、§13 依赖管理、§14 Git 策略、§15 测试策略、§16 参考项目、§17 技术选型、§18 决策记录、§20 引用来源、附录 拆分到 `docs/` 目录下 7 个外部文档
> - 主 PRD 保留：§1 产品概述、§2 需求分析、§3 技术决策总览、§4 系统架构、§5 数据模型、§9 CLI 命令规范、§15 路线图
> - 外部文档通过摘要 + 链接引用，开发时按需加载
>
> **v1.1 → v1.2.0 变更摘要**：
> - 简化版本管理：去掉多版本并存，改为备份 + 升级模式（D-19）
> - 删除项目级管理（D-09）
> - 删除 `create`/`add`/`bump` 命令，`bump` 合并到 `update`（D-16）
> - `init` 支持扫描用户自定义路径（D-17）
> - `undeploy` 后保留副本，不再纳入管理（D-18）
> - `switch` 恢复后需手动重新 `deploy`（D-20）
> - UI 框架确定为 Vue 3 + Naive UI + UnoCSS + md-editor-v3（D-21）
> - HTTP 框架确定为 Hono（含选型对比）
> - Markdown 渲染确定为 md-editor-v3 MdPreview 组件
> - 新增核心类型定义、tags.yaml 格式定义
> - 新增错误处理与异常场景、依赖管理逻辑、Git 仓库结构策略、测试策略
> - 使用命名空间避免名称冲突（D-14）
> - `secrets.yaml` 分离敏感信息（D-08）
> - 移除 WebDAV 相关内容（仅保留 Git 同步）
> - 先不实现自动同步（D-13）
> - 先不考虑插件/钩子
> - 参考 TeleAgent skill-sync 小型实现
