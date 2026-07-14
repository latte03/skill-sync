/**
 * installer.ts 单元测试
 *
 * 重点测试本地 skill 发现和安装逻辑（不依赖网络）
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { discoverLocalSkills, installLocalSkill } from '../../src/core/installer.js';
import { createTestContext } from '../../src/core/context.js';
import { skillRepoPath } from '../../src/lib/paths.js';
import { readManifest } from '../../src/lib/manifest.js';
import { getLockEntry } from '../../src/lib/lock.js';
import { setupTestEnv, cleanupTestEnv } from '../test-utils.js';

describe('discoverLocalSkills', () => {
  let testDir: string;

  beforeEach(() => {
    const env = setupTestEnv();
    testDir = env.tempDir;

    // 创建测试 skill 目录结构
    // testDir/
    //   my-skill/
    //     SKILL.md
    //   skills/
    //     skill-a/
    //       SKILL.md
    //     skill-b/
    //       SKILL.md
    //   nested/
    //     deep/
    //       skill-c/
    //         SKILL.md

    fs.mkdirSync(path.join(testDir, 'my-skill'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'my-skill', 'SKILL.md'),
      '---\nname: my-skill\ndescription: Test skill\n---\n\n# My Skill\n',
    );

    fs.mkdirSync(path.join(testDir, 'skills', 'skill-a'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'skills', 'skill-a', 'SKILL.md'),
      '---\nname: skill-a\nversion: 1.0.0\n---\n\n# Skill A\n',
    );

    fs.mkdirSync(path.join(testDir, 'skills', 'skill-b'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'skills', 'skill-b', 'SKILL.md'),
      '---\nname: skill-b\n---\n\n# Skill B\n',
    );

    fs.mkdirSync(path.join(testDir, 'nested', 'deep', 'skill-c'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'nested', 'deep', 'skill-c', 'SKILL.md'),
      '---\nname: skill-c\n---\n\n# Skill C\n',
    );
  });

  afterEach(() => {
    cleanupTestEnv();
  });

  it('发现根目录的 SKILL.md', () => {
    const skills = discoverLocalSkills(testDir);
    const names = skills.map(s => s.name);
    expect(names).toContain('my-skill');
  });

  it('发现 skills/ 子目录中的 skill', () => {
    const skills = discoverLocalSkills(testDir);
    const names = skills.map(s => s.name);
    expect(names).toContain('skill-a');
    expect(names).toContain('skill-b');
  });

  it('发现嵌套目录中的 skill', () => {
    const skills = discoverLocalSkills(testDir);
    const names = skills.map(s => s.name);
    expect(names).toContain('skill-c');
  });

  it('解析 frontmatter 元数据', () => {
    const skills = discoverLocalSkills(testDir);
    const mySkill = skills.find(s => s.name === 'my-skill');
    expect(mySkill).toBeDefined();
    expect(mySkill?.description).toBe('Test skill');
  });

  it('对不存在的目录返回空数组', () => {
    const skills = discoverLocalSkills('/nonexistent/path');
    expect(skills).toEqual([]);
  });

  it('去重相同的 skill 目录', () => {
    const skills = discoverLocalSkills(testDir);
    const dirs = skills.map(s => s.dir);
    const uniqueDirs = [...new Set(dirs)];
    expect(dirs.length).toBe(uniqueDirs.length);
  });
});

describe('installLocalSkill', () => {
  let testDir: string;

  beforeEach(() => {
    const env = setupTestEnv();
    testDir = env.tempDir;

    // 创建一个本地 skill
    fs.mkdirSync(path.join(testDir, 'test-skill'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'test-skill', 'SKILL.md'),
      '---\nname: test-skill\nversion: 1.2.0\ndescription: A test skill\n---\n\n# Test Skill\n\nThis is a test.\n',
    );
    fs.writeFileSync(
      path.join(testDir, 'test-skill', 'script.sh'),
      '#!/bin/bash\necho "hello"\n',
    );
  });

  afterEach(() => {
    cleanupTestEnv();
  });

  it('安装 skill 到中央仓库', () => {
    const ctx = createTestContext();
    const result = installLocalSkill(ctx, path.join(testDir, 'test-skill'), 'local', {
      noDeploy: true,
      ignoreDeps: true,
    });

    expect(result.name).toBe('local/test-skill');
    expect(result.namespace).toBe('local');
    expect(result.version).toBe('1.2.0');
    expect(result.source.type).toBe('local');

    // 验证文件已复制
    const repoPath = skillRepoPath('local', 'test-skill');
    expect(fs.existsSync(path.join(repoPath, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(repoPath, 'script.sh'))).toBe(true);
  });

  it('生成 manifest.yaml', () => {
    const ctx = createTestContext();
    installLocalSkill(ctx, path.join(testDir, 'test-skill'), 'local', {
      noDeploy: true,
      ignoreDeps: true,
    });

    const manifest = readManifest('local', 'test-skill');
    expect(manifest).not.toBeNull();
    expect(manifest?.namespace).toBe('local');
    expect(manifest?.name).toBe('test-skill');
    expect(manifest?.currentVersion).toBe('1.2.0');
    expect(manifest?.description).toBe('A test skill');
  });

  it('更新 skills-lock.json', () => {
    const ctx = createTestContext();
    installLocalSkill(ctx, path.join(testDir, 'test-skill'), 'local', {
      noDeploy: true,
      ignoreDeps: true,
    });

    const entry = getLockEntry('local/test-skill');
    expect(entry).not.toBeNull();
    expect(entry?.version).toBe('1.2.0');
    expect(entry?.source.type).toBe('local');
  });

  it('对不存在的路径抛出错误', () => {
    const ctx = createTestContext();
    expect(() => {
      installLocalSkill(ctx, '/nonexistent/path', 'local', { noDeploy: true });
    }).toThrow('本地路径不存在');
  });

  it('指定 skill 名称过滤', () => {
    // 创建第二个 skill
    fs.mkdirSync(path.join(testDir, 'another-skill'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'another-skill', 'SKILL.md'),
      '---\nname: another-skill\n---\n\n# Another\n',
    );

    const ctx = createTestContext();
    const result = installLocalSkill(ctx, testDir, 'local', {
      skill: 'test-skill',
      noDeploy: true,
      ignoreDeps: true,
    });

    expect(result.name).toBe('local/test-skill');
  });

  it('多 skill 且未指定时抛出错误', () => {
    // 创建第二个 skill
    fs.mkdirSync(path.join(testDir, 'another-skill'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'another-skill', 'SKILL.md'),
      '---\nname: another-skill\n---\n\n# Another\n',
    );

    const ctx = createTestContext();
    expect(() => {
      installLocalSkill(ctx, testDir, 'local', { noDeploy: true });
    }).toThrow('发现多个 skill');
  });
});
