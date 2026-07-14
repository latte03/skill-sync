# 版本管理方案（简化版）

> **来源**：PRD-SkillSync v1.2 §6
> **决策来源**：D-19 — 不保留多版本并存，升级时自动备份，`switch` 从备份恢复。

---

## 6.1 设计原则

| 维度 | v1.1 方案（多版本） | v1.2 方案（简化版） |
|------|---------------------|---------------------|
| 目录结构 | `versions/1.0.0/`, `versions/1.1.0/`, `latest` 软链接 | 扁平目录 + `.backup/` |
| 同时存在多个版本 | ✅ | ❌ 只有一个活跃版本 |
| 升级 | 新版本放入 `versions/`，更新 `latest` | 当前版本 → `.backup/`，新版本 → skill 目录 |
| 回滚 | 切换 `latest` 软链接指向 | 从 `.backup/` 恢复 |
| 复杂度 | 高（需管理多版本目录、软链接、空间清理） | 低（扁平结构，备份按需清理） |
| 所有 Agent 版本跟随中央 | ✅ | ✅（除非该 Agent 被设置为不纳入管理） |

## 6.2 升级流程

```
skill-sync update pdf-processing

  1. 检查远程最新版本 (GitHub Trees API / commit hash)
     当前: 1.0.0  远程: 1.1.0

     远程版本判定优先级:
     a. 远程 SKILL.md frontmatter → metadata.version
     b. 远程 SKILL.md frontmatter → 顶层 version（兼容旧写法）
     c. Git tag 解析（v1.1.0 → 1.1.0）
     d. commit hash 对比（hash 不同但无版本标签 → 标记为 "unversioned update"）
     e. 无法判定 → 标记为 "unknown"，提示用户手动检查

  2. 备份当前版本
     skills/anthropics/pdf-processing/ → skills/anthropics/pdf-processing/.backup/20260713-100000-v1.0.0/

  3. 下载新版本
     git clone --depth 1 → temp/ → 复制到 skills/anthropics/pdf-processing/

  4. 更新 manifest.yaml
     current_version: "1.1.0"
     last_backup: { timestamp, from_version: "1.0.0", backup_dir: "..." }

  5. 更新 skills-lock.json

  6. 提示用户重新 deploy
     "✓ pdf-processing 已升级到 1.1.0"
     "⚠ 已管理的 Agent 需要重新 deploy 才能生效"
     "  运行: skill-sync deploy pdf-processing --all"
```

## 6.3 恢复流程

```
skill-sync switch pdf-processing

  Available backups:
  ─────────────────────────────────────
  ID          Version     Date
  ─────────── ─────────── ────────────
  1           1.0.0       2026-07-13
  2           0.9.0       2026-07-01
  ─────────────────────────────────────

  Select backup to restore (1-2): 1

  1. 当前版本（1.1.0）备份到 .backup/
  2. 选中的备份（1.0.0）恢复到 skill 目录
  3. 更新 manifest.yaml
  4. 提示用户重新 deploy

  ⚠ switch 恢复备份后，已分发的 Agent 目录不会自动同步更新（D-20）
  运行: skill-sync deploy pdf-processing --all
```

## 6.4 备份清理策略

- 默认保留最近 **5 个**备份（可配置 `config.yaml → version.max_backups`）
- 超过限制时自动删除最旧的备份
- `skill-sync switch` 恢复后不自动删除备份（用户可能需要再次切换）
- `skill-sync clean --backups <name>` 可手动清理指定 skill 的所有备份

## 6.5 undeploy 后的版本状态

> **决策来源**：D-18 — `undeploy` 后 Agent 目录保留复制版本，不会被 `update` 更新，需要重新 `deploy` 才能纳入管理。

```
skill-sync undeploy pdf-processing --agent cursor

  1. 解除 cursor 目录下的软链接
  2. 将中央仓库的当前内容复制到 ~/.cursor/skills/pdf-processing/
  3. 更新 skills-lock.json: distribution.cursor.managed = false
  4. 此后 update pdf-processing 不会更新 cursor 目录下的副本
  5. 如需重新纳入管理: skill-sync deploy pdf-processing --agent cursor
```
