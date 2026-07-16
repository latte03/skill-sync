/**
 * dependencies.ts 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  isEmptyDependencies,
  sanitizeDependencies,
  extractPackageDependencies,
  checkSkillDependencies,
  installDependencies,
} from '../../src/lib/dependencies.js';
import type { SkillDependencies } from '../../src/lib/types.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const execFileSyncMock = vi.mocked(execFileSync);

describe('isEmptyDependencies', () => {
  it('undefined 为空', () => {
    expect(isEmptyDependencies(undefined)).toBe(true);
  });

  it('空对象为空', () => {
    expect(isEmptyDependencies({})).toBe(true);
  });

  it('空数组为空', () => {
    expect(isEmptyDependencies({ npm: [], pip: [] })).toBe(true);
  });

  it('有内容不为空', () => {
    expect(isEmptyDependencies({ npm: ['lodash'] })).toBe(false);
  });

  it('pip 有内容不为空', () => {
    expect(isEmptyDependencies({ pip: ['requests'] })).toBe(false);
  });
});

describe('installDependencies', () => {
  beforeEach(() => {
    execFileSyncMock.mockReset();
  });

  it('uses argument arrays and disables npm lifecycle scripts', () => {
    expect(installDependencies('/tmp/skill dir', { npm: ['safe-package', 'name with spaces'] })).toBe(true);

    expect(execFileSyncMock).toHaveBeenCalledWith(
      'npm',
      ['install', '--prefix', '/tmp/skill dir', '--ignore-scripts', '--', 'safe-package', 'name with spaces'],
      expect.objectContaining({ cwd: '/tmp/skill dir' }),
    );
  });
});

describe('sanitizeDependencies', () => {
  it('undefined 返回空对象', () => {
    expect(sanitizeDependencies(undefined)).toEqual({});
  });

  it('过滤无效的包管理器', () => {
    const result = sanitizeDependencies({
      npm: ['lodash'],
      brew: ['something'],  // 不支持
      apt: ['something'],   // 不支持
    });
    expect(result).toEqual({ npm: ['lodash'] });
    expect(result).not.toHaveProperty('brew');
    expect(result).not.toHaveProperty('apt');
  });

  it('过滤非字符串值', () => {
    const result = sanitizeDependencies({
      npm: ['lodash', 123, null, ''],
      pip: ['requests', true],
    });
    expect(result.npm).toEqual(['lodash']);
    expect(result.pip).toEqual(['requests']);
  });

  it('去重', () => {
    const result = sanitizeDependencies({
      npm: ['lodash', 'lodash', 'axios', 'axios'],
    });
    expect(result.npm).toEqual(['lodash', 'axios']);
  });

  it('trim 空白', () => {
    const result = sanitizeDependencies({
      npm: ['  lodash  ', '  axios  '],
    });
    expect(result.npm).toEqual(['lodash', 'axios']);
  });
});

describe('extractPackageDependencies', () => {
  it('从 metadata.dependencies 提取', () => {
    const data = {
      metadata: {
        dependencies: {
          npm: ['lodash', 'axios'],
          pip: ['requests'],
        },
      },
    };
    const result = extractPackageDependencies(data);
    expect(result.npm).toEqual(['lodash', 'axios']);
    expect(result.pip).toEqual(['requests']);
  });

  it('从顶层 dependencies 提取（回退）', () => {
    const data = {
      dependencies: {
        npm: ['lodash'],
      },
    };
    const result = extractPackageDependencies(data);
    expect(result.npm).toEqual(['lodash']);
  });

  it('metadata.dependencies 优先于顶层', () => {
    const data = {
      dependencies: { npm: ['top-level'] },
      metadata: {
        dependencies: { npm: ['metadata-level'] },
      },
    };
    const result = extractPackageDependencies(data);
    expect(result.npm).toEqual(['metadata-level']);
  });

  it('无依赖声明返回空', () => {
    const data = { name: 'test' };
    const result = extractPackageDependencies(data);
    expect(result).toEqual({});
  });
});

describe('checkSkillDependencies', () => {
  it('所有依赖已安装返回空数组', () => {
    const dependsOn = [
      { name: 'skill-a', version: '1.0.0' },
      { name: 'skill-b', version: '2.0.0' },
    ];
    const installed = new Set(['skill-a', 'skill-b', 'skill-c']);
    const missing = checkSkillDependencies(dependsOn, installed);
    expect(missing).toEqual([]);
  });

  it('返回缺失的依赖', () => {
    const dependsOn = [
      { name: 'skill-a', version: '1.0.0' },
      { name: 'skill-b', version: '2.0.0' },
      { name: 'skill-c', version: '3.0.0' },
    ];
    const installed = new Set(['skill-a']);
    const missing = checkSkillDependencies(dependsOn, installed);
    expect(missing).toEqual(['skill-b', 'skill-c']);
  });

  it('空依赖列表返回空数组', () => {
    const missing = checkSkillDependencies([], new Set());
    expect(missing).toEqual([]);
  });
});
