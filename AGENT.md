# AGENT.md — SkillSync 开发指南

> 本文件供 AI Agent（如 CatPaw、Claude Code 等）在参与 SkillSync 开发时遵循。
> PRD 主文档：`PRD-SkillSync-v1.2.md`
> 详细设计文档：`docs/` 目录下 7 个文件

---

## 项目概述

SkillSync 是一款跨端跨 Agent 的 AI Skill 管理工具。CLI 优先，Phase 2 提供 Web Dashboard。技术栈：TypeScript + Commander.js + yaml + Vitest。

## 关键约束（必须遵守）

### 1. 灰度测试约束

**禁止动用用户真实的 skill 目录**。所有测试和灰度验证必须在项目目录下模拟。

- `SKILL_SYNC_HOME` 环境变量覆盖中央仓库路径（默认 `~/.skill-sync/`）
- `SKILL_SYNC_AGENTS_DIR` 环境变量覆盖 Agent 目录根路径
- 测试时所有 Agent 路径重定向到沙箱：`~/.claude/skills` → `<SKILL_SYNC_AGENTS_DIR>/.claude/skills`
- 集成测试使用 `os.tmpdir()` 并在测试后自动清理

### 2. 文件系统是唯一真相源

- 文件系统目录树是数据的真实来源
- `manifest.yaml` 是 skill 级真相源，`skills-lock.json` 是全局镜像
- 写操作顺序：先更新 manifest.yaml → 再同步到 skills-lock.json
- 两者冲突时以 manifest.yaml 为准

### 3. Core 层与 CLI 层分离

- Core 层（`src/core/`）是纯 TypeScript 模块，通过 `SkillSyncContext` 依赖注入
- Core 层**不依赖**任何 CLI 框架（Commander.js）或 HTTP 框架（Hono）
- CLI 命令（`src/commands/`）是 Core API 的薄封装
- Phase 2 的 HTTP API 层也是 Core API 的薄封装

### 4. 配置格式

- 全局配置：`config.yaml`（YAML 格式，非 JSON）
- 敏感信息：`secrets.yaml`（.gitignore，不同步）
- Skill 元数据：`manifest.yaml`（YAML 格式，非 JSON）
- 锁文件：`skills-lock.json`（JSON 格式，保持不变）
- 标签定义：`tags.yaml`（YAML 格式）

### 5. 命名空间

- 所有 skill 使用 `<namespace>/<skill-name>` 格式
- 目录结构：`skills/<namespace>/<skill-name>/`
- GitHub 安装：namespace = GitHub owner
- 本地导入：namespace 默认 `local`，可指定
- init 扫描导入：namespace = 原始 Agent 目录名

### 6. 分发模式与平台适配

分发时的链接策略按平台优先级：

| 平台 | 优先策略 | 降级策略 | 说明 |
|------|----------|----------|------|
| macOS / Linux | symlink | copy | symlink 不需要特殊权限 |
| Windows | **junction** | copy | junction 不需要管理员权限/开发者模式；普通 symlink 需要 |

**关键点**：
- Windows 上**优先使用 junction**（`fs.symlinkSync(target, path, 'junction')`），而非普通 symlink
- junction 是 Windows 特有的目录链接方式，不需要管理员权限或开发者模式
- 仅当 junction 也失败时（如权限不足），才降级为 copy
- macOS/Linux 使用普通 symlink（`fs.symlinkSync(target, path)`）
- copy 模式作为最终降级方案，始终可用

### 7. 安全约束

- frontmatter 中不得出现 XML 尖括号（`<` / `>`）
- skill 名经过 sanitize（kebab-case），防止路径遍历
- 不支持 `---js` / `---javascript` frontmatter（避免 RCE）
- 终端输出前必须使用 `sanitizeMetadata()` 清理转义序列
- 分发前检测路径重叠（防止安装到源目录上）

### 8. 退出码

| 码 | 含义 |
|----|------|
| 0 | 成功 |
| 1 | 通用错误 |
| 2 | 参数错误 |
| 3 | 未初始化 |
| 4 | 网络/远程错误 |
| 5 | 文件系统错误 |
| 6 | 冲突错误 |
| 7 | 依赖缺失 |
| 8 | 部分失败 |

### 9. Git 提交信息格式

```
chore(skills): <action> <skill-name> [<detail>]
```

示例：
- `chore(skills): install anthropics/pdf-processing@1.1.0`
- `chore(skills): update vercel-labs/web-design 1.0.0→1.1.0`
- `chore(skills): deploy anthropics/pdf-processing to claude-code,cursor`

## 参考项目

遇到不清楚的逻辑或踩坑点时，参考以下两个项目：

### TeleAgent skill-sync（主要参考）

