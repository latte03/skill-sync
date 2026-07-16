/**
 * 集成测试：install → deploy → undeploy → remove 流程
 *
 * 使用本地 skill 模拟完整生命周期
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTestContext } from '../../src/core/context.js';
import { installLocalSkill } from '../../src/core/installer.js';
import {
  deploySkill,
  undeploySkill,
  removeSkill,
  getSkillDetail,
  listSkills,
} from '../../src/core/skill-manager.js';
import { getAgentSkillDir } from '../../src/lib/agents.js';
import { getLockEntry } from '../../src/lib/lock.js';
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
