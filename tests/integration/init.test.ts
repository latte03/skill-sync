/**
 * init 命令集成测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTestEnv } from '../test-utils.js';
import { initCommand } from '../../src/commands/init.js';
import { resetAgentsCache } from '../../src/lib/agents.js';
import { configPath, secretsPath, lockPath, skillsDirPath } from '../../src/lib/paths.js';
import { readLock } from '../../src/lib/lock.js';

describe('init command (integration)', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
    resetAgentsCache();
  });

  afterEach(() => {
    env.cleanup();
    resetAgentsCache();
  });

  it('基本初始化创建目录结构和配置文件', async () => {
    await initCommand({ yes: true });

    // 验证目录
    expect(fs.existsSync(skillsDirPath())).toBe(true);
    expect(fs.existsSync(path.join(env.homeDir, 'cache'))).toBe(true);
    expect(fs.existsSync(path.join(env.homeDir, 'temp'))).toBe(true);

    // 验证配置文件
    expect(fs.existsSync(configPath())).toBe(true);
    expect(fs.existsSync(secretsPath())).toBe(true);
    expect(fs.existsSync(lockPath())).toBe(true);

    // 验证 secrets 权限
    const stat = fs.statSync(secretsPath());
    expect(stat.mode & 0o777).toBe(0o600);

    // 验证 lock 文件结构
    const lock = readLock();
    expect(lock.lockfileVersion).toBe(2);
    expect(lock.skills).toEqual({});
  });

  it('--scan 扫描散落 skill', async () => {
    // 在模拟 Agent 目录中创建散落 skill
    const agentSkillsDir = path.join(env.agentsDir, '.claude', 'skills');
    fs.mkdirSync(agentSkillsDir, { recursive: true });

    const skillDir = path.join(agentSkillsDir, 'my-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: my-skill\ndescription: Test skill\nmetadata:\n  version: 1.0.0\n---\n\n# My Skill\n',
      'utf-8',
    );

    await initCommand({ yes: true, scan: true, namespace: 'local' });

    // 验证 skill 已导入
    const lock = readLock();
    expect(lock.skills['local/my-skill']).toBeDefined();
    expect(lock.skills['local/my-skill']!.version).toBe('1.0.0');

    // 验证中央仓库有文件
    const repoPath = path.join(env.homeDir, 'skills', 'local', 'my-skill');
    expect(fs.existsSync(path.join(repoPath, 'SKILL.md'))).toBe(true);
  });

  it('--scan --link 替换原位置为 symlink', async () => {
    const agentSkillsDir = path.join(env.agentsDir, '.claude', 'skills');
    fs.mkdirSync(agentSkillsDir, { recursive: true });

    const skillDir = path.join(agentSkillsDir, 'my-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: my-skill\ndescription: Test\n---\n\n# My Skill\n',
      'utf-8',
    );

    await initCommand({ yes: true, scan: true, link: true, namespace: 'local' });

    // 验证原位置现在是 symlink
    const stat = fs.lstatSync(skillDir);
    expect(stat.isSymbolicLink()).toBe(true);
  });

  it('重复初始化（--yes 覆盖）', async () => {
    await initCommand({ yes: true });
    // 第二次初始化（有 --yes）
    await initCommand({ yes: true });
    expect(fs.existsSync(configPath())).toBe(true);
  });

  it('重复初始化（无 --yes 跳过）', async () => {
    await initCommand({ yes: true });
    // 第二次初始化（无 --yes）
    await initCommand({});
    // 仍然存在
    expect(fs.existsSync(configPath())).toBe(true);
  });
});