**路径**：`/Users/agan/.local/share/TeleAgent/TeleAgent的工作空间/skill-sync`

这是 SkillSync 的小型参考实现，技术栈完全一致（TypeScript + Commander.js + chalk + yaml + Vitest）。以下模块可直接参考：

| 模块 | 参考价值 |
|------|----------|
| `src/lib/agents.ts` | Agent 注册表结构、`detectInstalled` 检测逻辑、环境变量覆盖 |
| `src/lib/scanner.ts` | 散落 skill 扫描流程、symlink 检测、按 Agent 分组 |
| `src/lib/deploy.ts` | symlink/copy 部署、增量同步、路径安全校验、symlink 降级 |
| `src/lib/github.ts` | Trees API 使用、Lazy Token 策略、代理检测、curl 封装 |
| `src/lib/source.ts` | 多格式 source 字符串解析（owner/repo、URL、SSH、本地路径） |
| `src/lib/frontmatter.ts` | SKILL.md YAML frontmatter 解析 |
| `src/lib/sanitize.ts` | 终端转义序列清理（防 CWE-150） |
| `src/lib/manifest.ts` / `lock.ts` | manifest/lock 文件读写 |
| `src/lib/dependencies.ts` | 依赖检查逻辑 |
| `src/lib/post-install.ts` | post_install 脚本执行 |

**与 v1.2 的关键差异**（需要改进的点）：
- 配置格式从 JSON 改为 YAML
- 新增命名空间（`<namespace>/<skill-name>`）
- 新增版本管理（备份 + 恢复）
- 新增 skills.sh 搜索集成
- 新增标签系统（tags.yaml）
- 新增 Git 同步（push/pull）
- Core 层使用 Context 依赖注入（参考实现是函数式调用）

### Skiller（UI 参考）

**路径**：`/Users/agan/Documents/code-dev/skill-sync/Skiller-main`

Tauri + Rust + React 桌面应用。技术栈不同，但 UI 交互逻辑可参考：
- Tag Groups + 多对多关联的交互设计
- ClawHub 在线发现页面布局
- Skill Center 列表/搜索/展示流程
- 分发冲突检测 UX

## 项目结构

```
skill-sync/
├── AGENT.md                 # 本文件
├── PRD-SkillSync-v1.2.md    # 主 PRD
├── docs/                    # 详细设计文档（7 个）
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── bin/
│   │   └── skill-sync.ts          # CLI 入口
│   ├── commands/                   # 命令实现（Core API 的薄封装）
│   ├── core/                       # 核心引擎（CLI 与 UI 共享）
│   │   ├── context.ts              # SkillSyncContext + createContext
│   │   ├── skill-manager.ts
│   │   ├── version-manager.ts
│   │   ├── dispatcher.ts
│   │   ├── installer.ts
│   │   ├── sync-manager.ts
│   │   └── scanner.ts
│   ├── lib/                        # 工具模块
│   │   ├── agents.ts               # Agent 注册表
│   │   ├── deploy.ts               # 部署逻辑
│   │   ├── github.ts               # GitHub API
│   │   ├── source.ts               # source 解析
│   │   ├── frontmatter.ts          # SKILL.md 解析
│   │   ├── dependencies.ts         # 依赖管理
│   │   ├── manifest.ts             # manifest 读写
│   │   ├── lock.ts                 # lock 文件读写
│   │   ├── sanitize.ts             # 名称清理
│   │   ├── post-install.ts         # post_install 执行
│   │   ├── constants.ts            # 常量
│   │   ├── paths.ts                # 路径工具
│   │   └── types.ts                # 类型定义
│   └── config.ts                   # 配置管理
├── tests/
│   ├── core/
│   ├── lib/
│   ├── integration/
│   └── e2e/
└── ui/                             # Phase 2: Web Dashboard
```

> **注意**：Phase 2 Web Dashboard 实际位于 `web/` 目录，结构如下：
>
> ```
> web/
> ├── src/
> │   ├── api.ts                 # API 客户端
> │   ├── App.vue                # 主框架（侧边栏 + 内容区）
> │   ├── main.ts                # 入口
> │   ├── env.d.ts               # TypeScript 声明（svg?raw 等）
> │   ├── naive-ui-provider.ts   # Naive UI 全局组件注册
> │   ├── components/            # 通用组件（kebab-case）
> │   │   └── brand-icon.vue     # @lobehub/icons-static-svg 品牌图标
> │   ├── composables/           # Vue composables（use-xxx.ts）
> │   └── pages/                 # 页面组件（PascalCase）
> │       ├── SkillsPage.vue
> │       ├── SearchPage.vue
> │       ├── ManagePage.vue
> │       ├── SyncPage.vue
> │       ├── SettingsPage.vue
> │       ├── ConflictsPage.vue
> │       ├── StatusPage.vue
> │       └── SkillDetailPage.vue
> ├── uno.config.ts              # UnoCSS 配置（tailwind-like）
> └── vite.config.ts            # Vite 配置
> ```

