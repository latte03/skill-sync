/**
 * frontmatter 模块单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter,
  isValidSkillFrontmatter,
  extractVersion,
  extractDependencies,
  extractPostInstall,
  hasXmlBrackets,
} from '../../src/lib/frontmatter.js';

describe('parseFrontmatter', () => {
  it('解析标准 YAML frontmatter', () => {
    const raw = `---
name: my-skill
description: A test skill
---
# Body content`;
    const result = parseFrontmatter(raw);
    expect(result.data.name).toBe('my-skill');
    expect(result.data.description).toBe('A test skill');
    expect(result.content).toBe('# Body content');
  });

  it('无 frontmatter 返回空 data 和原始内容', () => {
    const raw = '# Just content';
    const result = parseFrontmatter(raw);
    expect(result.data).toEqual({});
    expect(result.content).toBe('# Just content');
  });

  it('空 frontmatter', () => {
    const raw = `---
---
body`;
    const result = parseFrontmatter(raw);
    expect(result.data).toEqual({});
    expect(result.content).toBe('body');
  });

  it('多行 description', () => {
    const raw = `---
name: test
description: |
  Line 1
  Line 2
---
body`;
    const result = parseFrontmatter(raw);
    expect(result.data.name).toBe('test');
    expect(String(result.data.description)).toContain('Line 1');
  });

  it('带 metadata.version', () => {
    const raw = `---
name: test
description: test
metadata:
  version: 1.2.3
---
body`;
    const result = parseFrontmatter(raw);
    expect(result.data.metadata).toBeDefined();
    expect((result.data.metadata as Record<string, unknown>).version).toBe('1.2.3');
  });
});

describe('isValidSkillFrontmatter', () => {
  it('有 name 和 description 返回 true', () => {
    expect(isValidSkillFrontmatter({ name: 'test', description: 'desc' })).toBe(true);
  });

  it('缺少 name 返回 false', () => {
    expect(isValidSkillFrontmatter({ description: 'desc' })).toBe(false);
  });

  it('缺少 description 返回 false', () => {
    expect(isValidSkillFrontmatter({ name: 'test' })).toBe(false);
  });

  it('name 不是字符串返回 false', () => {
    expect(isValidSkillFrontmatter({ name: 123, description: 'desc' })).toBe(false);
  });
});

describe('extractVersion', () => {
  it('优先 metadata.version', () => {
    expect(extractVersion({
      version: '1.0.0',
      metadata: { version: '2.0.0' },
    })).toBe('2.0.0');
  });

  it('回退顶层 version', () => {
    expect(extractVersion({ version: '1.0.0' })).toBe('1.0.0');
  });

  it('无版本返回 null', () => {
    expect(extractVersion({ name: 'test' })).toBeNull();
  });

  it('metadata 无 version 返回 null', () => {
    expect(extractVersion({ metadata: { foo: 'bar' } })).toBeNull();
  });
});

describe('extractDependencies', () => {
  it('解析 depends_on 数组', () => {
    const data = {
      metadata: {
        depends_on: [
          { name: 'dep1', version: '^1.0.0' },
          { name: 'dep2', version: '^2.0.0' },
        ],
      },
    };
    const deps = extractDependencies(data);
    expect(deps).toHaveLength(2);
    expect(deps[0]).toEqual({ name: 'dep1', version: '^1.0.0' });
  });

  it('无 depends_on 返回空数组', () => {
    expect(extractDependencies({})).toEqual([]);
  });

  it('过滤掉无 name 的依赖', () => {
    const data = {
      metadata: {
        depends_on: [
          { name: 'dep1', version: '^1.0.0' },
          { version: '^2.0.0' }, // no name
        ],
      },
    };
    const deps = extractDependencies(data);
    expect(deps).toHaveLength(1);
  });
});

describe('extractPostInstall', () => {
  it('提取 post_install 路径', () => {
    expect(extractPostInstall({
      metadata: { post_install: 'scripts/setup.sh' },
    })).toBe('scripts/setup.sh');
  });

  it('无 post_install 返回 null', () => {
    expect(extractPostInstall({})).toBeNull();
  });
});

describe('hasXmlBrackets', () => {
  it('包含 < 返回 true', () => {
    expect(hasXmlBrackets({ desc: 'use <script>' })).toBe(true);
  });

  it('包含 > 返回 true', () => {
    expect(hasXmlBrackets({ desc: 'x > y' })).toBe(true);
  });

  it('无尖括号返回 false', () => {
    expect(hasXmlBrackets({ desc: 'normal text' })).toBe(false);
  });
});
