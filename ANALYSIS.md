# SkillSync 项目分析报告

> 生成时间：2026-07-16
> 分析范围：业务逻辑与文档出入 + 架构合理性与改进建议

---

## 一、整体评价

项目架构**设计合理、层次清晰**，Core/CLI/Server 三层分离 + 依赖注入的模式在同类 CLI 工具中属于上乘。PRD 与代码的**整体一致性较高**，但存在 **12 处业务逻辑与文档的出入**，其中 3 处为高严重度问题。架构层面有 8 个可改进点，主要集中在**文件系统操作缺乏原子性**和**并发安全**两个工程化成熟度问题上。

---

## 二、业务逻辑与文档的出入

### 🔴 高严重度（核心功能偏离设计）

#### 1. `undeploy` 实现与 PRD 严重不一致

- **文档要求**：PRD §10.5 和 `docs/design-distribution.md` §10.5 — symlink/junction 模式下取消分发时应**解除链接 → 复制中央仓库内容到 Agent 目录**，并标记 `managed = false`
- **实际代码**：`src/core/skill-manager.ts` `undeploySkill`（约 357-368 行）
  - 直接 `removeLink(destPath)` 删除文件
  - 从 manifest 的 `distribution.targets` 中**完全移除**该 agent
  - 从 lock 中 `delete entry.distribution[agentName]`
- **影响**：FR-02-05（撤销分发后 Agent 保留复制版本）完全未实现，undeploy 后 Agent 目录下文件被直接删除

#### 2. `hasXmlBrackets` 安全函数已定义但从未被调用

- **文档要求**：AGENT.md §7 — frontmatter 中不得出现 XML 尖括号（`<` / `>`）
- **实际代码**：`src/lib/frontmatter.ts:90` 定义了 `hasXmlBrackets`，但全局搜索确认**仅在定义和测试中出现**，无任何业务代码调用
- **影响**：安全约束未落实，恶意 frontmatter 中的 XML 尖括号不会被检测和拒绝

#### 3. `isPathSafe` 路径重叠检测函数已定义但从未被调用

- **文档要求**：AGENT.md §7 — 分发前检测路径重叠（防止安装到源目录上）
- **实际代码**：`src/lib/sanitize.ts:75` 定义了 `isPathSafe`，同样**仅在定义和测试中出现**
- **影响**：路径重叠安全检测未落实

### 🟡 中严重度（数据/功能缺失）

#### 4. `source.installedVia` 字段在 skills-lock.json 中丢失

- **文档要求**：PRD §5.3 + AGENT.md §5 — `source.installedVia: 'cli' | 'init-scan'` 是来源标识的组成部分
- **实际代码**：`src/lib/types.ts` 的 `LockEntry.source` 类型只有 `type`/`repo`/`path`/`commit`，没有 `installedVia` 字段。`src/core/installer.ts` 的 `finalizeInstall` 也未写入该字段
- **影响**：lock 文件无法区分 skill 是 CLI 安装还是 init-scan 导入的

#### 5. 备份清理策略（max_backups）未实现

- **文档要求**：PRD §6 + `docs/design-version-management.md` §6.4 — 默认保留最近 5 个备份，超过限制时自动删除最旧的备份
- **实际代码**：`src/lib/constants.ts` 定义了 `DEFAULT_MAX_BACKUPS = 5`，`src/config.ts` 有 `maxBackups` 配置，但 `src/core/skill-manager.ts` 的 `createBackup` 函数只创建备份，**不检查备份数量、不删除旧备份**
- **影响**：备份会无限增长，`max_backups` 配置形同虚设

#### 6. `remove --central` 留下断裂 symlink

- **文档要求**：`docs/design-distribution.md` §10.8 — Agent 目录保留所有已分发副本（标记为 unmanaged）
- **实际代码**：`src/core/skill-manager.ts` `removeSkill` scope='central'（约 485-496 行）直接 `removeLockEntry(name)`，不调用 `undeploySkill`
- **影响**：Agent 目录下的 symlink 变为断裂链接，而非设计文档描述的「保留已分发副本」

#### 7. Git 提交信息格式不符合 PRD 规范

- **文档要求**：PRD §7 + AGENT.md §9 — 格式 `chore(skills): <action> <skill-name> [<detail>]`
- **实际代码**：`src/core/sync-manager.ts:175` 默认提交信息为 `skill-sync: sync skills`
- **影响**：Git 提交信息不符合 PRD 规范，无法从 commit history 追踪具体操作

#### 8. `import` 命令命名空间默认值：PRD 与 AGENT.md 矛盾

