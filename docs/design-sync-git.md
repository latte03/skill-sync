# 同步机制与 Git 策略

> **来源**：PRD-SkillSync v1.2 §7 + §14
> **决策来源**：D-08 — `~/.skill-sync/` 整体是一个 Git 仓库。

---

## 7. 同步机制设计

### 7.1 Git 同步流程

`~/.skill-sync/` 整体是一个 Git 仓库（D-08）。

```
用户: skill-sync sync push
  → 收集变更（git status）
  → 生成自动提交（git add + commit）
      提交信息格式: "chore(skills): <action> <skill-name> [<detail>]"
      示例: "chore(skills): install anthropics/pdf-processing@1.1.0"
      示例: "chore(skills): update vercel-labs/web-design 1.0.0→1.1.0"
      示例: "chore(skills): deploy anthropics/pdf-processing to claude-code,cursor"
  → git push origin main
  → 完成

用户: skill-sync sync pull
  → git fetch origin
  → 检测冲突（git merge-base）
  → 无冲突: git merge origin/main
  → 有冲突: 列出冲突文件，请求处理策略
  → 重建索引
  → 完成
```

### 7.2 冲突解决策略

| 策略 | 适用场景 | 操作 |
|------|----------|------|
| `ours` | 信任本地版本 | 保留本地，丢弃远程 |
| `theirs` | 信任远程版本 | 保留远程，覆盖本地 |
| `manual` | 需要人工审查 | 标记冲突文件，打开 diff 工具 |
| `newer` | 按时间戳取最新 | 比较 `updated_at` 时间戳 |
| `skip` | 跳过该文件 | 不同步此文件 |

默认策略可在 `config.yaml` 中配置。

### 7.3 GitHub API 补充用途

| API | 用途 | 频率限制 |
|-----|------|----------|
| Trees API (`/repos/{owner}/{repo}/git/trees/{ref}?recursive=1`) | 发现仓库中的 SKILL.md | 未认证 60/h，认证 5000/h |
| `GET /repos/{owner}/{repo}/commits/{branch}` | 获取最新 commit hash | 同上 |
| `raw.githubusercontent.com` | 下载单个文件 | 无限制 |

> **Lazy Token 策略**：默认不主动获取 GitHub token，仅在收到 rate limit 响应后尝试获取（优先级：`GITHUB_TOKEN` → `GH_TOKEN` → `gh auth token`）。

---

## 14. Git 仓库结构与 .gitignore 策略

### 14.1 Git 仓库范围

> **决策来源**：D-08

`~/.skill-sync/` 整体是一个 Git 仓库。通过 `git push/pull` 实现多端同步。

### 14.2 .gitignore 规则

```gitignore
# === 缓存与临时目录（可重建）===
cache/
temp/

# === 敏感信息 ===
secrets.yaml

# === 备份目录（体积大，不需要同步）===
skills/*/.backup/

# === OS 文件 ===
.DS_Store
Thumbs.db

# === 编辑器 ===
.vscode/
.idea/
*.swp
*.swo

# === Node.js ===
node_modules/
```

### 14.3 同步的内容

| 同步 | 不同步 |
|------|--------|
| `skills/` 目录下所有 skill 文件 | `cache/`（可重建） |
| `config.yaml`（全局配置） | `temp/`（临时文件） |
| `skills-lock.json`（锁定文件） | `secrets.yaml`（敏感信息） |
| `tags.yaml`（标签定义） | `skills/*/.backup/`（备份目录） |

### 14.4 secrets.yaml 机制

用户需手动创建 `~/.skill-sync/secrets.yaml` 并填入 token：

```yaml
# ~/.skill-sync/secrets.yaml
github:
  token: ghp_xxxxxxxxxxxx
```

`config.yaml` 中通过变量引用：

```yaml
sync:
  github:
    token: ${secrets.github.token}
```

`init` 命令会自动创建 `secrets.yaml` 模板文件（内容为注释占位符），并提示用户手动填入。
