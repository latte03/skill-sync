/**
 * HTTP API 层 — Hono REST API
 *
 * 参考 PRD §4 架构设计：HTTP API = Core API 的薄封装
 *
 * 端点设计：
 *   GET    /api/health          — 健康检查
 *   GET    /api/status          — 全局状态
 *   GET    /api/skills          — 列出所有 skill
 *   GET    /api/skills/:name    — skill 详情
 *   GET    /api/search?q=...    — 搜索（本地 + skills.sh）
 *   GET    /api/agents          — 列出 Agent
 *   GET    /api/tags            — 列出标签
 *   GET    /api/config          — 获取配置
 *   GET    /api/check           — 检查更新
 *   POST   /api/skills/install  — 安装 skill
 *   POST   /api/skills/:name/deploy    — 分发 skill
 *   POST   /api/skills/:name/undeploy  — 取消分发
 *   DELETE /api/skills/:name    — 删除 skill
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createContext } from '../core/context.js';
import { listSkills, getSkillDetail, deploySkill, undeploySkill, removeSkill, listBackups } from '../core/skill-manager.js';
import { installGitHubSkill, installLocalSkill } from '../core/installer.js';
import { checkAllUpdates, checkForUpdate } from '../core/version-manager.js';
import { searchLocal, searchRemote, searchAll } from '../lib/search.js';
import { getAgents, detectInstalledAgents } from '../lib/agents.js';
import { listAllTags, addTag, removeTag, getSkillTags } from '../lib/tags.js';
import { readConfig } from '../config.js';
import { readLock } from '../lib/lock.js';
import { getHomeDir, skillMdPath } from '../lib/paths.js';

const app = new Hono();

// CORS — 开发时 Vite dev server 和 Hono 在不同端口
app.use('/api/*', cors());

// ─── 健康检查 ─────────────────────────────────────
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', version: '0.1.0' });
});

// ─── 全局状态 ─────────────────────────────────────
app.get('/api/status', (c) => {
  try {
    const ctx = createContext();
    const lock = readLock();
    const skillCount = Object.keys(lock.skills).length;
    const installedAgents = detectInstalledAgents();
    const homeDir = getHomeDir();

    const skills = listSkills(ctx);
    const managedCount = skills.filter(s => s.managed).length;
    const unmanagedCount = skills.filter(s => !s.managed).length;

    // Agent 分发统计
    const agentStats = installedAgents.map(agentName => {
      let managed = 0;
      let unmanaged = 0;
      for (const skill of skills) {
        if (skill.agents.includes(agentName)) {
          if (skill.managed) managed++;
          else unmanaged++;
        }
      }
      return { agent: agentName, managed, unmanaged, total: managed + unmanaged };
    });

    return c.json({
      homeDir,
      skillCount,
      managedCount,
      unmanagedCount,
      agents: agentStats,
      installedAgents,
    });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ─── Skill 列表 ───────────────────────────────────
app.get('/api/skills', (c) => {
  try {
    const ctx = createContext();
    const agent = c.req.query('agent');
    const tag = c.req.query('tag');

    let skills = listSkills(ctx);

    // 按 Agent 过滤
    if (agent) {
      skills = skills.filter(s => s.agents.includes(agent));
    }

    // 按标签过滤
    if (tag) {
      const tags = listAllTags();
      const taggedSkills = tags[tag] ?? [];
      skills = skills.filter(s => taggedSkills.includes(s.name));
    }

    return c.json({ skills });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ─── Skill 详情 ───────────────────────────────────
app.get('/api/skills/*', (c) => {
  try {
    const ctx = createContext();
    // 提取 skill name：去掉前缀 /api/skills/
    const name = c.req.path.replace('/api/skills/', '');
    const detail = getSkillDetail(ctx, name);

    if (!detail) {
      return c.json({ error: `Skill 未找到: ${name}` }, 404);
    }

    // 附加备份信息
    const backups = listBackups(name);

    // 读取 SKILL.md 内容
    let skillMd = '';
    try {
      const mdPath = skillMdPath(detail.namespace, detail.skillName);
      if (fs.existsSync(mdPath)) {
        skillMd = fs.readFileSync(mdPath, 'utf-8');
      }
    } catch {
      // SKILL.md 可能不存在
    }

    return c.json({ skill: detail, backups, skillMd });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ─── 搜索 ─────────────────────────────────────────
app.get('/api/search', async (c) => {
  try {
    const q = c.req.query('q') ?? '';
    const scope = c.req.query('scope') ?? 'all';
    const limit = parseInt(c.req.query('limit') ?? '20', 10);

    if (!q) {
      return c.json({ error: '缺少查询参数 q' }, 400);
    }

    if (scope === 'local') {
      const local = searchLocal(q, limit);
      return c.json({ local, remote: [] });
    } else if (scope === 'remote') {
      const remote = await searchRemote(q, limit);
      return c.json({ local: [], remote });
    } else {
      const result = await searchAll(q, { limit });
      return c.json(result);
    }
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ─── Agent 列表 ───────────────────────────────────
app.get('/api/agents', (c) => {
  try {
    const allAgents = getAgents();
    const installed = detectInstalledAgents();

    const agents = Object.entries(allAgents).map(([name, config]) => ({
      name,
      displayName: config.displayName,
      skillsDir: config.skillsDir,
      installed: installed.includes(name),
    }));

    return c.json({ agents });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ─── 标签 ─────────────────────────────────────────
app.get('/api/tags', (c) => {
  try {
    const tags = listAllTags();
    return c.json({ tags });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ─── 配置 ─────────────────────────────────────────
app.get('/api/config', (c) => {
  try {
    const config = readConfig();
    return c.json({ config });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ─── 检查更新 ─────────────────────────────────────
app.get('/api/check', async (c) => {
  try {
    const ctx = createContext();
    const name = c.req.query('name');

    if (name) {
      const result = await checkForUpdate(ctx, name);
      return c.json({ results: [result] });
    } else {
      const results = await checkAllUpdates(ctx);
      return c.json({ results });
    }
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ─── 安装 Skill ───────────────────────────────────
app.post('/api/skills/install', async (c) => {
  try {
    const ctx = createContext();
    const body = await c.req.json<{
      source: string;
      skill?: string;
      agents?: string[];
      mode?: 'symlink' | 'copy';
      noDeploy?: boolean;
    }>();

    // 判断来源类型
    const isLocal = body.source.startsWith('/') || body.source.startsWith('./') || body.source.startsWith('../');

    let result;
    if (isLocal) {
      result = installLocalSkill(ctx, body.source, 'local', {
        skill: body.skill,
        noDeploy: body.noDeploy ?? false,
        ignoreDeps: true,
        deployType: body.mode,
        agents: body.agents,
        yes: true,
      });
    } else {
      result = await installGitHubSkill(ctx, body.source, {
        skill: body.skill,
        noDeploy: body.noDeploy ?? false,
        ignoreDeps: true,
        deployType: body.mode,
        agents: body.agents,
        yes: true,
      });
    }

    return c.json({ success: true, result });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ─── 分发 Skill ───────────────────────────────────
app.post('/api/skills/*/deploy', (c) => {
  try {
    const ctx = createContext();
    // 提取 skill name
    const name = c.req.path.replace('/api/skills/', '').replace('/deploy', '');
    const agentsParam = c.req.query('agents');
    const agents = agentsParam ? agentsParam.split(',').map(s => s.trim()).filter(Boolean) : [];

    if (agents.length === 0) {
      return c.json({ error: '请指定至少一个 Agent' }, 400);
    }

    for (const agentName of agents) {
      deploySkill(ctx, name, agentName, { mode: 'symlink' });
    }

    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ─── 取消分发 ─────────────────────────────────────
app.post('/api/skills/*/undeploy', (c) => {
  try {
    const ctx = createContext();
    // 提取 skill name
    const name = c.req.path.replace('/api/skills/', '').replace('/undeploy', '');
    const agentsParam = c.req.query('agents');
    const agents = agentsParam ? agentsParam.split(',').map(s => s.trim()).filter(Boolean) : [];

    if (agents.length === 0) {
      return c.json({ error: '请指定至少一个 Agent' }, 400);
    }

    for (const agentName of agents) {
      undeploySkill(ctx, name, agentName);
    }

    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ─── 标签管理 ─────────────────────────────────────
app.post('/api/skills/*/tags', async (c) => {
  try {
    const name = c.req.path.replace('/api/skills/', '').replace('/tags', '');
    const body = await c.req.json<{ action: 'add' | 'remove'; tag: string }>();

    if (body.action === 'add') {
      addTag(name, body.tag);
    } else {
      removeTag(name, body.tag);
    }

    const tags = getSkillTags(name);
    return c.json({ success: true, tags });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ─── 冲突检测 ─────────────────────────────────────
app.get('/api/conflicts', (c) => {
  try {
    const ctx = createContext();
    const lock = readLock();
    const allAgents = getAgents();
    const installedAgents = detectInstalledAgents();
    const conflicts: Array<{
      skillName: string;
      agent: string;
      destPath: string;
      type: 'managed-mismatch' | 'unmanaged' | 'broken-symlink';
      detail: string;
    }> = [];

    for (const [fullName, entry] of Object.entries(lock.skills)) {
      const [namespace, skillName] = fullName.split('/');
      if (!namespace || !skillName) continue;

      for (const agentName of installedAgents) {
        const agentConfig = allAgents[agentName];
        if (!agentConfig) continue;

        const agentSkillDir = agentConfig.skillsDir;
        const destPath = path.join(
          agentSkillDir.startsWith('/') ? agentSkillDir : path.join(process.env.SKILL_SYNC_AGENTS_DIR ?? os.homedir(), agentSkillDir),
          skillName
        );

        let lstat: fs.Stats | null = null;
        try {
          lstat = fs.lstatSync(destPath);
        } catch {
          // 目标不存在，无冲突
          continue;
        }

        const isDeployed = agentName in entry.distribution;

        if (lstat.isSymbolicLink()) {
          // 检查 symlink 是否指向中央仓库
          const target = fs.readlinkSync(destPath);
          const expectedPath = path.join(getHomeDir(), 'skills', namespace, skillName);
          if (path.resolve(target) !== path.resolve(expectedPath)) {
            conflicts.push({
              skillName: fullName,
              agent: agentName,
              destPath,
              type: 'managed-mismatch',
              detail: `symlink 指向 ${target}，预期指向 ${expectedPath}`,
            });
          }
        } else if (lstat.isDirectory()) {
          // 目录存在但非 symlink
          if (isDeployed && entry.distribution[agentName].mode === 'symlink') {
            conflicts.push({
              skillName: fullName,
              agent: agentName,
              destPath,
              type: 'managed-mismatch',
              detail: '应为 symlink 但实际是目录（可能被手动覆盖）',
            });
          } else if (!isDeployed) {
            conflicts.push({
              skillName: fullName,
              agent: agentName,
              destPath,
              type: 'unmanaged',
              detail: 'Agent 目录中存在未管理的 skill 副本',
            });
          }
        }
      }
    }

    return c.json({ conflicts });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ─── 删除 Skill ───────────────────────────────────
app.delete('/api/skills/*', (c) => {
  try {
    const ctx = createContext();
    // 提取 skill name
    const name = c.req.path.replace('/api/skills/', '');
    const scope = c.req.query('scope') ?? 'all';

    removeSkill(ctx, name, scope as 'central' | 'all');

    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ─── 静态文件服务（生产模式） ───────────────────────
// 查找前端构建产物：先查 ~/.skill-sync/web，再查包内的 dist/web
import { fileURLToPath } from 'node:url';

const possibleStaticDirs = [
  path.join(getHomeDir(), 'web'),
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web'),
];

let staticDir: string | null = null;
for (const dir of possibleStaticDirs) {
  if (fs.existsSync(path.join(dir, 'index.html'))) {
    staticDir = dir;
    break;
  }
}

if (staticDir) {
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };

  app.get('*', (c) => {
    const urlPath = c.req.path;
    // 跳过 API 路由
    if (urlPath.startsWith('/api/')) {
      return c.json({ error: 'Not found' }, 404);
    }

    // 尝试提供静态文件
    let filePath = path.join(staticDir!, urlPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const content = fs.readFileSync(filePath);
      return new Response(content, {
        headers: { 'Content-Type': mimeTypes[ext] ?? 'application/octet-stream' },
      });
    }

    // SPA 回退：所有未匹配的路由返回 index.html
    const indexPath = path.join(staticDir!, 'index.html');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath);
      return new Response(content, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return c.json({ error: 'Not found' }, 404);
  });
}

export { app };