- **文档矛盾**：PRD 说默认命名空间为 `local`（目录 `skills/local/my-skill`），AGENT.md 说本地导入无命名空间（目录 `skills/my-skill`）
- **实际代码**：`src/commands/import.ts:48` 将 `local` 命名空间转换为空字符串，遵循了 AGENT.md
- **影响**：PRD 与 AGENT.md 文档之间不一致

### 🟢 低严重度（未实现的设计）

#### 9. `post_install` 脚本执行未实现

- **文档要求**：`docs/design-security-errors-deps.md` §13.4 — post_install 仅在 copy 模式执行，执行前展示脚本内容需确认，结果记录到 `postInstallRan: true`
- **实际代码**：`src/lib/frontmatter.ts:78` 的 `extractPostInstall` 已定义但从未调用，`src/lib/types.ts:422` 的 `LockEntry.postInstallRan` 字段从未写入，AGENT.md 中列出的 `src/lib/post-install.ts` 文件不存在
- **影响**：post_install 功能完全未实现

#### 10. 分发同名冲突命名规则未实现

- **文档要求**：`docs/design-distribution.md` §10.1 — 同名冲突时目标目录名应为 `<namespace>-<skill-name>`
- **实际代码**：`src/core/skill-manager.ts:233` `deploySkill` 直接使用 `skillName`，无冲突检测和 namespace 前缀逻辑
- **影响**：不同命名空间的同名 skill 分发到同一 Agent 时会冲突

#### 11. `source_hash` 格式与设计文档不一致

- **文档要求**：`docs/design-distribution.md` §10.6 — 格式应为 `sha256:<hex>`，按 `"<relative_path>:<sha256_of_content>\n"` 拼接
- **实际代码**：`src/core/skill-manager.ts:108-135` `computeSourceHash` 直接 `hash.update(name)` + `hash.update(content)` 递归拼接，不使用 `sha256:` 前缀
- **影响**：source_hash 值与设计文档描述不匹配

#### 12. `SkillSyncContext` 接口与 PRD 定义有差异

- **文档要求**：PRD §4.4 — 包含 `lockFile: LockFile` 和 `isDryRun: boolean`
- **实际代码**：`src/core/context.ts:19-28` — 没有 `lockFile` 属性，属性名 `dryRun` 而非 `isDryRun`，额外有 `offline` 属性
- **影响**：Context 接口偏离 PRD 设计

---

## 三、架构合理性与改进建议

### ✅ 合理之处

| 方面 | 评价 |
|------|------|
| 依赖注入 | `SkillSyncContext` 纯数据接口 + 工厂函数，无 IoC 容器，避免过度设计 |
| 三层分离 | Core 层无 `process.exit`/`console.log`，CLI 层无直接文件操作，职责边界清晰 |
| 类型系统 | 40+ 接口，`any` 使用极少（仅 3 处），`unknown` narrowing 合理 |
| 错误处理 | 8 种退出码 + `SkillSyncError` 子类体系，`handleCommandError` 统一处理 |
| 测试隔离 | `SKILL_SYNC_HOME` + `SKILL_SYNC_AGENTS_DIR` 环境变量实现完全隔离，不 mock fs |
| 前后端类型共享 | `web/src/api.ts` 直接从 `src/lib/types.ts` 导入类型 |
| Git API 共享逻辑 | `git-api.ts` 提取了 GitHub/Gitee 共享的纯函数和 HTTP 工具 |

### 🔧 改进建议（按优先级排序）

#### P0 — `name.split('/')` 解析命名空间不安全

- **位置**：`src/core/skill-manager.ts` 的 `removeSkill`、`undeploySkill`、`createBackup`
- **问题**：`const [namespace, skillName] = name.split('/')`。本地导入的嵌套 skill（如 `write-a-skill/engineering/tdd`）会被错误解析，`skillName` 只拿到中间段
- **建议**：使用 `tryReadManifest` 获取准确的 namespace 和 skillName，或提供统一的 `parseSkillName(name)` 工具函数

#### P0 — 文件系统操作缺乏原子性

- **位置**：`src/lib/lock.ts` `writeLock`、`src/config.ts` `writeConfig`、`src/lib/manifest.ts` `writeManifest`、`src/lib/tags.ts`
- **问题**：所有文件写入都直接 `fs.writeFileSync`，写入中断会留下损坏文件，特别是 `skills-lock.json`
- **建议**：实现 write-then-rename 模式（原子写入）：
  ```typescript
  function atomicWriteFile(filePath: string, content: string): void {
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, content);
    fs.renameSync(tmpPath, filePath);
  }
  ```

#### P1 — GitHub/Gitee API 应抽象统一接口

- **位置**：`src/lib/github.ts` 和 `src/lib/gitee.ts`
- **问题**：两个模块有大量结构相同的函数（`getRepoTree`、`getDefaultBranch`、`getLatestCommitHash` 等）
- **建议**：定义 `GitPlatformAPI` 接口，消除平行代码，新增平台只需实现接口

