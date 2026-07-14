/**
 * lock 模块单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestEnv, createMockSkillMd } from '../test-utils.js';
import {
  readLock,
  writeLock,
  getLockEntry,
  setLockEntry,
  removeLockEntry,
  hasLockEntry,
  getAllLockSkillNames,
} from '../../src/lib/lock.js';
import { LOCKFILE_VERSION } from '../../src/lib/constants.js';
import type { LockFile, LockEntry } from '../../src/lib/types.js';

describe('lock', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    env.cleanup();
  });

  describe('readLock', () => {
    it('文件不存在时返回空结构', () => {
      const lock = readLock();
      expect(lock.lockfileVersion).toBe(LOCKFILE_VERSION);
      expect(lock.skills).toEqual({});
    });
  });

  describe('writeLock / readLock', () => {
    it('写入后能正确读取', () => {
      const lock: LockFile = {
        lockfileVersion: LOCKFILE_VERSION,
        generatedAt: new Date().toISOString(),
        generator: 'skill-sync v0.1.0',
        skills: {
          'local/test-skill': {
            source: { type: 'local' },
            version: '1.0.0',
            installedAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            distribution: {},
          },
        },
      };
      writeLock(lock);
      const read = readLock();
      expect(read.skills['local/test-skill']).toBeDefined();
      expect(read.skills['local/test-skill']!.version).toBe('1.0.0');
    });
  });

  describe('getLockEntry', () => {
    it('存在时返回条目', () => {
      setLockEntry('local/test', {
        source: { type: 'local' },
        version: '1.0.0',
        installedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        distribution: {},
      });
      const entry = getLockEntry('local/test');
      expect(entry).not.toBeNull();
      expect(entry!.version).toBe('1.0.0');
    });

    it('不存在时返回 null', () => {
      expect(getLockEntry('nonexistent/skill')).toBeNull();
    });
  });

  describe('setLockEntry', () => {
    it('新增条目', () => {
      const entry: LockEntry = {
        source: { type: 'github', repo: 'user/repo' },
        version: '2.0.0',
        installedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        distribution: {
          'claude-code': {
            mode: 'symlink',
            distributedAt: '2024-01-01T00:00:00Z',
            sourceHash: 'abc123',
            managed: true,
          },
        },
      };
      setLockEntry('anthropics/skill', entry);
      const read = getLockEntry('anthropics/skill');
      expect(read).toEqual(entry);
    });

    it('更新已有条目', () => {
      setLockEntry('local/test', {
        source: { type: 'local' },
        version: '1.0.0',
        installedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        distribution: {},
      });
      setLockEntry('local/test', {
        source: { type: 'local' },
        version: '2.0.0',
        installedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        distribution: {},
      });
      expect(getLockEntry('local/test')!.version).toBe('2.0.0');
    });
  });

  describe('removeLockEntry', () => {
    it('删除存在的条目', () => {
      setLockEntry('local/test', {
        source: { type: 'local' },
        version: '1.0.0',
        installedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        distribution: {},
      });
      removeLockEntry('local/test');
      expect(hasLockEntry('local/test')).toBe(false);
    });

    it('删除不存在的条目不报错', () => {
      expect(() => removeLockEntry('nonexistent/skill')).not.toThrow();
    });
  });

  describe('hasLockEntry', () => {
    it('存在返回 true', () => {
      setLockEntry('local/test', {
        source: { type: 'local' },
        version: '1.0.0',
        installedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        distribution: {},
      });
      expect(hasLockEntry('local/test')).toBe(true);
    });

    it('不存在返回 false', () => {
      expect(hasLockEntry('nonexistent/skill')).toBe(false);
    });
  });

  describe('getAllLockSkillNames', () => {
    it('返回所有 skill 名称', () => {
      setLockEntry('local/skill1', {
        source: { type: 'local' },
        version: '1.0.0',
        installedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        distribution: {},
      });
      setLockEntry('anthropics/skill2', {
        source: { type: 'github', repo: 'a/b' },
        version: '2.0.0',
        installedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        distribution: {},
      });
      const names = getAllLockSkillNames();
      expect(names).toHaveLength(2);
      expect(names).toContain('local/skill1');
      expect(names).toContain('anthropics/skill2');
    });

    it('空 lock 返回空数组', () => {
      expect(getAllLockSkillNames()).toEqual([]);
    });
  });
});
