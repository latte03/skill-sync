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
import { checkAllUpdates, checkForUpdate } from '../core/version-manager.js';
import {
  isGitInitialized,
  initGit,
  getSyncStatus,
  pushSync,
  pullSync,
  getRemotes,
  setRemoteUrl,
  getCommitLog,
  getBranchInfo,
  getChangedFiles,
  getGitDiff,
} from '../core/sync-manager.js';
import type { ConflictStrategy } from '../lib/types.js';
import { searchLocal, searchRemote, searchAll } from '../lib/search.js';
import { getAgents, detectInstalledAgents } from '../lib/agents.js';
import { listAllTags, addTag, removeTag, getSkillTags } from '../lib/tags.js';
import { readConfig } from '../config.js';
import {
  getAllProviders,
  getActiveProvider,
  setActiveProvider,
  addCustomProvider,
  removeCustomProvider,
  getApiKey,
  setApiKey,
  removeApiKey,
  hasApiKey,
  generateCommitMessage,
} from '../lib/ai-provider.js';
import { readLock } from '../lib/lock.js';
import { getHomeDir, skillMdPath, skillRepoPath } from '../lib/paths.js';
import { recoverManagedState } from '../core/state-recovery.js';
import { apiError } from './api-error.js';
import { settingsRoutes } from './routes/settings.js';

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
      result = installLocalSkill(ctx, body.source, {
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
app.post('/api/skill/deploy', (c) => {
  try {
    const ctx = createContext();
    const name = c.req.query('name') ?? '';
    const agentsParam = c.req.query('agents');
    const agents = agentsParam ? agentsParam.split(',').map(s => s.trim()).filter(Boolean) : [];

    if (!name) {
      return c.json({ error: '缺少 skill name' }, 400);
    }

    if (agents.length === 0) {
      return c.json({ error: '请指定至少一个 Agent' }, 400);
    }

    deploySkills(ctx, name, agents, { mode: 'symlink' });

    return c.json({ success: true });
  } catch (e) {
    return apiError(c, e);
  }
});

// ─── 取消分发 ─────────────────────────────────────
app.post('/api/skill/undeploy', (c) => {
  try {
    const ctx = createContext();
    const name = c.req.query('name') ?? '';
    const agentsParam = c.req.query('agents');
    const agents = agentsParam ? agentsParam.split(',').map(s => s.trim()).filter(Boolean) : [];

    if (!name) {
      return c.json({ error: '缺少 skill name' }, 400);
    }

    if (agents.length === 0) {
      return c.json({ error: '请指定至少一个 Agent' }, 400);
    }

    undeploySkills(ctx, name, agents);

    return c.json({ success: true });
  } catch (e) {
    return apiError(c, e);
  }
});

// ─── 标签管理 ─────────────────────────────────────
app.post('/api/skill/tags', async (c) => {
  try {
    const name = c.req.query('name') ?? '';
    const body = await c.req.json<{ action: 'add' | 'remove'; tag: string }>();

    if (!name) {
      return c.json({ error: '缺少 skill name' }, 400);
    }

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

// ─── Git 同步 ─────────────────────────────────────

// 获取同步状态（含远程仓库、分支、变更文件等详情）
app.get('/api/sync/status', async (c) => {
  try {
    const ctx = createContext();
    const syncStatus = await getSyncStatus(ctx);
    const remotes = await getRemotes(ctx);
    const branchInfo = await getBranchInfo(ctx);
    const changedFiles = await getChangedFiles(ctx);

    return c.json({
      ...syncStatus,
      remotes,
      branch: branchInfo.current,
      tracking: branchInfo.tracking,
      changedFiles,
    });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// 获取提交历史
app.get('/api/sync/log', async (c) => {
  try {
    const ctx = createContext();
    const limit = parseInt(c.req.query('limit') ?? '20', 10);
    const commits = await getCommitLog(ctx, limit);
    return c.json({ commits });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// 推送变更到远程
app.post('/api/sync/push', async (c) => {
  try {
    const ctx = createContext();
    const body = await c.req.json<{ message?: string }>().catch(() => ({ message: undefined }));
    const result = await pushSync(ctx, { message: body.message });
    return c.json(result);
  } catch (e) {
    return c.json({ success: false, pushed: 0, pulled: 0, conflicts: [], error: (e as Error).message }, 500);
  }
});

// 拉取远程变更
app.post('/api/sync/pull', async (c) => {
  try {
    const ctx = createContext();
    const body = await c.req.json<{ strategy?: ConflictStrategy }>().catch(() => ({ strategy: undefined }));
    const result = await pullSync(ctx, { strategy: body.strategy });
    return c.json(result);
  } catch (e) {
    return c.json({ success: false, pushed: 0, pulled: 0, conflicts: [], error: (e as Error).message }, 500);
  }
});

// 初始化 Git 仓库
app.post('/api/sync/init', async (c) => {
  try {
    const ctx = createContext();
    if (!isGitInitialized()) {
      await initGit(ctx);
    }
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// 设置远程仓库 URL
app.post('/api/sync/remote', async (c) => {
  try {
    const ctx = createContext();
    const body = await c.req.json<{ name?: string; url: string }>();
    const name = body.name ?? 'origin';
    if (!body.url) {
      return c.json({ error: '缺少 url 参数' }, 400);
    }
    await setRemoteUrl(ctx, name, body.url);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ─── AI 提供商管理 ──────────────────────────────────

// 获取所有厂商（含配置状态）
app.get('/api/ai/providers', (c) => {
  try {
    const providers = getAllProviders();
    const active = getActiveProvider();
    const result = providers.map(p => ({
      ...p,
      hasKey: hasApiKey(p.id),
      isActive: active?.provider.id === p.id,
    }));
    return c.json({
      providers: result,
      activeProvider: active?.provider.id ?? null,
      activeModel: active?.model ?? null,
    });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// 设置活跃厂商 + 模型
app.post('/api/ai/active', async (c) => {
  try {
    const body = await c.req.json<{ provider: string; model: string }>();
    if (!body.provider || !body.model) {
      return c.json({ error: '缺少 provider 或 model 参数' }, 400);
    }
    setActiveProvider(body.provider, body.model);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// 设置 API Key
app.post('/api/ai/key', async (c) => {
  try {
    const body = await c.req.json<{ provider: string; key: string }>();
    if (!body.provider || !body.key) {
      return c.json({ error: '缺少 provider 或 key 参数' }, 400);
    }
    setApiKey(body.provider, body.key);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// 删除 API Key
app.delete('/api/ai/key/:provider', (c) => {
  try {
    const provider = c.req.param('provider');
    removeApiKey(provider);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// 添加自定义厂商
app.post('/api/ai/custom', async (c) => {
  try {
    const body = await c.req.json<{
      id: string; name: string; baseUrl: string;
      models: string[]; defaultModel: string; iconColor?: string;
    }>();
    if (!body.id || !body.name || !body.baseUrl) {
      return c.json({ error: '缺少必要参数' }, 400);
    }
    addCustomProvider({
      id: body.id,
      name: body.name,
      baseUrl: body.baseUrl,
      models: body.models.length > 0 ? body.models : [body.defaultModel],
      defaultModel: body.defaultModel ?? body.models[0] ?? 'default',
      iconColor: body.iconColor,
      custom: true,
    });
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// 删除自定义厂商
app.delete('/api/ai/custom/:provider', (c) => {
  try {
    const provider = c.req.param('provider');
    removeCustomProvider(provider);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// AI 生成 commit 消息
app.post('/api/ai/generate-commit', async (c) => {
  try {
    const ctx = createContext();
    const { diff, files } = await getGitDiff(ctx);
    if (!diff && files.length === 0) {
      return c.json({ error: '无变更内容可分析' }, 400);
    }
    const message = await generateCommitMessage(diff, files);
    return c.json({ message, fileCount: files.length });
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

    if (!name) {
      return c.json({ error: '缺少 skill name' }, 400);
    }

    removeSkill(ctx, name, scope as 'central' | 'all');

    return c.json({ success: true });
  } catch (e) {
    return apiError(c, e);
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