## 开发流程

1. **先读 PRD**：主 PRD（`PRD-SkillSync-v1.2.md`）包含架构、数据模型、CLI 命令规范
2. **按需读详细设计**：开发特定模块时读取对应的 `docs/` 文档
3. **参考 TeleAgent 实现**：遇到逻辑不确定时查看参考项目对应模块
4. **写测试**：每个模块配套单元测试，Core 层覆盖率 ≥ 95%
5. **测试隔离**：所有测试使用 `SKILL_SYNC_HOME` + `SKILL_SYNC_AGENTS_DIR` 隔离

## 技术栈版本

| 依赖 | 版本 |
|------|------|
| Node.js | >= 24.0.0 |
| TypeScript | ≥ 5.5 |
| Commander.js | ≥ 12.0 |
| chalk | ^5.0 (ESM) |
| yaml | ^2.9 |
| simple-git | ^3.0 |
| Vitest | ^2.0 |
| cli-table3 | ^0.6 |
| inquirer | ^9.0 (ESM) |
| ora | ^8.0 (ESM) |
| semver | ^7.0 |

> Phase 2 额外依赖：Vue 3 + Vite + Naive UI + UnoCSS + Hono + md-editor-v3

---

## 前端开发规范

### 样式层：UnoCSS (Tailwind-like)

- 使用 UnoCSS 原子化 CSS，写法类似 Tailwind CSS（`flex`, `items-center`, `text-sm`, `bg-white/60` 等）
- 配置文件：`web/uno.config.ts`，已预设 `presetUno()` + `presetIcons()` + `presetTypography()`
- 自定义快捷类（shortcuts）：`glass-card`、`glass-card-hover`、`section-title`、`section-desc`
- 自定义主题色：`apple-blue`、`apple-green`、`apple-orange`、`apple-red`、`apple-purple`、`apple-gray`、`apple-dark`
- **优先使用 UnoCSS 原子类**，仅在需要动态计算样式（如 `v-bind` style）时使用 `<style scoped>`
- 避免在 `<style scoped>` 中重复 UnoCSS 已覆盖的能力

### 命名规范

- 组件文件名：**kebab-case**（短横线），如 `brand-icon.vue`、`skill-card.vue`
- 页面文件名：**PascalCase** 保持 Vue 惯例，如 `SkillsPage.vue`、`SettingsPage.vue`
- 变量/函数：camelCase
- 类型/接口：PascalCase
- CSS 类名：kebab-case
- API 端点：kebab-case（如 `/api/sync/status`）

### 工具方法

- **先查 npm 生态**，避免重复造轮子
- 日期处理：`date-fns`（已安装）
- 工具函数：`lodash-es`（按需安装）
- HTTP 请求：原生 `fetch`（项目内已有封装）
- 状态管理：Vue 3 原生 `ref`/`reactive`/`computed`，复杂场景用 Pinia
- 仅在没有现成库满足需求时才自行实现

### Hooks / Composables

- 当逻辑复杂度提升或需要在多个组件间复用时，抽取为 **composable**（`use-xxx.ts`）
- 存放目录：`web/src/composables/`
- 命名：`use-xxx.ts`（kebab-case），导出函数 `useXxx`
- 示例：`use-sync-status.ts`、`use-ai-providers.ts`

### 品牌图标

- 使用 `@lobehub/icons-static-svg` 包（非 React 版本），通过 Vite `?raw` 导入 SVG
- 封装在 `web/src/components/brand-icon.vue` 组件中
- **不要**使用 `simple-icons` 或 `@lobehub/icons`（React 版本，依赖过重）
- TypeScript 声明：`web/src/env.d.ts` 中声明 `*.svg?raw` 模块

### 组件化原则

- 通用 UI 片段抽取为组件，存放在 `web/src/components/`
- 页面级组件存放在 `web/src/pages/`
- 组件 props 使用 `withDefaults(defineProps<>(), {})` 类型安全写法
- 事件使用 `defineEmits<{}>()` 类型安全写法

### AI Provider 约定

- 后端厂商注册表：`src/lib/ai-provider.ts`，预设 11 个厂商
- API Key 存储在 `secrets.yaml`（权限 0600），不存入 `config.yaml`
- 所有厂商使用 OpenAI 兼容格式（`/chat/completions`）
- 添加新厂商时同步更新 `brand-icon.vue` 的 `ICON_MAP`
