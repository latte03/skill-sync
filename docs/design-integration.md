# skills.sh 集成方案

> **来源**：PRD-SkillSync v1.2 §8
> **决策来源**：D-11

---

## 8.1 已验证 API

| 接口 | URL | 用途 |
|------|-----|------|
| 搜索 | `GET https://skills.sh/api/search?q={query}` | 搜索 skill |
| 详情页 | `https://skills.sh/{source}/{skill_id}` | 浏览 skill 详情 |

**搜索返回格式**（JSON）：

```json
{
  "query": "pdf",
  "searchType": "keyword",
  "skills": [
    {
      "source": "anthropics",
      "skill_id": "pdf",
      "name": "pdf-processing",
      "description": "Use this skill whenever the user wants to do anything with PDF",
      "stars": 1234,
      "installs": 56789
    }
  ],
  "count": 1,
  "duration_ms": 42
}
```

**搜索结果到 install 参数的映射**：

搜索返回的 `source` 即为 GitHub `owner`，但 `skill_id` 不一定等于 `repo` 名。映射规则：

| 搜索结果字段 | install 参数 | 说明 |
|-------------|-------------|------|
| `source` | `owner` | GitHub 用户/组织名 |
| `skill_id` | `--skill <name>` | skill 在仓库中的目录名 |
| （需推断） | `repo` | 仓库名，优先用 `skill_id` 尝试，失败后通过 Trees API 搜索 owner 下含该 skill 的仓库 |

**推断流程**：
1. 尝试 `install <source>/<skill_id> --skill <skill_id>`（仓库名 = skill_id）
2. 若 Trees API 发现该仓库不存在，则调用 `GET /users/{source}/repos` 列出仓库，逐个用 Trees API 搜索包含 `SKILL.md` 且路径前缀匹配 `skill_id` 的仓库
3. 找到后自动补全 `owner/repo`，用户确认后继续安装

> **注意**：skills.sh 搜索结果未返回 repo 名，上述推断流程可能导致额外 API 调用。未来可考虑缓存 owner→repo 映射。

## 8.2 安装流程

```
skill-sync install anthropics/skills --skill pdf-processing

  1. 解析来源: owner=anthropics, repo=skills, skill=pdf-processing
  2. GitHub Trees API 发现 SKILL.md 路径:
     → skills/pdf-processing/SKILL.md
  3. 获取 skill 目录的 tree SHA（用于变更检测）
  4. 获取最新 commit hash（用于版本标识）
  5. 下载 skill 目录下所有文件:
     → raw.githubusercontent.com 逐文件下载
     → 或 git clone --depth 1 + 提取目标目录（回退方案）
  6. 复制到中央仓库: skills/anthropics/pdf-processing/
  7. 解析 SKILL.md frontmatter → 生成 manifest.yaml
  8. 更新 skills-lock.json
  9. (可选) 自动 deploy 到已检测到的 Agent
```

## 8.3 搜索流程

```
skill-sync search pdf

  ── 本地匹配 ──────────────────────────
  anthropics/pdf-processing    1.1.0   [pdf, document]

  ── skills.sh 搜索 ────────────────────
  anthropics/pdf               ★ 1234   ↓ 56789   Use this skill whenever...
  vercel-labs/pdf-export       ★ 234    ↓ 1234    Export PDF from markdown
  user123/pdf-reader           ★ 56     ↓ 789     PDF reader skill

  安装: skill-sync install <source> --skill <skill-id>
```
