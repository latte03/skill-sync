/**
 * HTTP API 层单元测试
 */

import { describe, it, expect, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// 创建临时目录（在 mock 之前）
const tmpDir = path.join(os.tmpdir(), `skill-sync-test-${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });
fs.mkdirSync(path.join(tmpDir, 'skills'), { recursive: true });

// Mock getHomeDir — vi.mock 会被提升，所以需要用工厂函数内部引用
vi.mock('../../src/lib/paths.js', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getHomeDir: () => tmpDir,
  };
});

// 在 mock 之后导入 app
const { app } = await import('../../src/server/app.js');

describe('HTTP API', () => {
  it('GET /api/health 返回 ok', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.version).toBeDefined();
  });

  it('GET /api/status 返回全局状态', async () => {
    const res = await app.request('/api/status');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('homeDir');
    expect(data).toHaveProperty('skillCount');
    expect(data).toHaveProperty('managedCount');
    expect(data).toHaveProperty('unmanagedCount');
    expect(data).toHaveProperty('agents');
    expect(data).toHaveProperty('installedAgents');
  });

  it('GET /api/skills 返回 skill 列表', async () => {
    const res = await app.request('/api/skills');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('skills');
    expect(Array.isArray(data.skills)).toBe(true);
  });

  it('GET /api/agents 返回 Agent 列表', async () => {
    const res = await app.request('/api/agents');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('agents');
    expect(Array.isArray(data.agents)).toBe(true);

    // 至少有 claude-code
    const claude = data.agents.find((a: { name: string }) => a.name === 'claude-code');
    expect(claude).toBeDefined();
  });

  it('GET /api/search 缺少 q 参数返回 400', async () => {
    const res = await app.request('/api/search');
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain('q');
  });

  it('GET /api/search?scope=local&q=test 返回本地搜索结果', async () => {
    const res = await app.request('/api/search?q=test&scope=local');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('local');
    expect(data).toHaveProperty('remote');
    expect(Array.isArray(data.local)).toBe(true);
    expect(Array.isArray(data.remote)).toBe(true);
  });

  it('GET /api/tags 返回标签', async () => {
    const res = await app.request('/api/tags');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('tags');
  });

  it('GET /api/config 返回配置', async () => {
    const res = await app.request('/api/config');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('config');
  });

  it('GET /api/skill/detail?name=... 不存在的 skill 返回 404', async () => {
    const res = await app.request('/api/skill/detail?name=nonexistent/test');
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toContain('未找到');
  });

  it('GET /api/skill/detail 缺少 name 参数返回 400', async () => {
    const res = await app.request('/api/skill/detail');
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain('name');
  });
});
