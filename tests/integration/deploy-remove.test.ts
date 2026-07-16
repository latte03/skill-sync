/**
 * 集成测试：install → deploy → undeploy → remove 流程
 *
 * 使用本地 skill 模拟完整生命周期
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTestContext } from '../../src/core/context.js';
import { installLocalSkill } from '../../src/core/installer.js';
import {
  deploySkill,
  deploySkills,
  undeploySkill,
  undeploySkills,
  removeSkill,
  getSkillDetail,
  listSkills,
} from '../../src/core/skill-manager.js';
import { getAgentSkillDir } from '../../src/lib/agents.js';
import { getLockEntry } from '../../src/lib/lock.js';
import { readManifest } from '../../src/lib/manifest.js';
import { lockPath, manifestPath, skillRepoPath } from '../../src/lib/paths.js';
import { transactionLockPath } from '../../src/lib/persistence.js';
import { recoverManagedState } from '../../src/core/state-recovery.js';
import { setupTestEnv, cleanupTestEnv } from '../test-utils.js';

describe('install → deploy → undeploy → remove 生命周期', () => {
  let testDir: string;
  let agentsDir: string;

  beforeEach(() => {
    const env = setupTestEnv();
    testDir = env.tempDir;
    agentsDir = env.agentsDir;

    // 创建模拟 Agent 目录
    const claudeSkillDir = path.join(agentsDir, '.claude', 'skills');
    fs.mkdirSync(claudeSkillDir, { recursive: true });

    const cursorSkillDir = path.join(agentsDir, '.cursor', 'skills');
    fs.mkdirSync(cursorSkillDir, { recursive: true });

    // 创建测试 skill
    fs.mkdirSync(path.join(testDir, 'test-skill'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'test-skill', 'SKILL.md'),
      '---\nname: test-skill\nversion: 1.0.0\ndescription: Integration test skill\n---\n\n# Test Skill\n',
    );
    fs.writeFileSync(
      path.join(testDir, 'test-skill', 'helper.sh'),
      '#!/bin/bash\necho "helper"\n',
    );
  });

  afterEach(() => {
    cleanupTestEnv();
  });

  it('完整生命周期：install → deploy → list → undeploy → remove', () => {
    const ctx = createTestContext();

    // 1. Install（不分发）
    const installResult = installLocalSkill(ctx, path.join(testDir, 'test-skill'), {
      noDeploy: true,
      ignoreDeps: true,
    });
    expect(installResult.name).toBe('test-skill');
    expect(installResult.deployed).toEqual([]);

    // 2. Deploy to claude-code
    deploySkill(ctx, 'test-skill', 'claude-code', { force: true });

    // 验证分发
    const claudeSkillPath = path.join(getAgentSkillDir('claude-code'), 'test-skill');
    expect(fs.existsSync(claudeSkillPath)).toBe(true);

    // 验证 lock 中的 distribution
    const entry = getLockEntry('test-skill');
    expect(entry?.distribution['claude-code']).toBeDefined();
    expect(entry?.distribution['claude-code']?.managed).toBe(true);

    // 3. Deploy to cursor
    deploySkill(ctx, 'test-skill', 'cursor', { force: true });
    const cursorSkillPath = path.join(getAgentSkillDir('cursor'), 'test-skill');
    expect(fs.existsSync(cursorSkillPath)).toBe(true);

    // 4. List 验证
    const skills = listSkills(ctx);
    expect(skills.length).toBe(1);
    expect(skills[0]!.name).toBe('test-skill');
    expect(skills[0]!.agents).toContain('claude-code');
    expect(skills[0]!.agents).toContain('cursor');

    // 5. getSkillDetail 验证
    const detail = getSkillDetail(ctx, 'test-skill');
    expect(detail).not.toBeNull();
    expect(detail?.agents).toContain('claude-code');
    expect(detail?.agents).toContain('cursor');

    // 6. Undeploy from cursor
    undeploySkill(ctx, 'test-skill', 'cursor');

    // 验证 cursor 分发保留但标记 managed = false
    const entryAfterUndeploy = getLockEntry('test-skill');
    expect(entryAfterUndeploy?.distribution['cursor']).toBeDefined();
    expect(entryAfterUndeploy?.distribution['cursor']?.managed).toBe(false);
    expect(entryAfterUndeploy?.distribution['claude-code']).toBeDefined();
    expect(entryAfterUndeploy?.distribution['claude-code']?.managed).toBe(true);

    // 验证 cursor 目录下副本保留（不再是 symlink）
    expect(fs.existsSync(cursorSkillPath)).toBe(true);
    expect(fs.lstatSync(cursorSkillPath).isSymbolicLink()).toBe(false);

    // 7. Remove all
    removeSkill(ctx, 'test-skill', 'all');

    // 验证完全删除
    expect(getLockEntry('test-skill')).toBeNull();
    expect(getSkillDetail(ctx, 'test-skill')).toBeNull();

    // list 应该为空
    const skillsAfterRemove = listSkills(ctx);
    expect(skillsAfterRemove.length).toBe(0);
  });

  it.each([
    ['manifest', () => transactionLockPath(manifestPath('test-skill'))],
    ['lockfile', () => transactionLockPath(lockPath())],
  ])('deploy preflight leaves Agent and metadata unchanged when the %s lock is held', (_kind, getHeldLock) => {
    const ctx = createTestContext();
    installLocalSkill(ctx, path.join(testDir, 'test-skill'), { noDeploy: true, ignoreDeps: true });
    const destination = path.join(getAgentSkillDir('claude-code'), 'test-skill');
    const heldLock = getHeldLock();
    fs.writeFileSync(heldLock, 'other process');

    expect(() => deploySkill(ctx, 'test-skill', 'claude-code', { mode: 'copy' })).toThrow('状态文件正在被其他进程修改');

    expect(fs.existsSync(destination)).toBe(false);
    expect(getLockEntry('test-skill')?.distribution['claude-code']).toBeUndefined();
    expect(readManifest('test-skill').distribution.targets).toEqual([]);
  });

  it('undeploy keeps the Agent symlink and metadata unchanged when a state lock is held', () => {
    const ctx = createTestContext();
    installLocalSkill(ctx, path.join(testDir, 'test-skill'), { noDeploy: true, ignoreDeps: true });
    deploySkill(ctx, 'test-skill', 'claude-code', { force: true });
    const destination = path.join(getAgentSkillDir('claude-code'), 'test-skill');
    fs.writeFileSync(transactionLockPath(lockPath()), 'other process');

    expect(() => undeploySkill(ctx, 'test-skill', 'claude-code')).toThrow('状态文件正在被其他进程修改');

    expect(fs.lstatSync(destination).isSymbolicLink()).toBe(true);
    expect(getLockEntry('test-skill')?.distribution['claude-code']?.managed).toBe(true);
    expect(readManifest('test-skill').distribution.targets.find(target => target.agent === 'claude-code')?.managed).toBe(true);
  });

  it('deploy compensates the Agent target and manifest when the lock fails after manifest commit', () => {
    const ctx = createTestContext();
    installLocalSkill(ctx, path.join(testDir, 'test-skill'), { noDeploy: true, ignoreDeps: true });
    const destination = path.join(getAgentSkillDir('claude-code'), 'test-skill');
    const originalRename = fs.renameSync.bind(fs);
    let injected = false;
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      const result = originalRename(from, to);
      if (!injected && path.resolve(String(to)) === manifestPath('test-skill')) {
        injected = true;
        fs.writeFileSync(transactionLockPath(lockPath()), 'other process');
      }
      return result;
    });

    expect(() => deploySkill(ctx, 'test-skill', 'claude-code', { mode: 'copy' })).toThrow('状态文件正在被其他进程修改');
    renameSpy.mockRestore();

    expect(fs.existsSync(destination)).toBe(false);
    expect(getLockEntry('test-skill')?.distribution['claude-code']).toBeUndefined();
    expect(readManifest('test-skill').distribution.targets).toEqual([]);
  });

  it('batch deploy restores all Agent targets when a later replacement fails', () => {
    const ctx = createTestContext();
    installLocalSkill(ctx, path.join(testDir, 'test-skill'), { noDeploy: true, ignoreDeps: true });
    deploySkills(ctx, 'test-skill', ['claude-code', 'cursor'], { force: true });
    const claudeDestination = path.join(getAgentSkillDir('claude-code'), 'test-skill');
    const cursorDestination = path.join(getAgentSkillDir('cursor'), 'test-skill');
    const originalRename = fs.renameSync.bind(fs);
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (path.resolve(String(from)) === cursorDestination) throw new Error('injected cursor failure');
      return originalRename(from, to);
    });

    expect(() => deploySkills(ctx, 'test-skill', ['claude-code', 'cursor'], { mode: 'copy', force: true }))
      .toThrow('injected cursor failure');
    renameSpy.mockRestore();

    expect(fs.lstatSync(claudeDestination).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(cursorDestination).isSymbolicLink()).toBe(true);
    expect(getLockEntry('test-skill')?.distribution['claude-code']?.mode).toBe('symlink');
    expect(getLockEntry('test-skill')?.distribution.cursor?.mode).toBe('symlink');
    expect(readManifest('test-skill').distribution.targets.every(target => target.mode === 'symlink')).toBe(true);
  });

  it('batch undeploy restores every managed link when a later replacement fails', () => {
    const ctx = createTestContext();
    installLocalSkill(ctx, path.join(testDir, 'test-skill'), { noDeploy: true, ignoreDeps: true });
    deploySkills(ctx, 'test-skill', ['claude-code', 'cursor'], { force: true });
    const claudeDestination = path.join(getAgentSkillDir('claude-code'), 'test-skill');
    const cursorDestination = path.join(getAgentSkillDir('cursor'), 'test-skill');
    const originalRename = fs.renameSync.bind(fs);
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (path.resolve(String(from)) === cursorDestination) throw new Error('injected cursor failure');
      return originalRename(from, to);
    });

    expect(() => undeploySkills(ctx, 'test-skill', ['claude-code', 'cursor']))
      .toThrow('injected cursor failure');
    renameSpy.mockRestore();

    expect(fs.lstatSync(claudeDestination).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(cursorDestination).isSymbolicLink()).toBe(true);
    expect(getLockEntry('test-skill')?.distribution['claude-code']?.managed).toBe(true);
    expect(getLockEntry('test-skill')?.distribution.cursor?.managed).toBe(true);
    expect(readManifest('test-skill').distribution.targets.every(target => target.managed)).toBe(true);
  });

  it('remove --central 保留 Agent 副本', () => {
    const ctx = createTestContext();

    // Install + Deploy（使用 copy 模式，确保删除中央仓库后 Agent 副本仍可访问）
    installLocalSkill(ctx, path.join(testDir, 'test-skill'), {
      noDeploy: true,
      ignoreDeps: true,
    });
    deploySkill(ctx, 'test-skill', 'claude-code', { mode: 'copy', force: true });

    // Remove central only
    removeSkill(ctx, 'test-skill', 'central');

    // Agent 目录下文件应仍然存在（copy 模式下是独立副本）
    const claudeSkillPath = path.join(getAgentSkillDir('claude-code'), 'test-skill');
    expect(fs.existsSync(claudeSkillPath)).toBe(true);

    // Lock 应已删除
    expect(getLockEntry('test-skill')).toBeNull();
  });

  it('remove --central converts a managed symlink into a retained copy', () => {
    const ctx = createTestContext();

    installLocalSkill(ctx, path.join(testDir, 'test-skill'), {
      noDeploy: true,
      ignoreDeps: true,
    });
    deploySkill(ctx, 'test-skill', 'claude-code', { force: true });

    const claudeSkillPath = path.join(getAgentSkillDir('claude-code'), 'test-skill');
    expect(fs.lstatSync(claudeSkillPath).isSymbolicLink()).toBe(true);

    removeSkill(ctx, 'test-skill', 'central');

    expect(fs.existsSync(path.join(claudeSkillPath, 'SKILL.md'))).toBe(true);
    expect(fs.lstatSync(claudeSkillPath).isSymbolicLink()).toBe(false);
  });

  it('remove --central leaves the central repo and Agent link intact when a state lock is held', () => {
    const ctx = createTestContext();
    installLocalSkill(ctx, path.join(testDir, 'test-skill'), { noDeploy: true, ignoreDeps: true });
    deploySkill(ctx, 'test-skill', 'claude-code', { force: true });
    const destination = path.join(getAgentSkillDir('claude-code'), 'test-skill');
    fs.writeFileSync(transactionLockPath(lockPath()), 'other process');

    expect(() => removeSkill(ctx, 'test-skill', 'central')).toThrow('状态文件正在被其他进程修改');

    expect(fs.existsSync(skillRepoPath('test-skill'))).toBe(true);
    expect(fs.lstatSync(destination).isSymbolicLink()).toBe(true);
    expect(getLockEntry('test-skill')).not.toBeNull();
  });

  it('remove --all restores every target if the lock fails after paths are moved aside', () => {
    const ctx = createTestContext();
    installLocalSkill(ctx, path.join(testDir, 'test-skill'), { noDeploy: true, ignoreDeps: true });
    deploySkill(ctx, 'test-skill', 'claude-code', { force: true });
    deploySkill(ctx, 'test-skill', 'cursor', { force: true });
    const repo = skillRepoPath('test-skill');
    const claudeDestination = path.join(getAgentSkillDir('claude-code'), 'test-skill');
    const cursorDestination = path.join(getAgentSkillDir('cursor'), 'test-skill');
    const originalRename = fs.renameSync.bind(fs);
    let injected = false;
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      const result = originalRename(from, to);
      if (!injected && path.resolve(String(from)) === repo) {
        injected = true;
        fs.writeFileSync(transactionLockPath(lockPath()), 'other process');
      }
      return result;
    });

    expect(() => removeSkill(ctx, 'test-skill', 'all')).toThrow('状态文件正在被其他进程修改');
    renameSpy.mockRestore();

    expect(fs.existsSync(repo)).toBe(true);
    expect(fs.lstatSync(claudeDestination).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(cursorDestination).isSymbolicLink()).toBe(true);
    expect(getLockEntry('test-skill')).not.toBeNull();
  });

  it('remove --agent 仅从指定 Agent 移除', () => {
    const ctx = createTestContext();

    // Install + Deploy to two agents
    installLocalSkill(ctx, path.join(testDir, 'test-skill'), {
      noDeploy: true,
      ignoreDeps: true,
    });
    deploySkill(ctx, 'test-skill', 'claude-code', { force: true });
    deploySkill(ctx, 'test-skill', 'cursor', { force: true });

    // Remove from cursor only
    removeSkill(ctx, 'test-skill', 'agent', 'cursor');

    // claude-code 分发应保留
    const entry = getLockEntry('test-skill');
    expect(entry?.distribution['claude-code']).toBeDefined();
    expect(entry?.distribution['cursor']).toBeUndefined();

    // 中央仓库应保留
    expect(getSkillDetail(ctx, 'test-skill')).not.toBeNull();
  });

  it('remove --agent leaves the Agent target and metadata unchanged when a state lock is held', () => {
    const ctx = createTestContext();
    installLocalSkill(ctx, path.join(testDir, 'test-skill'), { noDeploy: true, ignoreDeps: true });
    deploySkill(ctx, 'test-skill', 'cursor', { force: true });
    const destination = path.join(getAgentSkillDir('cursor'), 'test-skill');
    fs.writeFileSync(transactionLockPath(lockPath()), 'other process');

    expect(() => removeSkill(ctx, 'test-skill', 'agent', 'cursor')).toThrow('状态文件正在被其他进程修改');

    expect(fs.lstatSync(destination).isSymbolicLink()).toBe(true);
    expect(getLockEntry('test-skill')?.distribution.cursor).toBeDefined();
    expect(readManifest('test-skill').distribution.targets.find(target => target.agent === 'cursor')).toBeDefined();
  });

  it('remove --agent recovers after manifest commit when lock commit is interrupted', () => {
    const ctx = createTestContext();
    installLocalSkill(ctx, path.join(testDir, 'test-skill'), { noDeploy: true, ignoreDeps: true });
    deploySkill(ctx, 'test-skill', 'cursor', { force: true });
    const destination = path.join(getAgentSkillDir('cursor'), 'test-skill');
    const originalRename = fs.renameSync.bind(fs);
    let injected = false;
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      const result = originalRename(from, to);
      if (!injected && path.resolve(String(to)) === manifestPath('test-skill')) {
        injected = true;
        fs.writeFileSync(transactionLockPath(lockPath()), 'interrupted remove');
      }
      return result;
    });

    expect(() => removeSkill(ctx, 'test-skill', 'agent', 'cursor'))
      .toThrow('状态文件正在被其他进程修改');
    renameSpy.mockRestore();
    fs.rmSync(transactionLockPath(lockPath()), { force: true });

    expect(recoverManagedState()).toEqual({ restored: 1, cleaned: 0 });
    expect(fs.lstatSync(destination).isSymbolicLink()).toBe(true);
    expect(getLockEntry('test-skill')?.distribution.cursor).toBeDefined();
    expect(readManifest('test-skill').distribution.targets.find(target => target.agent === 'cursor')).toBeDefined();
  });

  it('deploy with copy mode', () => {
    const ctx = createTestContext();

    installLocalSkill(ctx, path.join(testDir, 'test-skill'), {
      noDeploy: true,
      ignoreDeps: true,
    });

    deploySkill(ctx, 'test-skill', 'claude-code', { mode: 'copy', force: true });

    const claudeSkillPath = path.join(getAgentSkillDir('claude-code'), 'test-skill');
    expect(fs.existsSync(claudeSkillPath)).toBe(true);

    // copy 模式下应该是普通目录而非 symlink
    const stats = fs.lstatSync(claudeSkillPath);
    expect(stats.isSymbolicLink()).toBe(false);
    expect(stats.isDirectory()).toBe(true);
  });
});
