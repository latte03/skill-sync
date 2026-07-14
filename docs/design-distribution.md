# 分发机制

> **来源**：PRD-SkillSync v1.2 §10

---

## 10.1 分发目标目录命名规则

分发到 Agent 目录时，目标路径的命名规则：

| 场景 | 目标目录名 | 示例 |
|------|-----------|------|
| 默认（无冲突） | `<skill-name>` | `~/.claude/skills/pdf-processing/` |
| 同名冲突（不同命名空间） | `<namespace>-<skill-name>` | `~/.claude/skills/anthropics-pdf-processing/` |
| 用户配置覆盖 | `config.yaml` 中自定义 | `config.yaml → agents.claude-code.alias: { anthropics/pdf-processing: pdf }` |

**冲突检测**：deploy 时检测目标目录是否已被其他 namespace 的同名 skill 占用。若是，自动切换为 `<namespace>-<skill-name>` 格式并警告。

## 10.2 链接策略与平台适配

### 三种分发模式

| 维度 | Symlink | Junction | Copy |
|------|---------|---------|------|
| 磁盘占用 | 极小（仅指针） | 极小（仅指针） | 完整副本 |
| 修改同步 | 中心改即全局生效 | 中心改即全局生效 | 需重新复制 |
| macOS/Linux | ✅ 原生支持 | ❌ 不适用 | ✅ |
| Windows | 需管理员权限/开发者模式 | ✅ **不需要**管理员权限 | ✅ |
| undeploy 后 | 需解除链接+复制 | 需解除链接+复制 | 直接保留 |

### 平台优先级

| 平台 | 第一选择 | 降级方案 | 说明 |
|------|----------|----------|------|
| macOS / Linux | symlink | copy | symlink 不需要特殊权限 |
| Windows | **junction** | copy | junction 不需要管理员权限/开发者模式 |

### 实现要点

```typescript
// Windows 上使用 junction
if (os.platform() === 'win32') {
  fs.symlinkSync(sourceDir, linkPath, 'junction');
} else {
  fs.symlinkSync(sourceDir, linkPath);
}
```

**关键说明**：
- **junction** 是 Windows 特有的目录链接方式（`fs.symlinkSync(target, path, 'junction')`），不需要管理员权限或开发者模式
- Windows 上**不使用普通 symlink**，因为普通 symlink 在 Windows 上需要管理员权限或开启开发者模式
- 仅当 junction 创建也失败时（如极端权限不足），才降级为 copy 模式
- 用户可通过 `config.yaml → distribution_mode` 强制指定 `copy` 模式覆盖默认行为
- undeploy 时：symlink/junction 模式先解除链接再复制内容到 Agent 目录；copy 模式直接保留

## 10.3 分发流程

```
skill-sync deploy <name> --to <agent>
  → 目标目录是否已存在?
    → 否: 创建链接/复制
      macOS/Linux: symlink
      Windows: junction（不需要管理员权限）
      降级: copy（junction 失败时）
    → 是: --force?
      → 是: 移除旧链接/目录 → 创建
      → 否: 检测是否被手动修改
        → 未修改: 覆盖
        → 已修改: 提示用户选择 (覆盖/保留/跳过/diff)
  → 计算 source_hash (SHA256 of skill dir)
  → 更新 skills-lock.json: managed = true, mode = 实际使用的模式
  → 校验完整性
```

## 10.4 增量同步（copy 模式）

copy 模式下，如果目标目录已存在，使用增量同步而非全量覆盖：
- 对比源和目标文件列表
- 只复制新增和变更的文件
- 删除目标中不再存在于源的文件
- 小文件（<64KB）比较内容，大文件比较大小 + mtime

## 10.5 undeploy 流程

```
skill-sync undeploy <name> --agent <agent>
  → 检测当前分发模式
    → symlink/junction: 解除链接 → 复制中央仓库内容到 Agent 目录
    → copy: 保持不变（已是副本）
  → 更新 skills-lock.json: managed = false
  → 此后该 Agent 下的 skill 副本不会被 update 更新
  → 如需重新纳入管理: skill-sync deploy <name> --agent <agent>
```

## 10.6 source_hash 计算方法

`source_hash` 用于检测 skill 内容是否被手动修改。计算规则：

```
source_hash = SHA256(文件列表 + 每个文件的 SHA256)

计算步骤:
  1. 递归遍历 skill 目录（排除 .backup/）
  2. 对所有文件按相对路径排序
  3. 拼接: "<relative_path>:<sha256_of_content>\n" 逐行拼接
  4. 对拼接结果取 SHA256
  5. 格式: "sha256:<hex>"

示例:
  source_hash = sha256(
    "SKILL.md:sha256:abc...\n" +
    "scripts/setup.sh:sha256:def...\n" +
    "manifest.yaml:sha256:ghi...\n"
  )
```

- 不含文件权限/时间戳，只看内容
- 二进制文件同样计算 SHA256
- symlink 模式下，由于 Agent 目录直接指向中央仓库，source_hash 始终一致
- copy 模式下，分发时计算并记录，下次 deploy 前对比检测手动修改

## 10.7 分发冲突检测

当一个 Skill 已经被手动修改过，再次分发时检测并警告：

```
⚠  Target file modified since last distribution:
   ~/.claude/skills/pdf-processing/SKILL.md

   Last distributed:  2026-07-10 (hash: abc123...)
   Current state:      def456...

   Options:
   (o) Overwrite  (use --force to skip this prompt)
   (k) Keep existing (skip this file)
   (d) Show diff
   (a) Abort
```

## 10.8 `remove --central` vs `undeploy --all`

| 操作 | 中央仓库 | Agent 目录 | skills-lock.json |
|------|----------|-----------|-----------------|
| `remove --central <name>` | 删除 skill 目录 | 保留所有已分发副本（标记为 unmanaged） | 删除该 skill 条目 |
| `undeploy --all <name>` | 保留 | 所有 Agent 目录保留副本（解除 symlink 的先复制） | 所有 distribution 标记 `managed = false` |

> **注意**：`remove --central` 不会自动 undeploy。用户如需清理 Agent 目录，需先 `undeploy --all` 再 `remove --central`。
