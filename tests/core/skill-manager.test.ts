/**
 * skill-manager 模块单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTestEnv, createMockSkillDir, mockAgentSkillDir } from '../test-utils.js';
import { createTestContext } from '../../src/core/context.js';
import {
  resolveDeployMode,
  createLink,
  removeLink,
  computeSourceHash,
  importSkill,
  listSkills,
  deploySkill,
  undeploySkill,
  removeSkill,
} from '../../src/core/skill-manager.js';
import { resetAgentsCache } from '../../src/lib/agents.js';
import { getLockEntry, hasLockEntry } from '../../src/lib/lock.js';
import { manifestExists, readManifest } from '../../src/lib/manifest.js';

describe('skill-manager', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
    resetAgentsCache();
  });

  afterEach(() => {
    env.cleanup();
    resetAgentsCache();
  });

  describe('resolveDeployMode', () => {
    it('copy 模式始终返回 copy', () => {
      expect(resolveDeployMode('copy')).toBe('copy');
    });

    it('undefined 在非 Windows 返回 symlink', () => {
      // 测试运行在 macOS/Linux 上
      if (process.platform !== 'win32') {
        expect(resolveDeployMode(undefined)).toBe('symlink');
      }
    });

    it('symlink 在非 Windows 返回 symlink', () => {
      if (process.platform !== 'win32') {
        expect(resolveDeployMode('symlink')).toBe('symlink');
      }
    });
  });

  describe('createLink / removeLink', () => {
    it('创建 symlink 并删除', () => {
      const src = path.join(env.homeDir, 'source');
      const dest = path.join(env.homeDir, 'dest');
      fs.mkdirSync(src, { recursive: true });
      fs.writeFileSync(path.join(src, 'test.txt'), 'hello');

      createLink(src, dest, 'symlink');

      expect(fs.existsSync(dest)).toBe(true);
      expect(fs.lstatSync(dest).isSymbolicLink()).toBe(true);

      removeLink(dest);
      expect(fs.existsSync(dest)).toBe(false);
    });

    it('创建 copy 并删除', () => {
      const src = path.join(env.homeDir, 'source');
      const dest = path.join(env.homeDir, 'dest');
      fs.mkdirSync(src, { recursive: true });
      fs.writeFileSync(path.join(src, 'test.txt'), 'hello');

      createLink(src, dest, 'copy');

      expect(fs.existsSync(dest)).toBe(true);
      expect(fs.lstatSync(dest).isDirectory()).toBe(true);
      expect(fs.readFileSync(path.join(dest, 'test.txt'), 'utf-8')).toBe('hello');

      removeLink(dest);
      expect(fs.existsSync(dest)).toBe(false);
    });

    it('force 覆盖已存在的目标', () => {
      const src = path.join(env.homeDir, 'source');
      const dest = path.join(env.homeDir, 'dest');
      fs.mkdirSync(src, { recursive: true });
      fs.writeFileSync(path.join(src, 'test.txt'), 'new');

      // 创建已存在的 dest
      fs.mkdirSync(dest, { recursive: true });
      fs.writeFileSync(path.join(dest, 'old.txt'), 'old');

      createLink(src, dest, 'copy');
      expect(fs.existsSync(path.join(dest, 'test.txt'))).toBe(true);
      expect(fs.existsSync(path.join(dest, 'old.txt'))).toBe(false);
    });
  });

  describe('computeSourceHash', () => {
    it('相同内容产生相同哈希', () => {
      const dir1 = path.join(env.homeDir, 'dir1');
      const dir2 = path.join(env.homeDir, 'dir2');
      fs.mkdirSync(dir1, { recursive: true });
      fs.mkdirSync(dir2, { recursive: true });
      fs.writeFileSync(path.join(dir1, 'file.txt'), 'same content');
      fs.writeFileSync(path.join(dir2, 'file.txt'), 'same content');

      expect(computeSourceHash(dir1)).toBe(computeSourceHash(dir2));
    });

    it('不同内容产生不同哈希', () => {
      const dir1 = path.join(env.homeDir, 'dir1');
      const dir2 = path.join(env.homeDir, 'dir2');
      fs.mkdirSync(dir1, { recursive: true });
      fs.mkdirSync(dir2, { recursive: true });
      fs.writeFileSync(path.join(dir1, 'file.txt'), 'content A');
      fs.writeFileSync(path.join(dir2, 'file.txt'), 'content B');

      expect(computeSourceHash(dir1)).not.toBe(computeSourceHash(dir2));
    });

    it('排除 .backup 目录', () => {
      const dir = path.join(env.homeDir, 'skill');
      fs.mkdirSync(path.join(dir, '.backup'), { recursive: true });
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'file.txt'), 'content');
      fs.writeFileSync(path.join(dir, '.backup', 'backup.txt'), 'backup');

      const hash1 = computeSourceHash(dir);

      // 修改 backup 内容，哈希不应变化
      fs.writeFileSync(path.join(dir, '.backup', 'backup.txt'), 'changed');
      const hash2 = computeSourceHash(dir);

      expect(hash1).toBe(hash2);
    });
  });

  describe('importSkill', () => {
    it('导入散落 skill 到中央仓库', () => {
      const skillDir = mockAgentSkillDir(env.agentsDir, '.claude/skills');
      const scanned = {
        name: 'test-skill',
        dir: createMockSkillDir(skillDir, 'test-skill', {
          name: 'test-skill',
          description: 'A test skill',
          version: '1.0.0',
        }),
        skillMdPath: path.join(skillDir, 'test-skill', 'SKILL.md'),
        agentName: 'claude-code',
        isSymlink: false,
      };

      const ctx = createTestContext({ homeDir: env.homeDir });
      const result = importSkill(ctx, scanned);

      expect(result.name).toBe('test-skill');
      expect(result.version).toBe('1.0.0');

      // 验证 manifest 存在
      expect(manifestExists('test-skill')).toBe(true);

      // 验证 lock 存在
      expect(hasLockEntry('test-skill')).toBe(true);

      // 验证文件已复制
      const repoPath = path.join(env.homeDir, 'skills', 'test-skill');
      expect(fs.existsSync(path.join(repoPath, 'SKILL.md'))).toBe(true);
    });

    it('导入并替换为 symlink', () => {
      const skillDir = mockAgentSkillDir(env.agentsDir, '.claude/skills');
      const skillPath = createMockSkillDir(skillDir, 'test-skill', {
        name: 'test-skill',
        version: '1.0.0',
      });

      const scanned = {
        name: 'test-skill',
        dir: skillPath,
        skillMdPath: path.join(skillPath, 'SKILL.md'),
        agentName: 'claude-code',
        isSymlink: false,
      };

      const ctx = createTestContext({ homeDir: env.homeDir });
      const result = importSkill(ctx, scanned, { replaceWithLink: true });

      expect(result.deployed).toContain('claude-code');

      // 验证原位置现在是 symlink
      expect(fs.lstatSync(skillPath).isSymbolicLink()).toBe(true);
    });

    it('dry-run 不实际操作', () => {
      const skillDir = mockAgentSkillDir(env.agentsDir, '.claude/skills');
      const scanned = {
        name: 'test-skill',
        dir: createMockSkillDir(skillDir, 'test-skill'),
        skillMdPath: path.join(skillDir, 'test-skill', 'SKILL.md'),
        agentName: 'claude-code',
        isSymlink: false,
      };

      const ctx = createTestContext({ homeDir: env.homeDir, dryRun: true });
      const result = importSkill(ctx, scanned);

      expect(result.name).toBe('test-skill');
      // 不应创建 manifest
      expect(manifestExists('test-skill')).toBe(false);
    });
  });

  describe('listSkills', () => {
    it('空 lock 返回空数组', () => {
      const ctx = createTestContext({ homeDir: env.homeDir });
      const skills = listSkills(ctx);
      expect(skills).toEqual([]);
    });

    it('返回 lock 中的 skill', () => {
      // 先导入一个 skill
      const skillDir = mockAgentSkillDir(env.agentsDir, '.claude/skills');
      const scanned = {
        name: 'test-skill',
        dir: createMockSkillDir(skillDir, 'test-skill', { version: '2.0.0' }),
        skillMdPath: path.join(skillDir, 'test-skill', 'SKILL.md'),
        agentName: 'claude-code',
        isSymlink: false,
      };

      const ctx = createTestContext({ homeDir: env.homeDir });
      importSkill(ctx, scanned);

      const skills = listSkills(ctx);
      expect(skills).toHaveLength(1);
      expect(skills[0]!.name).toBe('test-skill');
      expect(skills[0]!.version).toBe('2.0.0');
      expect(skills[0]!.managed).toBe(true);
    });
  });

  describe('deploySkill / undeploySkill', () => {
    it('分发 skill 到 Agent', () => {
      // 先导入
      const agentDir = mockAgentSkillDir(env.agentsDir, '.claude/skills');
      const scanned = {
        name: 'test-skill',
        dir: createMockSkillDir(agentDir, 'test-skill', { version: '1.0.0' }),
        skillMdPath: path.join(agentDir, 'test-skill', 'SKILL.md'),
        agentName: 'claude-code',
        isSymlink: false,
      };

      const ctx = createTestContext({ homeDir: env.homeDir });
      importSkill(ctx, scanned);

      // 先删除原位置的散落文件
      fs.rmSync(path.join(agentDir, 'test-skill'), { recursive: true, force: true });

      // 分发
      deploySkill(ctx, 'test-skill', 'cursor');

      const cursorSkillDir = path.join(env.agentsDir, '.cursor', 'skills', 'test-skill');
      expect(fs.existsSync(cursorSkillDir)).toBe(true);
      expect(fs.lstatSync(cursorSkillDir).isSymbolicLink()).toBe(true);

      // 验证 lock 更新
      const entry = getLockEntry('test-skill');
      expect(entry!.distribution['cursor']).toBeDefined();
    });

    it('取消分发（symlink 模式：解除链接并复制副本，标记 managed=false）', () => {
      // 先导入并分发
      const agentDir = mockAgentSkillDir(env.agentsDir, '.claude/skills');
      const scanned = {
        name: 'test-skill',
        dir: createMockSkillDir(agentDir, 'test-skill'),
        skillMdPath: path.join(agentDir, 'test-skill', 'SKILL.md'),
        agentName: 'claude-code',
        isSymlink: false,
      };

      const ctx = createTestContext({ homeDir: env.homeDir });
      importSkill(ctx, scanned, { replaceWithLink: true });

      // 取消分发
      undeploySkill(ctx, 'test-skill', 'claude-code');

      const skillPath = path.join(env.agentsDir, '.claude', 'skills', 'test-skill');
      // 副本应保留（不再是 symlink，而是真实目录）
      expect(fs.existsSync(skillPath)).toBe(true);
      expect(fs.lstatSync(skillPath).isSymbolicLink()).toBe(false);
      expect(fs.lstatSync(skillPath).isDirectory()).toBe(true);
      // 副本中应有 SKILL.md
      expect(fs.existsSync(path.join(skillPath, 'SKILL.md'))).toBe(true);

      // 验证 lock 更新：distribution 条目保留，managed = false
      const entry = getLockEntry('test-skill');
      expect(entry!.distribution['claude-code']).toBeDefined();
      expect(entry!.distribution['claude-code']?.managed).toBe(false);
    });

    it('拒绝覆盖被手动修改的受管 copy 分发', () => {
      const agentDir = mockAgentSkillDir(env.agentsDir, '.claude/skills');
      const scanned = {
        name: 'test-skill',
        dir: createMockSkillDir(agentDir, 'test-skill'),
        skillMdPath: path.join(agentDir, 'test-skill', 'SKILL.md'),
        agentName: 'claude-code',
        isSymlink: false,
      };

      const ctx = createTestContext({ homeDir: env.homeDir });
      importSkill(ctx, scanned);
      deploySkill(ctx, 'test-skill', 'cursor', { mode: 'copy' });

      const copyPath = path.join(env.agentsDir, '.cursor', 'skills', 'test-skill', 'SKILL.md');
      fs.appendFileSync(copyPath, '\nmanual change');

      expect(() => deploySkill(ctx, 'test-skill', 'cursor', { mode: 'copy' })).toThrow('手动修改');
    });

    it('取消分发不会覆盖手动替换掉 symlink 的目录', () => {
      const agentDir = mockAgentSkillDir(env.agentsDir, '.claude/skills');
      const skillPath = createMockSkillDir(agentDir, 'test-skill');
      const scanned = {
        name: 'test-skill',
        dir: skillPath,
        skillMdPath: path.join(skillPath, 'SKILL.md'),
        agentName: 'claude-code',
        isSymlink: false,
      };

      const ctx = createTestContext({ homeDir: env.homeDir });
      importSkill(ctx, scanned, { replaceWithLink: true });
      fs.rmSync(skillPath, { recursive: true, force: true });
      fs.mkdirSync(skillPath, { recursive: true });
      fs.writeFileSync(path.join(skillPath, 'manual.txt'), 'keep me');

      undeploySkill(ctx, 'test-skill', 'claude-code');

      expect(fs.readFileSync(path.join(skillPath, 'manual.txt'), 'utf-8')).toBe('keep me');
    });
  });

  describe('removeSkill', () => {
    it('all 模式删除中央仓库和所有分发', () => {
      const agentDir = mockAgentSkillDir(env.agentsDir, '.claude/skills');
      const scanned = {
        name: 'test-skill',
        dir: createMockSkillDir(agentDir, 'test-skill'),
        skillMdPath: path.join(agentDir, 'test-skill', 'SKILL.md'),
        agentName: 'claude-code',
        isSymlink: false,
      };

      const ctx = createTestContext({ homeDir: env.homeDir });
      importSkill(ctx, scanned, { replaceWithLink: true });

      removeSkill(ctx, 'test-skill', 'all');

      // 中央仓库删除
      expect(hasLockEntry('test-skill')).toBe(false);
      expect(manifestExists('test-skill')).toBe(false);

      // Agent 目录删除
      const skillPath = path.join(env.agentsDir, '.claude', 'skills', 'test-skill');
      expect(fs.existsSync(skillPath)).toBe(false);

      // 中央仓库 skill 目录删除（SkillKey 直接映射为目录层级）
      const repoPath = path.join(env.homeDir, 'skills', 'test-skill');
      expect(fs.existsSync(repoPath)).toBe(false);
    });

    it('agent 模式仅取消分发', () => {
      const agentDir = mockAgentSkillDir(env.agentsDir, '.claude/skills');
      const scanned = {
        name: 'test-skill',
        dir: createMockSkillDir(agentDir, 'test-skill'),
        skillMdPath: path.join(agentDir, 'test-skill', 'SKILL.md'),
        agentName: 'claude-code',
        isSymlink: false,
      };

      const ctx = createTestContext({ homeDir: env.homeDir });
      importSkill(ctx, scanned, { replaceWithLink: true });

      removeSkill(ctx, 'test-skill', 'agent', 'claude-code');

      // 中央仓库仍存在
      expect(hasLockEntry('test-skill')).toBe(true);
      expect(manifestExists('test-skill')).toBe(true);

      // Agent 目录已删除
      const skillPath = path.join(env.agentsDir, '.claude', 'skills', 'test-skill');
      expect(fs.existsSync(skillPath)).toBe(false);
    });
  });
});
