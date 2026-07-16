import { Hono } from 'hono';
import {
  getActiveGitPlatform,
  getGitPlatforms,
  getProxyConfig,
  removeGitPlatformToken,
  setGitPlatformConfig,
  setGitPlatformEnabled,
  setGitPlatformToken,
  setProxyConfig,
} from '../../core/sync-manager.js';
import { resetProxyCache } from '../../lib/git-api.js';
import type { GitPlatform } from '../../lib/types.js';
import { apiError, ApiValidationError } from '../api-error.js';

export const settingsRoutes = new Hono();

settingsRoutes.get('/git/platforms', (c) => {
  try {
    return c.json({ platforms: getGitPlatforms(), active: getActiveGitPlatform() });
  } catch (error) {
    return apiError(c, error);
  }
});

settingsRoutes.post('/git/platforms/:platform/enable', async (c) => {
  try {
    const platform = parsePlatform(c.req.param('platform'));
    const body = await c.req.json<{ enabled?: unknown }>();
    if (typeof body.enabled !== 'boolean') return c.json({ error: 'enabled 必须是布尔值' }, 400);
    setGitPlatformEnabled(platform, body.enabled);
    return c.json({ success: true, active: getActiveGitPlatform() });
  } catch (error) {
    return apiError(c, error);
  }
});

settingsRoutes.post('/git/platforms/:platform/token', async (c) => {
  try {
    const platform = parsePlatform(c.req.param('platform'));
    const body = await c.req.json<{ token?: unknown; username?: unknown }>();
    if (typeof body.token !== 'string' || body.token.trim() === '') return c.json({ error: '缺少 token' }, 400);
    if (body.username !== undefined && typeof body.username !== 'string') return c.json({ error: 'username 必须是字符串' }, 400);
    setGitPlatformToken(platform, body.token.trim());
    if (typeof body.username === 'string') setGitPlatformConfig(platform, { username: body.username.trim() || undefined });
    return c.json({ success: true });
  } catch (error) {
    return apiError(c, error);
  }
});

settingsRoutes.delete('/git/platforms/:platform/token', (c) => {
  try {
    removeGitPlatformToken(parsePlatform(c.req.param('platform')));
    return c.json({ success: true });
  } catch (error) {
    return apiError(c, error);
  }
});

settingsRoutes.post('/git/platforms/:platform/repo', async (c) => {
  try {
    const platform = parsePlatform(c.req.param('platform'));
    const body = await c.req.json<{ repo?: unknown; branch?: unknown }>();
    if (body.repo !== undefined && typeof body.repo !== 'string') return c.json({ error: 'repo 必须是字符串' }, 400);
    if (body.branch !== undefined && typeof body.branch !== 'string') return c.json({ error: 'branch 必须是字符串' }, 400);
    setGitPlatformConfig(platform, {
      repo: typeof body.repo === 'string' ? body.repo.trim() || undefined : undefined,
      branch: typeof body.branch === 'string' ? body.branch.trim() || undefined : undefined,
    });
    return c.json({ success: true });
  } catch (error) {
    return apiError(c, error);
  }
});

settingsRoutes.get('/network/proxy', (c) => {
  try {
    return c.json(getProxyConfig());
  } catch (error) {
    return apiError(c, error);
  }
});

settingsRoutes.post('/network/proxy', async (c) => {
  try {
    const body = await c.req.json<{ enabled?: unknown; url?: unknown }>();
    if (typeof body.enabled !== 'boolean') return c.json({ error: 'enabled 必须是布尔值' }, 400);
    if (body.url !== undefined && typeof body.url !== 'string') return c.json({ error: 'url 必须是字符串' }, 400);
    const url = typeof body.url === 'string' ? body.url.trim() : undefined;
    if (body.enabled && !url) return c.json({ error: '启用代理时必须提供 url' }, 400);
    if (url && !isHttpUrl(url)) return c.json({ error: '代理 url 必须是 http 或 https 地址' }, 400);
    setProxyConfig(body.enabled, url);
    resetProxyCache();
    return c.json({ success: true });
  } catch (error) {
    return apiError(c, error);
  }
});

function parsePlatform(value: string): GitPlatform {
  if (value === 'github' || value === 'gitee') return value;
  throw new ApiValidationError(`不支持的 Git 平台: ${value}`);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
