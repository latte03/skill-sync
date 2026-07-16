# 参考资料：参考项目分析、技术选型与决策记录

> **来源**：PRD-SkillSync v1.2 §16 + §17 + §18 + §20 + 附录

---

## 16. 参考项目分析

### 16.1 TeleAgent skill-sync（小型实现）

> **路径**：`/Users/agan/.local/share/TeleAgent/TeleAgent的工作空间/skill-sync`

这是 SkillSync 的一个小型参考实现，技术栈：TypeScript + Commander.js + chalk + yaml，测试用 Vitest。

**关键模块及借鉴价值**：

| 模块 | 功能 | 借鉴价值 |
|------|------|----------|
| `agents.ts` | 12 个 Agent 注册表，含 `detectInstalled` | ✅ 直接参考 Agent 配置结构和检测逻辑 |
| `scanner.ts` | 扫描散落 skill | ✅ 参考 init 扫描流程 |
| `deploy.ts` | symlink/copy + 增量同步 | ✅ 参考部署逻辑、路径安全校验、增量同步 |
| `github.ts` | Trees API 发现 skill + lazy token + 代理检测 | ✅ 参考 Trees API 使用方式和 lazy token 策略 |
| `source.ts` | 多格式 source 解析 | ✅ 参考 source 字符串解析逻辑 |
| `dependencies.ts` | 依赖管理 | ✅ 参考依赖检查逻辑 |
| `post-install.ts` | post_install 脚本执行 | ✅ 参考执行逻辑 |
| `manifest.ts` / `lock.ts` | manifest.json + skill-lock.json 读写 | ✅ 参考数据结构设计 |

**与 v1.2 的差异**：

| 维度 | 参考实现 | v1.2 目标 |
|------|----------|-----------|
| 配置格式 | JSON (manifest.json) | YAML (manifest.yaml + config.yaml) |
| 版本管理 | 无 | 备份 + 恢复 |
| SkillKey | 无 | ✅ 单一不透明标识；GitHub 来源为 `<owner>/<repo>/<skill-path>` |
| skills.sh | 无 | ✅ 搜索 API 集成 |
| 标签系统 | 无 | ✅ tags.yaml |
| 同步 | 无 | ✅ Git push/pull |
| UI | 无 | ✅ Phase 2 Web Dashboard |

### 16.2 Skiller 项目

