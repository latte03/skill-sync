/**
 * search.ts 单元测试
 *
 * 重点测试本地搜索逻辑（不依赖网络）
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { searchLocal } from '../../src/lib/search.js';
import { setupTestEnv, cleanupTestEnv } from '../test-utils.js';
import { createTestContext } from '../../src/core/context.js';
import { installLocalSkill } from '../../src/core/installer.js';

describe('searchLocal', () => {
  let testDir: string;

  beforeEach(() => {
    const env = setupTestEnv();
    testDir = env.tempDir;

    // 创建多个 skill 用于搜索
    const skills = [
      { dir: 'pdf-tools', name: 'pdf-tools', desc: 'PDF processing skill', version: '1.0.0' },
      { dir: 'web-design', name: 'web-design', desc: 'Web design automation', version: '2.0.0' },
      { dir: 'code-review', name: 'code-review', desc: 'Automated code review', version: '1.5.0' },
      { dir: 'image-gen', name: 'image-gen', desc: 'Image generation with AI', version: '0.9.0' },
    ];

    for (const skill of skills) {
      const skillDir = path.join(testDir, skill.dir);
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        `---\nname: ${skill.name}\ndescription: ${skill.desc}\nversion: ${skill.version}\n---\n\n# ${skill.name}\n`,
      );
    }

    // 安装到中央仓库
    const ctx = createTestContext();
    for (const skill of skills) {
      installLocalSkill(ctx, path.join(testDir, skill.dir), 'local', {
        noDeploy: true,
        ignoreDeps: true,
      });
    }
  });

  afterEach(() => {
    cleanupTestEnv();
  });

  it('按名称搜索', () => {
    const results = searchLocal('pdf');
    expect(results.length).toBe(1);
    expect(results[0]!.name).toBe('local/pdf-tools');
    expect(results[0]!.isLocal).toBe(true);
    expect(results[0]!.localVersion).toBe('1.0.0');
  });

  it('按描述搜索', () => {
    const results = searchLocal('automation');
    expect(results.length).toBe(1);
    expect(results[0]!.name).toBe('local/web-design');
  });

  it('大小写不敏感', () => {
    const results = searchLocal('PDF');
    expect(results.length).toBe(1);
    expect(results[0]!.name).toBe('local/pdf-tools');
  });

  it('无匹配返回空数组', () => {
    const results = searchLocal('nonexistent');
    expect(results).toEqual([]);
  });

  it('limit 限制结果数量', () => {
    // 搜索 'a' 会匹配多个 skill 的描述
    const results = searchLocal('a', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('空查询返回所有 skill', () => {
    const results = searchLocal('');
    expect(results.length).toBe(4);
  });

  it('结果包含 isLocal 和 localVersion', () => {
    const results = searchLocal('code-review');
    expect(results[0]!.isLocal).toBe(true);
    expect(results[0]!.localVersion).toBe('1.5.0');
  });

  it('结果按相关度排序（名称匹配优先）', () => {
    // 搜索 'gen' — image-gen 名称匹配，但其他 skill 描述中不含 'gen'
    const results = searchLocal('gen');
    expect(results.length).toBe(1);
    expect(results[0]!.name).toBe('local/image-gen');
  });
});
