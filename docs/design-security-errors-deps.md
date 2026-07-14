# 安全设计、错误处理与依赖管理

> **来源**：PRD-SkillSync v1.2 §11 + §12 + §13

---

## 11. 安全设计

### 11.1 原则

1. **最小权限**：只访问用户明确指定的目录
2. **敏感配置分离**：token/password 放 `secrets.yaml`，`.gitignore` 不同步（D-08）
3. **Skill 内容不记录到日志**
4. **执行前确认**：涉及删除/覆盖的操作必须二次确认（除非 `--yes`）

### 11.2 安全措施

| 措施 | 说明 |
|------|------|
| source_hash 校验 | 每次分发后记录 SHA256，下次部署前校验 |
| 路径安全校验 | skill 名经过 sanitize（kebab-case），防止路径遍历攻击 |
| 路径重叠检测 | 防止把 skill 安装到自己的源目录上 |
| 远程代码审计 | 从 skills.sh 安装的 Skill，安装前展示将要写入的文件清单 |
| 网络代理支持 | 支持 HTTP_PROXY / HTTPS_PROXY / 自动检测常见代理端口 |
| Lazy Token | 默认不主动获取 GitHub token，仅在 rate limit 后尝试获取 |

### 11.3 敏感信息管理

```yaml
# ~/.skill-sync/secrets.yaml （此文件 .gitignore，不同步）
# 用户需手动创建此文件并填入 token
github:
  token: ghp_xxxxxxxxxxxx
```

`config.yaml` 中通过变量引用：

```yaml
sync:
  github:
    token: ${secrets.github.token}
```

---

## 12. 错误处理与异常场景

### 12.1 错误处理策略总表

| 场景 | 处理策略 |
|------|----------|
| **Git clone 失败** | 重试 3 次（可配置），仍失败则提示用户检查网络/仓库地址，清理 temp 目录 |
| **GitHub API 限流 (403)** | 检测 `X-RateLimit-Remaining` header，提示用户设置 `GITHUB_TOKEN`；Lazy Token 策略自动尝试 `gh auth token` |
| **skills.sh API 不可达** | 降级为仅本地搜索，提示"在线搜索暂时不可用" |
| **SKILL.md 解析失败** | 跳过该 skill 并在 `list`/`status` 中标记为 `⚠ broken`，不阻塞其他操作 |
| **manifest.yaml 损坏** | 尝试从 SKILL.md frontmatter 重建 manifest，无法重建则标记为 broken |
| **skills-lock.json 损坏** | 从文件系统扫描重建 lock 文件 |
| **软链接断裂** | `doctor` 命令检测并修复；`status` 中告警 |
| **安装中途失败** | 暂存区目录在操作完成后自动清理；安装失败时回滚到安装前状态 |
| **分发时目标已存在且被手动修改** | 比较 source_hash，不匹配时提示用户选择（覆盖/保留/跳过/diff） |
| **Git 同步冲突** | 列出冲突文件，按配置策略（ours/theirs/manual/newer/skip）处理 |
| **磁盘空间不足** | 安装/升级前检查可用空间，不足时中止并提示 |
| **权限不足** | 创建软链接/目录失败时提示用户检查权限（Windows 需开发者模式） |
| **仓库文件树被截断** | Trees API 返回 `truncated: true` 时回退到 `git clone` 方式 |
| **网络超时** | 默认 15 秒超时，可配置；超时后清理资源并报错 |
| **循环依赖检测** | 安装时递归检查依赖链（深度限制 10 层），检测到循环则中止并报错 |

### 12.2 错误恢复机制

| 机制 | 触发条件 | 行为 |
|------|----------|------|
| **安装回滚** | 安装过程中任何步骤失败 | 删除暂存区文件，恢复到安装前状态 |
| **升级回滚** | 升级过程中下载/复制失败 | 从 `.backup/` 恢复到升级前版本 |
| **lock 重建** | lock 文件损坏或丢失 | 扫描文件系统 + manifest.yaml 重建 |
| **manifest 重建** | manifest.yaml 损坏 | 从 SKILL.md frontmatter 提取信息重建 |
| **软链接修复** | `doctor` 检测到断裂链接 | 删除断裂链接，重新创建指向中央仓库的链接 |

### 12.3 退出码定义

| 退出码 | 含义 | 示例场景 |
|--------|------|----------|
| 0 | 成功 | 命令正常执行完成 |
| 1 | 通用错误 | 未分类的错误 |
| 2 | 参数错误 | 命令/参数不合法 |
| 3 | 未初始化 | 中央仓库不存在（未执行 `init`） |
| 4 | 网络/远程错误 | GitHub API 不可达、限流 |
| 5 | 文件系统错误 | 权限不足、磁盘空间不足 |
| 6 | 冲突错误 | 分发冲突、同步冲突（非交互模式） |
| 7 | 依赖缺失 | 依赖的 skill 未安装（`--ignore-deps` 未指定） |
| 8 | 部分失败 | 批量操作中部分成功部分失败 |

### 12.4 错误输出格式

```
✗ 安装失败: anthropics/skills --skill pdf-processing

  错误: GitHub API 限流 (403)
  原因: 未认证用户每小时限 60 次请求
  建议: 设置 GITHUB_TOKEN 环境变量或运行 gh auth login

  已清理临时文件: temp/clone-20260713-100000/
```

---

## 13. 依赖管理逻辑

### 13.1 依赖声明

在 `manifest.yaml` 和 SKILL.md frontmatter `metadata.depends_on` 中声明：

```yaml
depends_on:
  - name: image-processor
    version: ">=1.0.0"       # SemVer range
  - name: file-utils
    version: "^1.2.0"
```

### 13.2 处理逻辑

| 时机 | 行为 |
|------|----------|
| **安装时** | 检查 `depends_on` 中声明的依赖是否已安装。未安装时警告并询问是否同时安装依赖 |
| **删除时** | 检查是否有其他 skill 依赖此 skill。如有，警告"以下 skill 依赖此项: xxx" |
| **版本匹配** | 支持 SemVer range（`>=1.0.0`、`^1.0.0`、`~1.0.0`），使用 `semver` 库解析 |
| **传递性依赖** | 安装时递归检查依赖链，深度限制 10 层防止无限递归 |
| **循环依赖** | 安装时检测循环依赖（A→B→A），检测到则中止并报错 |

### 13.3 简化策略

考虑到这是 skill 管理工具而非包管理器，依赖检查仅做**警告级别**，不强制阻止安装。用户可以 `--ignore-deps` 跳过。

### 13.4 post_install 支持

SKILL.md frontmatter `metadata.post_install` 可声明安装后需要执行的脚本：

```yaml
metadata:
  post_install: "scripts/setup.sh"
```

- 仅在 copy 模式下执行（symlink 模式在源目录执行）
- 执行前展示脚本内容，需用户确认
- 执行结果记录到 skills-lock.json (`postInstallRan: true`)
- `--force` 时重新执行