| 属性 | 值 |
|------|-----|
| 名称 | Skiller |
| 开源地址 | [AFunc-OPC/Skiller](https://github.com/AFunc-OPC/Skiller) |
| 技术栈 | Tauri 2.x + Rust + React 18 + Tailwind CSS + SQLite |

**值得借鉴的设计**：

| 设计点 | 说明 | 采用程度 |
|--------|------|----------|
| Tag Groups + 多对多关联 | 标签分组管理的交互设计 | ✅ 思路沿用 |
| ClawHub 在线发现页面 | 布局和信息展示方式 | ✅ UI 层参考（Phase 2） |
| Skill Center 列表/搜索/展示 | 搜索/列表/详情的交互流程（不含创建/编辑） | ✅ UI 层参考（Phase 2） |
| 分发冲突检测 UX | 内联提示 + 覆盖支持 | ✅ 功能+UX 参考 |
| Tauri + Rust 后端 | 框架绑定 | ❌ 不采用 |
| SQLite 存储 | 存储层选择 | ❌ 不采用 |

---

## 17. 技术选型补充说明

### 17.1 技术栈

| 维度 | 选型 | 理由 |
|------|------|------|
| 语言 | TypeScript / Node.js (≥ 20.0.0) | 生态匹配（skills CLI 本身是 Node.js），Vue 3 同样支持 TS |
| CLI 框架 | Commander.js | 成熟稳定，参考实现已验证 |
| Git 操作 | simple-git | 成熟库 |
| GitHub API | @octokit/rest 或直接 curl | 参考实现使用 curl（避免引入过多依赖） |
| YAML 解析 | yaml | 参考实现已使用 |
| 表格输出 | cli-table3 | 成熟库 |
| 交互式提示 | inquirer | 成熟库 |
| 进度条 | ora | 成熟库 |
| 配色 | chalk | 参考实现已使用 |
| UI 框架（Phase 2） | Vue 3 + Vite + Naive UI + UnoCSS | 轻量、TypeScript 友好、组件丰富；UnoCSS 提供原子化 CSS（D-21） |
| HTTP 框架（Phase 2） | Hono | 轻量（~76KB vs Express ~754KB），TS 原生，零依赖。详见 §17.2 |
| 测试框架 | Vitest | 参考实现已使用 |
| SemVer 解析 | semver | 依赖版本匹配 |
| Markdown 渲染（Phase 2） | md-editor-v3 (MdPreview 组件) | 完整方案：渲染+语法高亮+XSS 防护+暗色主题。详见 §17.2 |

### 17.2 技术选型对比与理由

#### Hono（HTTP 框架）

| 框架 | unpacked 大小 | TS 原生 | 依赖数 | 适用性 |
|------|-------------|---------|--------|--------|
| **Hono** | ~76KB | ✅ 内置 | 0 | ★ 最佳：轻量、Web Standards API、多 runtime 兼容 |
| Express | ~754KB | ❌ 需 @types/express | 64+ | 过重，API 设计老旧 |
| Fastify | ~2.9MB | ✅ | 30+ | 插件体系强大但对薄封装过重 |

**选型理由**：
1. **体积**：76KB vs Express 754KB（10x）vs Fastify 2.9MB（38x），对 CLI 工具的安装和启动速度影响显著
2. **TypeScript 原生**：类型内置，无需 `@types/hono`，开发体验好
3. **零依赖**：除 Node.js adapter 外无外部依赖，减少供应链风险
4. **Web Standards API**：使用标准 `Request`/`Response` 对象，与浏览器 API 一致
5. **静态文件服务**：内置 `serveStatic` 中间件，可直接服务 Vue 构建产物
6. **多 runtime 兼容**：未来如切换到 Bun/Deno 无需改代码

#### md-editor-v3（Markdown 渲染）

| 方案 | unpacked 大小 | 语法高亮 | XSS 防护 | 主题 | 开箱即用 |
|------|-------------|----------|----------|------|----------|
| **md-editor-v3** | ~518KB | ✅ 内置 (Lezer) | ✅ 内置 (xss) | ✅ 暗色/亮色 | ★ 完整方案 |
| vue-markdown-render | ~80KB | ❌ 需手动拼装 | ❌ 需手动拼装 | ❌ 需手动拼装 | 仅 markdown-it 封装 |
| markdown-it 手拼 | — | ❌ 需自行集成 | ❌ 需自行集成 | ❌ 需自行集成 | 需自己组装 Vue 组件 + 插件链 |

**选型理由**：
1. **完整方案**：语法高亮、XSS 防护、暗色/亮色主题、图片缩放全部内置，无需重复造轮子
2. **MdPreview 组件**：导出纯预览组件（不含编辑器），适合 SkillSync 只读展示 SKILL.md 的场景
3. **活跃维护**：v6.5.3（2026-06 发布），Vue 3 原生组件
4. **与 Naive UI 主题协调**：支持自定义主题，可与 Naive UI 的暗色模式联动
5. **XSS 防护**：渲染第三方 SKILL.md 时安全性至关重要，内置 `xss` 包自动过滤危险 HTML

> **注意**：前端解析 YAML frontmatter 可使用 `gray-matter` 库提取，Markdown 正文交由 `MdPreview` 渲染。

### 17.3 项目初始化结构

```
skill-sync/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── bin/
│   │   └── skill-sync.ts              # CLI 入口
│   ├── commands/                       # 命令实现（Core API 的薄封装）
│   │   ├── init.ts
│   │   ├── install.ts
│   │   ├── remove.ts
│   │   ├── list.ts
│   │   ├── search.ts
│   │   ├── info.ts
│   │   ├── check.ts
│   │   ├── update.ts
│   │   ├── switch.ts
│   │   ├── deploy.ts
│   │   ├── undeploy.ts
│   │   ├── status.ts
│   │   ├── sync.ts
│   │   ├── tag.ts
│   │   ├── config.ts
│   │   ├── clean.ts
│   │   ├── doctor.ts
│   │   └── ui.ts                       # Phase 2
│   ├── core/                           # 核心引擎（CLI 与 UI 共享）
│   │   ├── skill-manager.ts
│   │   ├── version-manager.ts
│   │   ├── dispatcher.ts
│   │   ├── installer.ts
│   │   ├── sync-manager.ts
│   │   └── scanner.ts
│   ├── lib/                            # 工具模块
│   │   ├── agents.ts                   # Agent 注册表
│   │   ├── deploy.ts                   # 部署逻辑
│   │   ├── github.ts                   # GitHub API
│   │   ├── source.ts                   # source 解析
│   │   ├── frontmatter.ts             # SKILL.md 解析
│   │   ├── dependencies.ts             # 依赖管理
│   │   ├── manifest.ts                 # manifest 读写
│   │   ├── lock.ts                     # lock 文件读写
│   │   ├── sanitize.ts                 # 名称清理
│   │   ├── post-install.ts             # post_install 执行
│   │   ├── constants.ts                # 常量
│   │   ├── paths.ts                    # 路径工具
│   │   └── types.ts                    # 类型定义
│   ├── config.ts                       # 配置管理
│   └── http/                           # Phase 2: HTTP API 层
│       └── server.ts
├── ui/                                 # Phase 2: Web Dashboard (Vue 3 + Naive UI + UnoCSS)
│   ├── package.json
│   ├── vite.config.ts
│   ├── uno.config.ts                  # UnoCSS 配置
│   ├── index.html
│   └── src/
│       ├── App.vue
│       ├── main.ts
│       ├── router/
│       ├── pages/
│       │   ├── SkillList.vue           # Skill 列表/搜索页
│       │   ├── SkillDetail.vue         # Skill 详情预览页（md-editor-v3 MdPreview）
│       │   └── Settings.vue            # 配置页
│       ├── components/
│       └── api/                        # HTTP 封装层，调用 core/*
├── tests/                              # 测试
│   ├── core/
│   ├── lib/
│   ├── integration/
│   └── e2e/
└── README.md
```

---

## 18. 已确认决策记录

以下为用户已审阅并确认的决策项。

---

### D-01: skills.sh 集成方式 — 自建下载逻辑

| 项目 | 内容 |
|------|------|
| **决策** | 不依赖 `npx skills add`，参考 vercel-labs/skills 源码自建下载逻辑 |
| **影响** | §8 安装流程 |

### D-02: SKILL.md 扩展字段 — 统一收纳到 `metadata`

| 项目 | 内容 |
|------|------|
| **决策** | 所有 SkillSync 扩展字段统一收纳到 Anthropic 官方预留的 `metadata` 容器中 |
| **影响** | §5.3 frontmatter 规范 |

### D-03: 数据规模 — 百级别

| 项目 | 内容 |
|------|------|
| **决策** | 约 100-500 个 skill，索引策略简化为 JSON Lines 内存索引 |

### D-04: 权限控制 — 不需要

| 项目 | 内容 |
|------|------|
| **决策** | 不需要内置权限控制，团队协作通过私有 Git 仓库间接实现 |

### D-05 / D-15: 大文件处理

| 项目 | 内容 |
|------|------|
| **决策** | 默认不特殊处理，10MB 软上限警告。暂不引入 Git LFS |

### D-06: UI 层 — 需要实现（Phase 2 正式功能）

| 项目 | 内容 |
|------|------|
| **决策** | CLI 优先，UI 层作为 Phase 2 正式功能 |
| **影响** | §4 架构分层，§19 路线图 |

### D-07: 与 Skiller 的关系 — 独立项目 + 交互参考

| 项目 | 内容 |
|------|------|
| **决策** | 独立项目，Skiller 交互逻辑和 UI 可作为参考 |

### D-08: Git 仓库的范围 ✅

| 项目 | 内容 |
|------|------|
| **决策** | `~/.skill-sync/` 整体是一个 Git 仓库。敏感信息放 `secrets.yaml`，该文件 `.gitignore` |
| **影响** | §14 Git 仓库结构 |

### D-09: 项目级 Skill 的存储位置 ✅

| 项目 | 内容 |
|------|------|
| **决策** | 项目级存储在项目中，不纳入管理。删除所有项目级相关设计 |
| **影响** | 删除 §5 中 `projects/` 目录、`project` 命令组、lock 文件中 `projects` 字段 |

### D-10: CLI 命令名称 ✅

| 项目 | 内容 |
|------|------|
| **决策** | CLI 命令名 `skill-sync`，npm 包名 `skill-sync` |

### D-11: skills.sh 数据获取方式 ✅

| 项目 | 内容 |
|------|------|
| **决策** | 搜索 API: `https://skills.sh/api/search?q={query}`。详情页: `https://skills.sh/{source}/{skill_id}` |
| **影响** | §8 skills.sh 集成方案 |

### D-12: 本地创建 Skill 的版本管理流程 ✅

| 项目 | 内容 |
|------|------|
| **决策** | 用户本地自行创建 skill，初始版本 `0.0.0`，允许在同一版本内修改。不涉及 bump 命令 |
| **影响** | §6 版本管理方案 |

### D-13: 自动同步功能 ✅

| 项目 | 内容 |
|------|------|
| **决策** | 先不实现自动同步，用户手动执行 `sync` 命令 |

### D-14: SkillKey 的规范与冲突策略 ✅

| 项目 | 内容 |
|------|------|
| **决策** | 业务层只传递一个不拆分的 `SkillKey`。GitHub skill 使用 `<owner>/<repo>/<skill-path>`；本地 skill 使用相对来源根目录的规范化路径。目录为 `skills/<skill-key>/`。 |
| **影响** | §5.1 目录结构 |

### D-16: `bump` vs `update` 合并 ✅

| 项目 | 内容 |
|------|------|
| **决策** | 删除 `bump` 命令，其功能合并到 `update`。`update <name>` = 拉取远程最新版 → 备份当前版 → 替换 |
| **影响** | §9 CLI 命令规范 |

### D-17: `init` 扫描范围 ✅

| 项目 | 内容 |
|------|------|
| **决策** | `init` 扫描已知 Agent 目录 + 用户自定义路径（`--scan-path` 参数） |
| **影响** | §9.2 `init` 命令规格 |

### D-18: `undeploy` 后的 Agent skill 状态 ✅

| 项目 | 内容 |
|------|------|
| **决策** | `undeploy` 后 Agent 目录保留复制版本，不会被 `update` 更新。如需重新纳入管理，需要重新 `deploy` |
| **影响** | §6.5 undeploy 后的版本状态，§10.4 undeploy 流程 |

### D-19: 版本管理简化的确认 ✅

| 项目 | 内容 |
|------|------|
| **决策** | 不保留多版本并存；升级时自动备份到 `.backup/<timestamp>-v<old>/`；`switch` 从 `.backup/` 恢复；`manifest.yaml` 只记录 `current_version` 和 `last_backup`；所有 Agent 下的 skill 版本跟随中央仓库（除非该 Agent 被设置为不纳入管理） |
| **影响** | §6 版本管理方案（全面重写） |

### D-20: `switch` 恢复备份后的分发同步 ✅

| 项目 | 内容 |
|------|------|
| **决策** | `switch` 恢复备份版本后，已分发的 Agent 目录不会自动同步更新，需要用户手动重新 `deploy` |
| **影响** | §6.3 恢复流程 |

### D-21: UI 框架选型 ✅

| 项目 | 内容 |
|------|------|
| **决策** | Web Dashboard 使用 Vue 3 + Naive UI + Vite + UnoCSS + md-editor-v3 |
| **理由** | Vue 3 Composition API + TypeScript 支持完善；Naive UI 组件丰富、主题可定制；UnoCSS 提供原子化 CSS，与 Naive UI 互补；md-editor-v3 (MdPreview) 提供完整的 Markdown 渲染方案（含语法高亮+XSS 防护+主题），避免重复造轮子 |
| **影响** | §4.1 架构图，§17.1 技术栈，§17.2 技术选型对比，§17.3 项目结构，§19 路线图 |

---

## 20. 引用来源

| 序号 | 引用内容 | 来源 |
|------|----------|------|
| [1] | Skiller 项目 | [GitHub - AFunc-OPC/Skiller](https://github.com/AFunc-OPC/Skiller) |
| [2] | skills.sh 排行榜 | [skills.sh](https://skills.sh) |
| [3] | vercel-labs/skills CLI | [GitHub - vercel-labs/skills](https://github.com/vercel-labs/skills) |
| [4] | Semantic Versioning 2.0.0 | [semver.org](https://semver.org/) |
| [5] | GitHub REST API - Trees | [GitHub Docs](https://docs.github.com/en/rest/git/trees) |
| [6] | Anthropic Agent Skills Spec | [CSDN](https://blog.csdn.net/wanf967/article/details/161261833) |
| [7] | SKILL.md frontmatter 安全约束 | [CSDN](https://blog.csdn.net/shebao3333/article/details/160344913) |
| [8] | Hono — Web 框架 | [hono.dev](https://hono.dev) |
| [9] | md-editor-v3 — Vue 3 Markdown 编辑器/预览 | [GitHub - imzbf/md-editor-v3](https://github.com/imzbf/md-editor-v3) |
| [10] | UnoCSS — 即时按需原子化 CSS 引擎 | [unocss.dev](https://unocss.dev) |

---

## 附录 A：术语表

| 术语 | 定义 |
|------|------|
| **Skill** | AI Agent 的可复用能力包，以 SKILL.md 为核心 |
| **SKILL.md** | Skill 的核心定义文件（YAML frontmatter + Markdown 正文） |
| **Agent** | AI 编程助手（Claude Code、Cursor、OpenCode 等） |
| **Manifest** | Skill 的元数据文件（manifest.yaml） |
| **Lock File** | 全局锁定文件（skills-lock.json） |
| **Distribution** | 将 Skill 部署到 Agent 目标目录的过程 |
| **Source of Truth** | 数据的真实唯一来源（文件系统目录树） |
| **SkillKey** | Skill 的唯一、不透明标识；业务层不再拆为 namespace 和 skillName（D-14） |
| **Managed** | Agent 下的 skill 纳入管理（受 update 影响） |
| **Unmanaged** | Agent 下的 skill 不纳入管理（undeploy 后的副本） |

## 附录 B：配置文件完整示例

```yaml
# ~/.skill-sync/config.yaml

# ===== 全局设置 =====
default_agent: claude-code
distribution_mode: symlink
color_output: true
log_level: info

# ===== 版本管理 =====
version:
  max_backups: 5                    # 最多保留备份数量

# ===== 同步配置 =====
sync:
  github:
    repo: git@github.com:myuser/my-skills.git
    branch: main
    token: ${secrets.github.token}  # 从 secrets.yaml 读取
    auto_commit: true
    commit_message_prefix: "chore(skills): "

# ===== 冲突解决 =====
conflict:
  default_strategy: manual          # ours | theirs | manual | newer | skip

# ===== 分发目标 =====
agents:
  claude-code:
    path: ~/.claude/skills
    enabled: true
  cursor:
    path: ~/.cursor/skills
    enabled: true
  opencode:
    path: ~/.config/opencode/skills
    enabled: false

# ===== 安装设置 =====
install:
  allow_scripts: prompt             # none | prompt | always

# ===== 网络设置 =====
network:
  proxy: ""
  timeout: 15000
  retry_count: 3

# ===== 自定义扫描路径（init 时使用）=====
scan_paths:
  - ~/projects/my-skills
  - ~/work/shared-skills
```

```yaml
# ~/.skill-sync/secrets.yaml （.gitignore，不同步）
# 用户需手动创建此文件并填入 token
github:
  token: ghp_xxxxxxxxxxxx
```
