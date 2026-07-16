/**
 * tags.ts 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { addTag, removeTag, listAllTags, listSkillsByTag, getSkillTags } from '../../src/lib/tags.js';
import { tagsPath } from '../../src/lib/paths.js';
import { installLocalSkill } from '../../src/core/installer.js';
import { createTestContext } from '../../src/core/context.js';
import { setupTestEnv, cleanupTestEnv } from '../test-utils.js';

describe('tags', () => {
  beforeEach(() => {
    const env = setupTestEnv();

    // 创建并安装一个 skill
    fs.mkdirSync(path.join(env.tempDir, 'test-skill'), { recursive: true });
    fs.writeFileSync(
      path.join(env.tempDir, 'test-skill', 'SKILL.md'),
      '---\nname: test-skill\nversion: 1.0.0\ndescription: Test\n---\n\n# Test\n',
    );

    const ctx = createTestContext();
    installLocalSkill(ctx, path.join(env.tempDir, 'test-skill'), {
      noDeploy: true,
      ignoreDeps: true,
    });
  });

  afterEach(() => {
    cleanupTestEnv();
  });

  it('addTag 给 skill 添加标签', () => {
    addTag('test-skill', 'document');
    const tags = listAllTags();
    expect(tags['document']).toContain('test-skill');
  });

  it('addTag 同步到 manifest', () => {
    addTag('test-skill', 'document');
    const skillTags = getSkillTags('test-skill');
    expect(skillTags).toContain('document');
  });

  it('addTag 不重复添加', () => {
    addTag('test-skill', 'document');
    addTag('test-skill', 'document');
    const tags = listAllTags();
    expect(tags['document'].length).toBe(1);
  });

  it('addTag 支持多个标签', () => {
    addTag('test-skill', 'document');
    addTag('test-skill', 'coding');
    const skillTags = getSkillTags('test-skill');
    expect(skillTags).toContain('document');
    expect(skillTags).toContain('coding');
  });

  it('removeTag 移除标签', () => {
    addTag('test-skill', 'document');
    removeTag('test-skill', 'document');
    const tags = listAllTags();
    expect(tags['document']).toBeUndefined();
  });

  it('removeTag 同步到 manifest', () => {
    addTag('test-skill', 'document');
    removeTag('test-skill', 'document');
    const skillTags = getSkillTags('test-skill');
    expect(skillTags).not.toContain('document');
  });

  it('listAllTags 返回所有标签', () => {
    addTag('test-skill', 'document');
    addTag('test-skill', 'coding');
    const tags = listAllTags();
    expect(Object.keys(tags).length).toBe(2);
    expect(tags['document']).toBeDefined();
    expect(tags['coding']).toBeDefined();
  });

  it('listSkillsByTag 返回标签下的 skill', () => {
    addTag('test-skill', 'document');
    const skills = listSkillsByTag('document');
    expect(skills).toContain('test-skill');
  });

  it('listSkillsByTag 不存在的标签返回空数组', () => {
    const skills = listSkillsByTag('nonexistent');
    expect(skills).toEqual([]);
  });

  it('addTag 不存在的 skill 抛出错误', () => {
    expect(() => addTag('nonexistent/skill', 'tag')).toThrow('Skill 未找到');
  });

  it('无标签时 listAllTags 返回空对象', () => {
    const tags = listAllTags();
    expect(Object.keys(tags).length).toBe(0);
  });

  it('移除最后一个标签后标签键被删除', () => {
    addTag('test-skill', 'temp');
    removeTag('test-skill', 'temp');
    const tags = listAllTags();
    expect(tags['temp']).toBeUndefined();
  });
});