#### P1 — 并发安全性缺失

- **位置**：`src/lib/lock.ts` 内存缓存 + 文件读写、`src/core/skill-manager.ts` 多步操作
- **问题**：内存缓存在 CLI + Web Server 同时运行时会与磁盘不一致；`deploySkill` 的多步操作中间被中断会导致状态不一致
- **建议**：对 `skills-lock.json` 使用文件锁（如 `proper-lockfile`），多步操作使用事务模式

#### P1 — 补充 GitHub 安装流程的单元测试

- **位置**：`tests/core/installer.test.ts`
- **问题**：只覆盖了本地 skill，GitHub 安装流程（`discoverGitHubSkills`/`downloadGitHubSkill`/`installGitHubSkill`）完全没有测试
- **建议**：使用 `vi.mock` mock `github.ts` 模块，测试各种场景

#### P2 — `checkAllUpdates` 串行请求应并发化

- **位置**：`src/core/version-manager.ts:120`
- **问题**：串行遍历所有 skill 逐个检查更新，20 个 GitHub skill 需要 20 次串行 API 请求
- **建议**：使用 `Promise.allSettled` + 并发限制（如 `p-limit`）

#### P2 — Server 层错误码映射

- **位置**：`src/server/app.ts` 所有端点
- **问题**：所有错误都返回 500，未利用 `SkillSyncError.exitCode` 映射到正确的 HTTP 状态码
- **建议**：添加错误映射中间件，`ConflictError` → 409、`InvalidArgsError` → 400 等

#### P2 — `app.ts` 单文件过大应拆分路由

- **位置**：`src/server/app.ts`（约 700+ 行）
- **建议**：按功能域拆分为 `routes/skills.ts`、`routes/sync.ts`、`routes/ai.ts` 等

---

## 四、修复优先级总表

| 优先级 | 编号 | 问题 | 影响 | 涉及文件 |
|--------|------|------|------|----------|
| **P0** | 1 | ~~修复 `undeploySkill` 保留副本逻辑~~ ✅ 已修复 | ~~核心功能 FR-02-05 未实现~~ | `src/core/skill-manager.ts` |
| **P0** | — | 修复 `name.split('/')` 嵌套路径解析 | 潜在运行时 bug | `src/core/skill-manager.ts` |
| **P0** | — | 实现原子文件写入 | 数据损坏风险 | `src/lib/lock.ts`、`src/config.ts`、`src/lib/manifest.ts`、`src/lib/tags.ts` |
| **P1** | 2 | 调用 `hasXmlBrackets` 安全检查 | 安全约束未落实 | `src/lib/frontmatter.ts` + 调用方 |
| **P1** | 3 | 调用 `isPathSafe` 路径重叠检测 | 安全约束未落实 | `src/lib/sanitize.ts` + 调用方 |
| **P1** | 6 | 修复 `remove --central` 断裂 symlink | 用户体验问题 | `src/core/skill-manager.ts` |
| **P1** | 5 | 实现备份清理策略 | 磁盘空间无限增长 | `src/core/skill-manager.ts` |
| **P1** | 4 | 补充 `installedVia` 字段 | 数据完整性 | `src/lib/types.ts`、`src/core/installer.ts` |
| **P1** | 7 | 修复 Git 提交信息格式 | 规范不一致 | `src/core/sync-manager.ts` |
| **P1** | 8 | 统一 PRD 与 AGENT.md 命名空间描述 | 文档矛盾 | `PRD-SkillSync-v1.2.md` 或 `AGENT.md` |
| **P2** | 9 | 实现 `post_install` 脚本执行 | 功能缺失 | 新建 `src/lib/post-install.ts` |
| **P2** | 10 | 实现分发同名冲突命名规则 | 功能缺失 | `src/core/skill-manager.ts` |
| **P2** | 11 | 修复 `source_hash` 格式 | 格式不一致 | `src/core/skill-manager.ts` |
| **P2** | 12 | 对齐 `SkillSyncContext` 接口 | 接口偏离设计 | `src/core/context.ts` |
| **P2** | — | 抽象 `GitPlatformAPI` 接口 | 可扩展性 | `src/lib/github.ts`、`src/lib/gitee.ts` |
| **P2** | — | 并发安全/错误码映射/路由拆分 | 工程化成熟度 | `src/lib/lock.ts`、`src/server/app.ts` |
| **P2** | — | `checkAllUpdates` 并发化 | 性能 | `src/core/version-manager.ts` |
| **P1** | — | 补充 GitHub 安装流程测试 | 测试覆盖不足 | `tests/core/installer.test.ts` |
