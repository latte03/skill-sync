# 测试策略

> **来源**：PRD-SkillSync v1.2 §15

---

## 15.1 灰度测试约束

> **硬性约束**：测试和灰度验证 **禁止动用用户真实的 skill 目录**（`~/.claude/skills/`、`~/.cursor/skills/` 等）。所有测试必须在项目目录下模拟。

**模拟环境机制**：

1. **`SKILL_SYNC_HOME` 环境变量**：覆盖中央仓库路径
   ```bash
   # 测试时使用项目目录下的模拟仓库
   export SKILL_SYNC_HOME=./test-env/.skill-sync
   ```

2. **`SKILL_SYNC_AGENTS_DIR` 环境变量**：覆盖 Agent 目录根路径
   ```bash
   # 所有 Agent 目录重定向到测试沙箱
   export SKILL_SYNC_AGENTS_DIR=./test-env/agents
   # 效果: ~/.claude/skills → ./test-env/agents/.claude/skills
   ```

3. **测试沙箱目录结构**：
   ```
   test-env/
   ├── .skill-sync/              # 模拟中央仓库
   │   ├── skills/
   │   ├── config.yaml
   │   └── ...
   └── agents/                    # 模拟 Agent 目录
       ├── .claude/skills/
       ├── .cursor/skills/
       └── .codex/skills/
   ```

4. **测试用 Mock Skill 生成器**：提供 `createMockSkill()` 工具函数，生成标准 SKILL.md + 可选 scripts/assets

5. **集成测试基类**：每个集成测试自动设置 `SKILL_SYNC_HOME` 和 `SKILL_SYNC_AGENTS_DIR` 到 `os.tmpdir()`，测试后自动清理

## 15.2 框架与工具

| 工具 | 用途 |
|------|------|
| **Vitest** | 测试框架（兼容 Vite 生态，速度快） |
| **tmpdir** | 临时目录（隔离测试环境） |
| **msw (Mock Service Worker)** | HTTP 请求 mock（GitHub API / skills.sh API） |
| **simple-git** | Git 操作 mock（临时仓库） |

## 15.3 测试分层

### 单元测试（必须）

Core 层每个模块的独立测试：

```
tests/
├── core/
│   ├── skill-manager.test.ts        # SkillManager: list, find, info, tag
│   ├── version-manager.test.ts      # VersionManager: update, switch, check
│   ├── dispatcher.test.ts           # Dispatcher: deploy, undeploy, status
│   ├── installer.test.ts            # Installer: install, search
│   └── sync-manager.test.ts         # SyncManager: push, pull
├── lib/
│   ├── agents.test.ts               # Agent 注册表
│   ├── deploy.test.ts               # 部署逻辑（symlink/copy/增量同步）
│   ├── scanner.test.ts              # 散落 skill 扫描
│   ├── source.test.ts               # source 解析
│   ├── github.test.ts               # GitHub API 交互
│   ├── frontmatter.test.ts          # SKILL.md 解析
│   ├── dependencies.test.ts         # 依赖管理
│   ├── manifest.test.ts             # manifest 读写
│   ├── lock.test.ts                 # lock 文件读写
│   ├── sanitize.test.ts             # 名称清理/安全校验
│   └── post-install.test.ts         # post_install 执行
```

### 集成测试（必须）

Core 层模块间的协作测试，使用真实临时目录：

```
tests/
├── integration/
│   ├── init-flow.test.ts            # init → scan → import 完整流程
│   ├── install-deploy.test.ts       # install → deploy → status 完整流程
│   ├── update-switch.test.ts        # update → switch 备份恢复流程
│   ├── undeploy-redeploy.test.ts    # undeploy → redeploy 流程
│   └── sync-flow.test.ts            # push → pull 同步流程
```

### E2E 测试（可选）

CLI 端到端测试，验证完整命令流程：

```
tests/
├── e2e/
│   ├── cli-init.test.ts             # skill-sync init 完整交互
│   ├── cli-install.test.ts          # skill-sync install 完整流程
│   └── cli-update.test.ts           # skill-sync update 完整流程
```

## 15.4 Mock 策略

| 对象 | Mock 方式 |
|------|----------|
| 文件系统 | `os.tmpdir()` + 测试后清理 |
| Git 操作 | 创建临时 Git 仓库 |
| GitHub API | msw 拦截 HTTP 请求 |
| skills.sh API | msw 拦截 HTTP 请求 |
| 交互式提示 | mock `readline` / `inquirer` |

## 15.5 覆盖率目标

- **总体覆盖率**：≥ 90%
- **Core 层覆盖率**：≥ 95%
- **CLI 层覆盖率**：≥ 80%（薄封装，主要逻辑在 Core 层）
