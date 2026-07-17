/**
 * HTTP API 层单元测试
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
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
const { beginRemovalJournal } = await import('../../src/core/distribution-transaction.js');
const { setLockEntry, removeLockEntry } = await import('../../src/lib/lock.js');
const { homePath } = await import('../../src/lib/paths.js');
const { transactionLockPath } = await import('../../src/lib/persistence.js');
const { readSecrets } = await import('../../src/config.js');

describe('HTTP API', () => {
  beforeEach(() => {
    process.env.SKILL_SYNC_HOME = tmpDir;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(tmpDir, 'skills'), { recursive: true });
  });

  afterEach(() => {
    delete process.env.SKILL_SYNC_HOME;
  });

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

  it('serves Git platform settings and keeps the active platform exclusive', async () => {
    const initial = await app.request('/api/git/platforms');
    expect(initial.status).toBe(200);
    expect((await initial.json()).platforms).toHaveLength(2);

    const github = await app.request('/api/git/platforms/github/enable', {
      method: 'POST',
      body: JSON.stringify({ enabled: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(github.status).toBe(200);
    expect((await github.json()).active).toBe('github');

    const gitee = await app.request('/api/git/platforms/gitee/enable', {
      method: 'POST',
      body: JSON.stringify({ enabled: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(gitee.status).toBe(200);
    expect((await gitee.json()).active).toBe('gitee');

    const invalid = await app.request('/api/git/platforms/gitlab/enable', {
      method: 'POST',
      body: JSON.stringify({ enabled: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('stores platform tokens in secrets and validates proxy settings', async () => {
    const token = await app.request('/api/git/platforms/github/token', {
      method: 'POST',
      body: JSON.stringify({ token: 'test-token' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(token.status).toBe(200);
    expect(readSecrets().GITHUB_TOKEN).toBe('test-token');

    const invalid = await app.request('/api/network/proxy', {
      method: 'POST',
      body: JSON.stringify({ enabled: true, url: 'not-a-url' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(invalid.status).toBe(400);

    const saved = await app.request('/api/network/proxy', {
      method: 'POST',
      body: JSON.stringify({ enabled: true, url: 'http://127.0.0.1:7890' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(saved.status).toBe(200);
    const loaded = await app.request('/api/network/proxy');
    expect(await loaded.json()).toMatchObject({ enabled: true, url: 'http://127.0.0.1:7890' });
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

  it('validates the new single-Skill update and source association API boundaries', async () => {
    const missingName = await app.request('/api/skill/update');
    expect(missingName.status).toBe(400);
    expect(await missingName.json()).toMatchObject({ code: 'INVALID_REQUEST' });

    const invalidAssociation = await app.request('/api/skill/source-association?name=local%2Ftest', {
      method: 'POST',
      body: JSON.stringify({ source: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(invalidAssociation.status).toBe(400);
    expect(await invalidAssociation.json()).toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('POST /api/skill/deploy uses an opaque name query parameter', async () => {
    const res = await app.request('/api/skill/deploy?name=anthropics%2Fskills%2Fskills%2Fpdf&agents=claude-code', {
      method: 'POST',
    });

    expect(res.status).not.toBe(404);
    expect(res.status).toBe(500);
  });

  it('recovers an interrupted deletion before serving an embedded API request', async () => {
    const destination = path.join(tmpDir, 'agent-skill');
    const previous = path.join(tmpDir, '.agent-skill.distribution-previous-crash');
    fs.mkdirSync(destination);
    fs.writeFileSync(path.join(destination, 'SKILL.md'), 'original');
    setLockEntry('local/test', {
      source: { type: 'local' },
      version: '1.0.0',
      installedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      distribution: {},
    });
    const journal = beginRemovalJournal('local/test');
    journal.prepareMove(destination, previous);
    fs.renameSync(destination, previous);

    const res = await app.request('/api/skill/deploy?name=local%2Ftest&agents=claude-code', {
      method: 'POST',
    });

    // The intentionally incomplete test skill fails deployment after recovery.
    expect(res.status).toBe(500);
    expect(fs.readFileSync(path.join(destination, 'SKILL.md'), 'utf-8')).toBe('original');
    expect(fs.existsSync(previous)).toBe(false);
    removeLockEntry('local/test');
  });

  it.each([
    ['/api/skill/deploy?name=local%2Ftest&agents=claude-code', { method: 'POST' }],
    ['/api/skill/undeploy?name=local%2Ftest&agents=claude-code', { method: 'POST' }],
    ['/api/skill?name=local%2Ftest&scope=all', { method: 'DELETE' }],
  ])('returns 409 STATE_LOCKED for a conflicting write: %s', async (url, init) => {
    const lockFile = transactionLockPath(homePath('.state'));
    fs.writeFileSync(lockFile, `${process.pid}:active-api-test`);

    const res = await app.request(url, init);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data).toMatchObject({ code: 'STATE_LOCKED' });
    expect(fs.existsSync(lockFile)).toBe(true);
  });
});
