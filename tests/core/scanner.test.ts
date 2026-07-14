/**
 * scanner 模块单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTestEnv, createMockSkillDir, createMockSkillMd, mockAgentSkillDir } from '../test-utils.js';
import { createTestContext } from '../../src/core/context.js';
import { scanAgentSkills, filterUnmanaged, filterManaged, groupBySkillName } from '../../src/core/scanner.js';
import { resetAgentsCache } from '../../src/lib/agents.js';

describe('scanner', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
    resetAgentsCache();
  });

  afterEach(() => {
    env.cleanup();
    resetAgentsCache();
  });

  describe('scanAgentSkills', () => {
    it('扫描空目录返回空数组', () => {
      mockAgentSkillDir(env.agentsDir, '.claude/skills');
      const ctx = createTestContext({ homeDir: env.homeDir });
      const result = scanAgentSkills(ctx, 'claude-code');
      expect(result).toEqual([]);
    });

    it('扫描不存在的目录返回空数组', () => {
      const ctx = createTestContext({ homeDir: env.homeDir });
      const result = scanAgentSkills(ctx, 'claude-code');
      expect(result).toEqual([]);
    });

    it('扫描包含 SKILL.md 的 skill 目录', () => {
      const skillDir = mockAgentSkillDir(env.agentsDir, '.claude/skills');
      createMockSkillDir(skillDir, 'my-skill', {
        name: 'my-skill',
        description: 'Test skill',
        version: '1.0.0',
      });

      const ctx = createTestContext({ homeDir: env.homeDir });
      const result = scanAgentSkills(ctx, 'claude-code');

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('my-skill');
      expect(result[0]!.description).toBe('Test skill');
      expect(result[0]!.agentName).toBe('claude-code');
      expect(result[0]!.isSymlink).toBe(false);
    });

    it('扫描多个 skill', () => {
      const skillDir = mockAgentSkillDir(env.agentsDir, '.claude/skills');
      createMockSkillDir(skillDir, 'skill-a', { name: 'skill-a' });
      createMockSkillDir(skillDir, 'skill-b', { name: 'skill-b' });

      const ctx = createTestContext({ homeDir: env.homeDir });
      const result = scanAgentSkills(ctx, 'claude-code');
      expect(result).toHaveLength(2);
    });

    it('跳过非目录文件', () => {
      const skillDir = mockAgentSkillDir(env.agentsDir, '.claude/skills');
      createMockSkillDir(skillDir, 'my-skill');
      // 放一个文件而非目录
      fs.writeFileSync(path.join(skillDir, 'not-a-skill.txt'), 'hello');

      const ctx = createTestContext({ homeDir: env.homeDir });
      const result = scanAgentSkills(ctx, 'claude-code');
      expect(result).toHaveLength(1);
    });

    it('无 SKILL.md 时使用目录名作为 skill 名', () => {
      const skillDir = mockAgentSkillDir(env.agentsDir, '.claude/skills');
      const skillPath = path.join(skillDir, 'no-frontmatter');
      fs.mkdirSync(skillPath, { recursive: true });
      fs.writeFileSync(path.join(skillPath, 'some-file.txt'), 'content');

      const ctx = createTestContext({ homeDir: env.homeDir });
      const result = scanAgentSkills(ctx, 'claude-code');
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('no-frontmatter');
      expect(result[0]!.description).toBeUndefined();
    });

    it('检测 symlink', () => {
      const skillDir = mockAgentSkillDir(env.agentsDir, '.claude/skills');
      const realDir = path.join(env.homeDir, 'real-skill');
      fs.mkdirSync(realDir, { recursive: true });
      createMockSkillMd(realDir, { name: 'linked-skill', description: 'A linked skill' });

      const linkPath = path.join(skillDir, 'linked-skill');
      fs.symlinkSync(realDir, linkPath, 'dir');

      const ctx = createTestContext({ homeDir: env.homeDir });
      const result = scanAgentSkills(ctx, 'claude-code');
      expect(result).toHaveLength(1);
      expect(result[0]!.isSymlink).toBe(true);
      expect(result[0]!.linkTarget).toBe(realDir);
    });
  });

  describe('filterUnmanaged / filterManaged', () => {
    it('过滤 unmanaged skill', () => {
      const skillDir = mockAgentSkillDir(env.agentsDir, '.claude/skills');

      // unmanaged: 普通目录
      createMockSkillDir(skillDir, 'unmanaged-skill', { name: 'unmanaged-skill' });

      // managed: symlink
      const realDir = path.join(env.homeDir, 'real');
      fs.mkdirSync(realDir, { recursive: true });
      createMockSkillMd(realDir, { name: 'managed-skill' });
      fs.symlinkSync(realDir, path.join(skillDir, 'managed-skill'), 'dir');

      const ctx = createTestContext({ homeDir: env.homeDir });
      const all = scanAgentSkills(ctx, 'claude-code');
      const unmanaged = filterUnmanaged(all);
      const managed = filterManaged(all);

      expect(unmanaged).toHaveLength(1);
      expect(unmanaged[0]!.name).toBe('unmanaged-skill');
      expect(managed).toHaveLength(1);
      expect(managed[0]!.name).toBe('managed-skill');
    });
  });

  describe('groupBySkillName', () => {
    it('按名称分组', () => {
      const skills = [
        { name: 'same-skill', agentName: 'claude-code', dir: '/a', skillMdPath: '/a/SKILL.md', isSymlink: false },
        { name: 'same-skill', agentName: 'cursor', dir: '/b', skillMdPath: '/b/SKILL.md', isSymlink: false },
        { name: 'other-skill', agentName: 'claude-code', dir: '/c', skillMdPath: '/c/SKILL.md', isSymlink: false },
      ];
      const grouped = groupBySkillName(skills as any);
      expect(grouped.size).toBe(2);
      expect(grouped.get('same-skill')).toHaveLength(2);
      expect(grouped.get('other-skill')).toHaveLength(1);
    });
  });
});
