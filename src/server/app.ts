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
 *   POST   /api/skill/deploy?name=...    — 分发 skill
 *   POST   /api/skill/undeploy?name=...  — 取消分发
 *   DELETE /api/skill?name=...           — 删除 skill
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createContext } from '../core/context.js';
import { listSkills, getSkillDetail, deploySkills, undeploySkills, removeSkill, listBackups } from '../core/skill-manager.js';
import { installGitHubSkill, installLocalSkill } from '../core/installer.js';
import { searchLocal, searchRemote, searchAll } from '../lib/search.js';
import { getAgents, detectInstalledAgents } from '../lib/agents.js';
import { listAllTags, addTag, removeTag, getSkillTags } from '../lib/tags.js';
import { readConfig } from '../config.js';
import { readLock } from '../lib/lock.js';
import { getHomeDir, skillMdPath, skillRepoPath } from '../lib/paths.js';
import { recoverManagedState } from '../core/state-recovery.js';
import type { RemoveScope, UserDeployMode } from '../lib/types.js';
import { ApiValidationError, apiError } from './api-error.js';
import { settingsRoutes } from './routes/settings.js';
import { updateRoutes } from './routes/updates.js';
import { integrationRoutes } from './routes/integrations.js';
import { dependencyRoutes } from './routes/dependencies.js';
import { registerStaticFallback } from './static.js';

const app = new Hono();

// CORS — 开发时 Vite dev server 和 Hono 在不同端口
app.use('/api/*', cors());

// Match the CLI pre-action lifecycle before any API state change, even when
// the Hono app is embedded or started without `skill-sync ui`.
app.use('/api/*', async (c, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
    await next();
    return;
  }

  try {
    recoverManagedState();
    await next();
  } catch (error) {
    return apiError(c, error);
  }
});

// Settings routes are mounted after shared middleware so they receive the
// same CORS and interrupted-state handling as the original API surface.
app.route('/api', settingsRoutes);
app.route('/api', updateRoutes);
app.route('/api', integrationRoutes);
app.route('/api', dependencyRoutes);

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
    return apiError(c, e);
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
    return apiError(c, e);
  }
});

// ─── Skill 详情 ───────────────────────────────────
// 使用 /api/skill/detail?name=xxx 查询参数方式，支持任意嵌套路径
app.get('/api/skill/detail', (c) => {
  try {
    const ctx = createContext();
    const name = c.req.query('name') ?? '';

    if (!name) {
      return c.json({ error: '缺少查询参数 name' }, 400);
    }

    const detail = getSkillDetail(ctx, name);

    if (!detail) {
      return c.json({ error: `Skill 未找到: ${name}` }, 404);
    }

    // 附加备份信息
    const backups = listBackups(name);

    // 读取 SKILL.md 内容
    let skillMd = '';
    try {
      const mdPath = skillMdPath(name);
      if (fs.existsSync(mdPath)) {
        skillMd = fs.readFileSync(mdPath, 'utf-8');
      }
    } catch {
      // SKILL.md 可能不存在
    }

    return c.json({ skill: detail, backups, skillMd });
  } catch (e) {
    return apiError(c, e);
  }
});

// ─── Skill 文件列表 ─────────────────────────────────
app.get('/api/skill/files', (c) => {
  try {
    const name = c.req.query('name') ?? '';
    if (!name) return c.json({ error: '缺少查询参数 name' }, 400);

    const root = skillRepoPath(name);
    if (!fs.existsSync(root)) return c.json({ error: `Skill 未找到: ${name}` }, 404);

    const IGNORED = new Set(['.backup', 'node_modules', '.git']);

    interface FileEntry { name: string; path: string; type: 'file' | 'directory'; size?: number; children?: FileEntry[] }

    function walk(dir: string, relative: string): FileEntry[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const result: FileEntry[] = [];
      for (const entry of entries) {
        if (IGNORED.has(entry.name) || entry.name.startsWith('.')) continue;
        const rel = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          result.push({ name: entry.name, path: rel, type: 'directory', children: walk(path.join(dir, entry.name), rel) });
        } else {
          const stat = fs.statSync(path.join(dir, entry.name));
          result.push({ name: entry.name, path: rel, type: 'file', size: stat.size });
        }
      }
      // directories first, then alphabetical
      result.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1));
      return result;
    }

    return c.json({ files: walk(root, '') });
  } catch (e) {
    return apiError(c, e);
  }
});

