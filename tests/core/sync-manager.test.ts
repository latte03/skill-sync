/**
 * sync-manager.ts 单元测试
 *
 * 测试 Git 同步核心逻辑（在隔离环境中使用真实 Git）
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTestContext } from '../../src/core/context.js';
import { isGitInitialized, initGit, getSyncStatus, pushSync } from '../../src/core/sync-manager.js';
import { getHomeDir } from '../../src/lib/paths.js';
import { setupTestEnv, cleanupTestEnv } from '../test-utils.js';

describe('sync-manager', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(() => {
    cleanupTestEnv();
  });

  it('isGitInitialized 未初始化时返回 false', () => {
    expect(isGitInitialized()).toBe(false);
  });

  it('initGit 初始化 Git 仓库', async () => {
    const ctx = createTestContext();
    await initGit(ctx);
    expect(isGitInitialized()).toBe(true);
    expect(fs.existsSync(path.join(getHomeDir(), '.git'))).toBe(true);
  });

  it('isGitInitialized 初始化后返回 true', async () => {
    const ctx = createTestContext();
    await initGit(ctx);
    expect(isGitInitialized()).toBe(true);
  });

  it('getSyncStatus 未初始化时返回 isRepo=false', async () => {
    const ctx = createTestContext();
    const status = await getSyncStatus(ctx);
    expect(status.isRepo).toBe(false);
  });

  it('getSyncStatus 初始化后返回 isRepo=true', async () => {
    const ctx = createTestContext();
    await initGit(ctx);
    const status = await getSyncStatus(ctx);
    expect(status.isRepo).toBe(true);
    expect(status.hasRemote).toBe(false);
    expect(status.uncommittedChanges).toBe(0);
  });

  it('pushSync 未初始化时返回失败', async () => {
    const ctx = createTestContext();
    const result = await pushSync(ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('未初始化');
  });

  it('pushSync 无变更时返回 pushed=0', async () => {
    const ctx = createTestContext();
    await initGit(ctx);
    const result = await pushSync(ctx);
    expect(result.success).toBe(true);
    expect(result.pushed).toBe(0);
  });

  it('pushSync 有变更时提交并推送', async () => {
    const ctx = createTestContext();
    await initGit(ctx);

    // 创建一些文件
    fs.writeFileSync(path.join(getHomeDir(), 'test.txt'), 'hello');

    const result = await pushSync(ctx, { message: 'test commit' });
    expect(result.success).toBe(true);
    expect(result.pushed).toBe(1);
  });

  it('pushSync dry-run 不实际提交', async () => {
    const ctx = createTestContext();
    await initGit(ctx);

    fs.writeFileSync(path.join(getHomeDir(), 'test.txt'), 'hello');

    const result = await pushSync(ctx, { message: 'test', dryRun: true });
    expect(result.success).toBe(true);
  });

  it('getSyncStatus 检测未提交变更', async () => {
    const ctx = createTestContext();
    await initGit(ctx);

    // 创建未跟踪文件
    fs.writeFileSync(path.join(getHomeDir(), 'untracked.txt'), 'test');

    const status = await getSyncStatus(ctx);
    expect(status.isRepo).toBe(true);
    expect(status.uncommittedChanges).toBeGreaterThan(0);
  });
});
