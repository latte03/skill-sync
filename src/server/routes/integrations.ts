/** Git synchronization and AI provider routes. */

import { Hono } from 'hono';
import { createContext } from '../../core/context.js';
import {
  getBranchInfo,
  getChangedFiles,
  getCommitLog,
  getGitDiff,
  getRemotes,
  getSyncStatus,
  initGit,
  isGitInitialized,
  pullSync,
  pushSync,
  setRemoteUrl,
} from '../../core/sync-manager.js';
import {
  addCustomProvider,
  generateCommitMessage,
  getActiveProvider,
  getAllProviders,
  hasApiKey,
  removeApiKey,
  removeCustomProvider,
  setActiveProvider,
  setApiKey,
} from '../../lib/ai-provider.js';
import type { ConflictStrategy } from '../../lib/types.js';

export const integrationRoutes = new Hono();

integrationRoutes.get('/sync/status', async (c) => {
  try {
    const ctx = createContext();
    const [syncStatus, remotes, branchInfo, changedFiles] = await Promise.all([
      getSyncStatus(ctx), getRemotes(ctx), getBranchInfo(ctx), getChangedFiles(ctx),
    ]);
    return c.json({ ...syncStatus, remotes, branch: branchInfo.current, tracking: branchInfo.tracking, changedFiles });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

integrationRoutes.get('/sync/log', async (c) => {
  try {
    const commits = await getCommitLog(createContext(), Number.parseInt(c.req.query('limit') ?? '20', 10));
    return c.json({ commits });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

integrationRoutes.post('/sync/push', async (c) => {
  try {
    const body = await c.req.json<{ message?: string }>().catch(() => ({ message: undefined }));
    return c.json(await pushSync(createContext(), { message: body.message }));
  } catch (error) {
    return c.json({ success: false, pushed: 0, pulled: 0, conflicts: [], error: (error as Error).message }, 500);
  }
});

integrationRoutes.post('/sync/pull', async (c) => {
  try {
    const body = await c.req.json<{ strategy?: ConflictStrategy }>().catch(() => ({ strategy: undefined }));
    return c.json(await pullSync(createContext(), { strategy: body.strategy }));
  } catch (error) {
    return c.json({ success: false, pushed: 0, pulled: 0, conflicts: [], error: (error as Error).message }, 500);
  }
});

integrationRoutes.post('/sync/init', async (c) => {
  try {
    const ctx = createContext();
    if (!isGitInitialized()) await initGit(ctx);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

integrationRoutes.post('/sync/remote', async (c) => {
  try {
    const body = await c.req.json<{ name?: string; url: string }>();
    if (!body.url) return c.json({ error: '缺少 url 参数' }, 400);
    await setRemoteUrl(createContext(), body.name ?? 'origin', body.url);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

integrationRoutes.get('/ai/providers', (c) => {
  try {
    const active = getActiveProvider();
    const providers = getAllProviders().map(provider => ({
      ...provider,
      hasKey: hasApiKey(provider.id),
      isActive: active?.provider.id === provider.id,
    }));
    return c.json({ providers, activeProvider: active?.provider.id ?? null, activeModel: active?.model ?? null });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

integrationRoutes.post('/ai/active', async (c) => {
  try {
    const body = await c.req.json<{ provider: string; model: string }>();
    if (!body.provider || !body.model) return c.json({ error: '缺少 provider 或 model 参数' }, 400);
    setActiveProvider(body.provider, body.model);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

integrationRoutes.post('/ai/key', async (c) => {
  try {
    const body = await c.req.json<{ provider: string; key: string }>();
    if (!body.provider || !body.key) return c.json({ error: '缺少 provider 或 key 参数' }, 400);
    setApiKey(body.provider, body.key);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

integrationRoutes.delete('/ai/key/:provider', (c) => {
  try {
    removeApiKey(c.req.param('provider'));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

integrationRoutes.post('/ai/custom', async (c) => {
  try {
    const body = await c.req.json<{ id: string; name: string; baseUrl: string; models: string[]; defaultModel: string; iconColor?: string }>();
    if (!body.id || !body.name || !body.baseUrl) return c.json({ error: '缺少必要参数' }, 400);
    addCustomProvider({
      id: body.id, name: body.name, baseUrl: body.baseUrl,
      models: body.models.length > 0 ? body.models : [body.defaultModel],
      defaultModel: body.defaultModel ?? body.models[0] ?? 'default', iconColor: body.iconColor, custom: true,
    });
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

integrationRoutes.delete('/ai/custom/:provider', (c) => {
  try {
    removeCustomProvider(c.req.param('provider'));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

integrationRoutes.post('/ai/generate-commit', async (c) => {
  try {
    const { diff, files } = await getGitDiff(createContext());
    if (!diff && files.length === 0) return c.json({ error: '无变更内容可分析' }, 400);
    const message = await generateCommitMessage(diff, files);
    return c.json({ message, fileCount: files.length });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});