// ─── Skill 单文件内容 ───────────────────────────────
app.get('/api/skill/file', (c) => {
  try {
    const name = c.req.query('name') ?? '';
    const filePath = c.req.query('path') ?? '';
    if (!name || !filePath) return c.json({ error: '缺少查询参数 name 或 path' }, 400);

    // Prevent path traversal
    if (filePath.includes('..') || path.isAbsolute(filePath)) {
      return c.json({ error: '非法路径' }, 400);
    }

    const root = skillRepoPath(name);
    const fullPath = path.join(root, filePath);

    // Ensure resolved path is still within skill root
    if (!fullPath.startsWith(root + path.sep) && fullPath !== root) {
      return c.json({ error: '非法路径' }, 400);
    }

    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      return c.json({ error: '文件未找到' }, 404);
    }

    const stat = fs.statSync(fullPath);
    // Limit file size to 512KB for text preview
    if (stat.size > 512 * 1024) {
      return c.json({ error: '文件过大，无法预览', size: stat.size }, 413);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    return c.json({ path: filePath, content, size: stat.size });
  } catch (e) {
    return apiError(c, e);
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
    // Legacy versions stored platform tokens in config.yaml. Never expose them
    // through the API while migration moves new writes to secrets.yaml.
    for (const platform of ['github', 'gitee'] as const) {
      if (config.sync?.[platform]?.token) delete config.sync[platform].token;
    }
    return c.json({ config });
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
      installDeps?: boolean;
    }>();
    if (typeof body.source !== 'string' || !body.source.trim()) throw new ApiValidationError('source 必须是非空字符串');
    if (body.mode !== undefined && body.mode !== 'symlink' && body.mode !== 'copy') throw new ApiValidationError('mode 必须是 symlink 或 copy');
    if (body.installDeps !== undefined && typeof body.installDeps !== 'boolean') throw new ApiValidationError('installDeps 必须是布尔值');

    // 判断来源类型
    const isLocal = body.source.startsWith('/') || body.source.startsWith('./') || body.source.startsWith('../');

    let result;
    if (isLocal) {
      result = installLocalSkill(ctx, body.source, {
        skill: body.skill,
        noDeploy: body.noDeploy ?? false,
        installDeps: body.installDeps,
        deployType: body.mode,
        agents: body.agents,
        yes: true,
      });
    } else {
      result = await installGitHubSkill(ctx, body.source, {
        skill: body.skill,
        noDeploy: body.noDeploy ?? false,
        installDeps: body.installDeps,
        deployType: body.mode,
        agents: body.agents,
        yes: true,
      });
    }

    return c.json({ success: true, result });
  } catch (e) {
    return apiError(c, e);
  }
});

// ─── 分发 Skill ───────────────────────────────────
app.post('/api/skill/deploy', async (c) => {
  try {
    const name = c.req.query('name') ?? '';
    const agentsParam = c.req.query('agents');
    const body = await c.req.json<{ agents?: unknown; mode?: unknown; force?: unknown; dryRun?: unknown }>()
      .catch((): { agents?: unknown; mode?: unknown; force?: unknown; dryRun?: unknown } => ({}));
    const agents = parseAgentList(body.agents, agentsParam);
    const mode = parseDeployMode(body.mode);
    if (!name) throw new ApiValidationError('缺少 skill name');
    if (agents.length === 0) throw new ApiValidationError('请指定至少一个 Agent');
    if (body.force !== undefined && typeof body.force !== 'boolean') throw new ApiValidationError('force 必须是布尔值');
    if (body.dryRun !== undefined && typeof body.dryRun !== 'boolean') throw new ApiValidationError('dryRun 必须是布尔值');

    deploySkills(createContext({ dryRun: body.dryRun === true }), name, agents, { mode, force: body.force === true });
    return c.json({ success: true, dryRun: body.dryRun === true });
  } catch (e) {
    return apiError(c, e);
  }
});

