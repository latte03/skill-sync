/**
 * source.ts 单元测试
 */

import { describe, it, expect } from 'vitest';
import { parseSource, isLocalSource, isGitHubSource } from '../../src/lib/source.js';

describe('parseSource', () => {
  describe('本地路径', () => {
    it('解析绝对路径', () => {
      const result = parseSource('/path/to/skill');
      expect(result.type).toBe('local');
      expect(result.skillPath).toBe('/path/to/skill');
      expect(result.owner).toBeNull();
      expect(result.repo).toBeNull();
    });

    it('解析相对路径 ./', () => {
      const result = parseSource('./my-skill');
      expect(result.type).toBe('local');
      expect(result.skillPath).toContain('my-skill');
    });

    it('解析相对路径 ../', () => {
      const result = parseSource('../my-skill');
      expect(result.type).toBe('local');
      expect(result.skillPath).toContain('my-skill');
    });

    it('解析 local: 前缀', () => {
      const result = parseSource('local:/path/to/skill');
      expect(result.type).toBe('local');
      expect(result.skillPath).toBe('/path/to/skill');
    });
  });

  describe('GitHub 简写', () => {
    it('解析 owner/repo', () => {
      const result = parseSource('anthropics/skills');
      expect(result.type).toBe('github');
      expect(result.owner).toBe('anthropics');
      expect(result.repo).toBe('skills');
      expect(result.url).toBe('https://github.com/anthropics/skills.git');
      expect(result.skillPath).toBeNull();
      expect(result.ref).toBeNull();
    });

    it('解析 owner/repo/path/to/skill', () => {
      const result = parseSource('anthropics/skills/pdf-processing');
      expect(result.type).toBe('github');
      expect(result.owner).toBe('anthropics');
      expect(result.repo).toBe('skills');
      expect(result.skillPath).toBe('pdf-processing');
    });

    it('解析 owner/repo#ref', () => {
      const result = parseSource('anthropics/skills#main');
      expect(result.type).toBe('github');
      expect(result.owner).toBe('anthropics');
      expect(result.repo).toBe('skills');
      expect(result.ref).toBe('main');
    });

    it('解析 owner/repo/path#ref', () => {
      const result = parseSource('anthropics/skills/pdf-processing#v1.0');
      expect(result.type).toBe('github');
      expect(result.owner).toBe('anthropics');
      expect(result.repo).toBe('skills');
      expect(result.skillPath).toBe('pdf-processing');
      expect(result.ref).toBe('v1.0');
    });

    it('解析 github: 前缀', () => {
      const result = parseSource('github:anthropics/skills');
      expect(result.type).toBe('github');
      expect(result.owner).toBe('anthropics');
      expect(result.repo).toBe('skills');
    });
  });

  describe('HTTPS URL', () => {
    it('解析 GitHub HTTPS URL', () => {
      const result = parseSource('https://github.com/anthropics/skills');
      expect(result.type).toBe('github');
      expect(result.owner).toBe('anthropics');
      expect(result.repo).toBe('skills');
      expect(result.url).toBe('https://github.com/anthropics/skills.git');
    });

    it('解析 GitHub HTTPS URL with /tree/branch/path', () => {
      const result = parseSource('https://github.com/anthropics/skills/tree/main/skills/pdf-processing');
      expect(result.type).toBe('github');
      expect(result.owner).toBe('anthropics');
      expect(result.repo).toBe('skills');
      expect(result.ref).toBe('main');
      expect(result.skillPath).toBe('skills/pdf-processing');
    });

    it('解析 GitHub HTTPS URL with #ref', () => {
      const result = parseSource('https://github.com/anthropics/skills#v1.0');
      expect(result.type).toBe('github');
      expect(result.owner).toBe('anthropics');
      expect(result.repo).toBe('skills');
      expect(result.ref).toBe('v1.0');
    });
  });

  describe('SSH URL', () => {
    it('解析 SSH URL', () => {
      const result = parseSource('git@github.com:anthropics/skills.git');
      expect(result.type).toBe('github');
      expect(result.owner).toBe('anthropics');
      expect(result.repo).toBe('skills');
      expect(result.url).toBe('https://github.com/anthropics/skills.git');
    });

    it('解析 SSH URL without .git', () => {
      const result = parseSource('git@github.com:anthropics/skills');
      expect(result.type).toBe('github');
      expect(result.owner).toBe('anthropics');
      expect(result.repo).toBe('skills');
    });
  });

  describe('其他 Git URL', () => {
    it('解析 git: 前缀', () => {
      const result = parseSource('git:https://example.com/repo.git');
      expect(result.type).toBe('git');
      expect(result.url).toBe('https://example.com/repo.git');
    });

    it('解析 GitLab URL', () => {
      const result = parseSource('https://gitlab.com/myorg/myrepo');
      expect(result.type).toBe('git');
      expect(result.owner).toBe('myorg');
      expect(result.repo).toBe('myrepo');
    });
  });

  describe('无效输入', () => {
    it('对无法解析的字符串抛出错误', () => {
      expect(() => parseSource('invalid-source')).toThrow();
    });
  });
});

describe('isLocalSource', () => {
  it('识别绝对路径', () => {
    expect(isLocalSource('/path/to/skill')).toBe(true);
  });

  it('识别相对路径', () => {
    expect(isLocalSource('./skill')).toBe(true);
    expect(isLocalSource('../skill')).toBe(true);
  });

  it('识别 local: 前缀', () => {
    expect(isLocalSource('local:/path')).toBe(true);
  });

  it('不识别 GitHub 简写', () => {
    expect(isLocalSource('anthropics/skills')).toBe(false);
  });

  it('不识别 GitHub URL', () => {
    expect(isLocalSource('https://github.com/anthropics/skills')).toBe(false);
  });
});

describe('isGitHubSource', () => {
  it('识别 GitHub 简写', () => {
    expect(isGitHubSource('anthropics/skills')).toBe(true);
  });

  it('识别 github: 前缀', () => {
    expect(isGitHubSource('github:anthropics/skills')).toBe(true);
  });

  it('识别 GitHub HTTPS URL', () => {
    expect(isGitHubSource('https://github.com/anthropics/skills')).toBe(true);
  });

  it('识别 SSH URL', () => {
    expect(isGitHubSource('git@github.com:anthropics/skills.git')).toBe(true);
  });

  it('不识别本地路径', () => {
    expect(isGitHubSource('/path/to/skill')).toBe(false);
    expect(isGitHubSource('./skill')).toBe(false);
  });
});
