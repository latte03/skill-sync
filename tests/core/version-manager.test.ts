/**
 * version-manager.ts 单元测试
 *
 * 重点测试备份 + 恢复逻辑（不依赖网络）
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTestContext } from '../../src/core/context.js';
import { installLocalSkill } from '../../src/core/installer.js';
import { createBackup, listBackups } from '../../src/core/skill-manager.js';
import { checkForUpdate, listSkillBackups, restoreFromBackup } from '../../src/core/version-manager.js';
import { getLockEntry, setLockEntry } from '../../src/lib/lock.js';
import { readManifest, writeManifest } from '../../src/lib/manifest.js';
import { skillRepoPath, backupDirPath } from '../../src/lib/paths.js';
import { setupTestEnv, cleanupTestEnv } from '../test-utils.js';

describe('checkForUpdate', () => {
  let testDir: string;

  beforeEach(() => {
    const env = setupTestEnv();
    testDir = env.tempDir;

    // 创建本地 skill
    fs.mkdirSync(path.join(testDir, 'test-skill'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'test-skill', 'SKILL.md'),
      '---\nname: test-skill\nversion: 1.0.0\ndescription: Test skill\n---\n\n# Test\n',
    );

    const ctx = createTestContext();
    installLocalSkill(ctx, path.join(testDir, 'test-skill'), {
      noDeploy: true,
      ignoreDeps: true,
    });
  });

  afterEach(() => {
    cleanupTestEnv();
  });

  it('本地 skill 返回 isLocal=true', async () => {
    const ctx = createTestContext();
    const result = await checkForUpdate(ctx, 'test-skill');
    expect(result.isLocal).toBe(true);
    expect(result.hasUpdate).toBe(false);
    expect(result.remoteVersion).toBeNull();
    expect(result.currentVersion).toBe('1.0.0');
  });

  it('不存在的 skill 抛出错误', async () => {
    const ctx = createTestContext();
    await expect(checkForUpdate(ctx, 'nonexistent/skill')).rejects.toThrow('Skill 未找到');
  });
});

describe('备份与恢复', () => {
  let testDir: string;

  beforeEach(() => {
    const env = setupTestEnv();
    testDir = env.tempDir;

    // 创建 skill
    fs.mkdirSync(path.join(testDir, 'my-skill'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'my-skill', 'SKILL.md'),
      '---\nname: my-skill\nversion: 1.0.0\ndescription: Original\n---\n\n# My Skill v1\n',
    );
    fs.writeFileSync(
      path.join(testDir, 'my-skill', 'script.sh'),
      'echo "v1"',
    );

    const ctx = createTestContext();
    installLocalSkill(ctx, path.join(testDir, 'my-skill'), {
      noDeploy: true,
      ignoreDeps: true,
    });
  });

  afterEach(() => {
    cleanupTestEnv();
  });

  it('createBackup 创建备份目录', () => {
    const ctx = createTestContext();
    const backupPath = createBackup(ctx, 'my-skill');

    expect(fs.existsSync(backupPath)).toBe(true);
    expect(fs.existsSync(path.join(backupPath, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(backupPath, 'script.sh'))).toBe(true);
  });

  it('createBackup only retains the configured maximum number of backups', () => {
    const ctx = createTestContext();
    for (let index = 0; index < 6; index++) {
      createBackup(ctx, 'my-skill');
    }

    expect(listBackups('my-skill')).toHaveLength(5);
  });

  it('createBackup honors a custom maxBackups value', () => {
    const ctx = createTestContext({ config: { logLevel: 'info', version: { maxBackups: 2 } } });
    for (let index = 0; index < 3; index++) {
      createBackup(ctx, 'my-skill');
    }

    expect(listBackups('my-skill')).toHaveLength(2);
  });

  it('retains the newest snapshot when maxBackups is configured as zero', () => {
    const ctx = createTestContext({ config: { logLevel: 'info', version: { maxBackups: 0 } } });
    createBackup(ctx, 'my-skill');

    expect(listBackups('my-skill')).toHaveLength(1);
  });

  it('createBackup 更新 manifest.lastBackup', () => {
    const ctx = createTestContext();
    createBackup(ctx, 'my-skill');

    const manifest = readManifest('my-skill');
    expect(manifest.lastBackup).toBeDefined();
    expect(manifest.lastBackup?.fromVersion).toBe('1.0.0');
  });

  it('listBackups 返回备份列表', () => {
    const ctx = createTestContext();
    createBackup(ctx, 'my-skill');

    const backups = listBackups('my-skill');
    expect(backups.length).toBe(1);
    expect(backups[0]!.version).toBe('1.0.0');
  });

  it('listSkillBackups 返回带 ID 的备份列表', () => {
    const ctx = createTestContext();
    createBackup(ctx, 'my-skill');

    const backups = listSkillBackups('my-skill');
    expect(backups.length).toBe(1);
    expect(backups[0]!.id).toBe(1);
    expect(backups[0]!.version).toBe('1.0.0');
  });

  it('listSkillBackups 无备份时返回空数组', () => {
    const backups = listSkillBackups('my-skill');
    expect(backups).toEqual([]);
  });

  it('restoreFromBackup 恢复 skill 内容', () => {
    const ctx = createTestContext();

    // 1. 创建备份
    createBackup(ctx, 'my-skill');

    // 2. 修改 skill 内容
    const repoPath = skillRepoPath('my-skill');
    fs.writeFileSync(
      path.join(repoPath, 'SKILL.md'),
      '---\nname: my-skill\nversion: 2.0.0\ndescription: Updated\n---\n\n# My Skill v2\n',
    );

    // 3. 验证已修改
    const modifiedManifest = readManifest('my-skill');
    // manifest 还没更新（只有文件内容变了）
    expect(modifiedManifest.currentVersion).toBe('1.0.0');

    // 4. 恢复
    const result = restoreFromBackup(ctx, 'my-skill');
    expect(result.version).toBe('1.0.0');

    // 5. 验证文件内容已恢复
    const content = fs.readFileSync(path.join(repoPath, 'SKILL.md'), 'utf-8');
    expect(content).toContain('My Skill v1');
    expect(content).not.toContain('My Skill v2');

    // 6. 验证 manifest 版本已恢复
    const restoredManifest = readManifest('my-skill');
    expect(restoredManifest.currentVersion).toBe('1.0.0');

    // 7. 验证 lock 版本已恢复
    const entry = getLockEntry('my-skill');
    expect(entry?.version).toBe('1.0.0');
  });

  it('restoreFromBackup 指定备份 ID', () => {
    const ctx = createTestContext();

    // 创建两个备份
    createBackup(ctx, 'my-skill');

    // 修改版本后创建第二个备份
    const repoPath = skillRepoPath('my-skill');
    const manifest = readManifest('my-skill');
    manifest.currentVersion = '2.0.0';
    writeManifest('my-skill', manifest);

    const entry = getLockEntry('my-skill');
    entry!.version = '2.0.0';
    setLockEntry('my-skill', entry!);

    createBackup(ctx, 'my-skill');

    // 确认有两个备份
    const backups = listSkillBackups('my-skill');
    expect(backups.length).toBe(2);

    // ID 1 = 最新备份 (v2.0.0), ID 2 = 最旧备份 (v1.0.0)
    expect(backups[0]!.id).toBe(1);
    expect(backups[0]!.version).toBe('2.0.0');
    expect(backups[1]!.id).toBe(2);
    expect(backups[1]!.version).toBe('1.0.0');

    // 恢复 ID 1 (v2.0.0)
    const result = restoreFromBackup(ctx, 'my-skill', 1);
    expect(result.version).toBe('2.0.0');
  });

  it('restoreFromBackup 无备份时抛出错误', () => {
    const ctx = createTestContext();
    expect(() => {
      restoreFromBackup(ctx, 'my-skill');
    }).toThrow('无可用备份');
  });

  it('restoreFromBackup 不存在的备份 ID 抛出错误', () => {
    const ctx = createTestContext();
    createBackup(ctx, 'my-skill');

    expect(() => {
      restoreFromBackup(ctx, 'my-skill', 999);
    }).toThrow('备份 ID 999 不存在');
  });
});
