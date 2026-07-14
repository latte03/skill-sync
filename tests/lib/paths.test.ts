/**
 * paths 模块单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import {
  getHomeDir,
  getAgentsBaseDir,
  configPath,
  secretsPath,
  lockPath,
  skillsDirPath,
  skillRepoPath,
  manifestPath,
  skillMdPath,
  agentSkillDirPath,
} from '../../src/lib/paths.js';

describe('paths', () => {
  const origHome = process.env.SKILL_SYNC_HOME;
  const origAgents = process.env.SKILL_SYNC_AGENTS_DIR;

  afterEach(() => {
    delete process.env.SKILL_SYNC_HOME;
    delete process.env.SKILL_SYNC_AGENTS_DIR;
    if (origHome) process.env.SKILL_SYNC_HOME = origHome;
    if (origAgents) process.env.SKILL_SYNC_AGENTS_DIR = origAgents;
  });

  describe('getHomeDir', () => {
    it('默认返回 ~/.skill-sync', () => {
      delete process.env.SKILL_SYNC_HOME;
      const expected = path.join(os.homedir(), '.skill-sync');
      expect(getHomeDir()).toBe(expected);
    });

    it('受 SKILL_SYNC_HOME 环境变量覆盖', () => {
      process.env.SKILL_SYNC_HOME = '/tmp/test-home';
      expect(getHomeDir()).toBe('/tmp/test-home');
    });

    it('解析相对路径', () => {
      process.env.SKILL_SYNC_HOME = './relative-home';
      const result = getHomeDir();
      expect(path.isAbsolute(result)).toBe(true);
    });
  });

  describe('getAgentsBaseDir', () => {
    it('默认返回 home 目录', () => {
      delete process.env.SKILL_SYNC_AGENTS_DIR;
      expect(getAgentsBaseDir()).toBe(os.homedir());
    });

    it('受 SKILL_SYNC_AGENTS_DIR 环境变量覆盖', () => {
      process.env.SKILL_SYNC_AGENTS_DIR = '/tmp/test-agents';
      expect(getAgentsBaseDir()).toBe('/tmp/test-agents');
    });
  });

  describe('路径构建函数', () => {
    beforeEach(() => {
      process.env.SKILL_SYNC_HOME = '/tmp/skill-sync-test';
    });

    it('configPath', () => {
      expect(configPath()).toBe(path.join('/tmp/skill-sync-test', 'config.yaml'));
    });

    it('secretsPath', () => {
      expect(secretsPath()).toBe(path.join('/tmp/skill-sync-test', 'secrets.yaml'));
    });

    it('lockPath', () => {
      expect(lockPath()).toBe(path.join('/tmp/skill-sync-test', 'skills-lock.json'));
    });

    it('skillsDirPath', () => {
      expect(skillsDirPath()).toBe(path.join('/tmp/skill-sync-test', 'skills'));
    });

    it('skillRepoPath', () => {
      expect(skillRepoPath('anthropics', 'pdf')).toBe(
        path.join('/tmp/skill-sync-test', 'skills', 'anthropics', 'pdf'),
      );
    });

    it('manifestPath', () => {
      expect(manifestPath('anthropics', 'pdf')).toBe(
        path.join('/tmp/skill-sync-test', 'skills', 'anthropics', 'pdf', 'manifest.yaml'),
      );
    });

    it('skillMdPath', () => {
      expect(skillMdPath('anthropics', 'pdf')).toBe(
        path.join('/tmp/skill-sync-test', 'skills', 'anthropics', 'pdf', 'SKILL.md'),
      );
    });
  });

  describe('agentSkillDirPath', () => {
    it('默认拼接 Agent 相对路径到 home', () => {
      delete process.env.SKILL_SYNC_AGENTS_DIR;
      const result = agentSkillDirPath('.claude/skills');
      expect(result).toBe(path.join(os.homedir(), '.claude/skills'));
    });

    it('受 SKILL_SYNC_AGENTS_DIR 覆盖', () => {
      process.env.SKILL_SYNC_AGENTS_DIR = '/tmp/test-agents';
      expect(agentSkillDirPath('.claude/skills')).toBe(
        path.join('/tmp/test-agents', '.claude/skills'),
      );
    });

    it('绝对路径直接返回', () => {
      expect(agentSkillDirPath('/custom/path')).toBe('/custom/path');
    });
  });
});