// ─── 取消分发 ─────────────────────────────────────
app.post('/api/skill/undeploy', async (c) => {
  try {
    const name = c.req.query('name') ?? '';
    const agentsParam = c.req.query('agents');
    const body = await c.req.json<{ agents?: unknown; dryRun?: unknown }>()
      .catch((): { agents?: unknown; dryRun?: unknown } => ({}));
    const agents = parseAgentList(body.agents, agentsParam);
    if (!name) throw new ApiValidationError('缺少 skill name');
    if (agents.length === 0) throw new ApiValidationError('请指定至少一个 Agent');
    if (body.dryRun !== undefined && typeof body.dryRun !== 'boolean') throw new ApiValidationError('dryRun 必须是布尔值');

    undeploySkills(createContext({ dryRun: body.dryRun === true }), name, agents);
    return c.json({ success: true, dryRun: body.dryRun === true });
  } catch (e) {
    return apiError(c, e);
  }
});

// ─── 标签管理 ─────────────────────────────────────
app.post('/api/skill/tags', async (c) => {
  try {
    const name = c.req.query('name') ?? '';
    const body = await c.req.json<{ action: 'add' | 'remove'; tag: string }>();

    if (!name) throw new ApiValidationError('缺少 skill name');

    if (body.action !== 'add' && body.action !== 'remove') throw new ApiValidationError('action 必须是 add 或 remove');
    if (!body.tag?.trim()) throw new ApiValidationError('tag 必须是非空字符串');

    if (body.action === 'add') {
      addTag(name, body.tag);
    } else {
      removeTag(name, body.tag);
    }

    const tags = getSkillTags(name);
    return c.json({ success: true, tags });
  } catch (e) {
    return apiError(c, e);
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
      for (const agentName of installedAgents) {
        const agentConfig = allAgents[agentName];
        if (!agentConfig) continue;

        const agentSkillDir = agentConfig.skillsDir;
        const destPath = path.join(
          agentSkillDir.startsWith('/') ? agentSkillDir : path.join(process.env.SKILL_SYNC_AGENTS_DIR ?? os.homedir(), agentSkillDir),
          fullName
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
          const expectedPath = skillRepoPath(fullName);
          const targetPath = path.resolve(path.dirname(destPath), target);
          if (targetPath !== path.resolve(expectedPath)) {
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
app.delete('/api/skill', (c) => {
  try {
    const ctx = createContext();
    const name = c.req.query('name') ?? '';
    const scope = c.req.query('scope') ?? 'all';
    const agent = c.req.query('agent');

    if (!name) throw new ApiValidationError('缺少 skill name');
    if (scope !== 'all' && scope !== 'central' && scope !== 'agent') throw new ApiValidationError('scope 必须是 all、central 或 agent');
    if (scope === 'agent' && !agent?.trim()) throw new ApiValidationError('scope=agent 时必须提供 agent');

    removeSkill(ctx, name, scope as RemoveScope, agent?.trim());

    return c.json({ success: true });
  } catch (e) {
    return apiError(c, e);
  }
});

function parseAgentList(value: unknown, queryValue: string | undefined): string[] {
  if (value !== undefined) {
    if (!Array.isArray(value) || value.some(agent => typeof agent !== 'string')) {
      throw new ApiValidationError('agents 必须是字符串数组');
    }
    return value.map(agent => agent.trim()).filter(Boolean);
  }
  return queryValue ? queryValue.split(',').map(agent => agent.trim()).filter(Boolean) : [];
}

function parseDeployMode(value: unknown): UserDeployMode | undefined {
  if (value === undefined) return undefined;
  if (value === 'symlink' || value === 'copy') return value;
  throw new ApiValidationError('mode 必须是 symlink 或 copy');
}

registerStaticFallback(app);

export { app };
