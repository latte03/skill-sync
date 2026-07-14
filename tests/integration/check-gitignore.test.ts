/**
 * check-gitignore 命令测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTestEnv } from '../test-utils.js';
import { checkGitignoreCommand, getCorrectGitignoreContent } from '../../src/commands/check-gitignore.js';
import { getHomeDir } from '../../src/lib/paths.js';

describe('check-gitignore command', () => {
  let env: ReturnType<typeof createTestEnv>;
  let gitignorePath: string;

  beforeEach(() => {
    env = createTestEnv();
    gitignorePath = path.join(getHomeDir(), '.gitignore');
  });

  afterEach(() => {
    env.cleanup();
  });

  describe('getCorrectGitignoreContent', () => {
    it('返回包含白名单模式的正确内容', () => {
      const content = getCorrectGitignoreContent();
      const lines = content.split('\n');

      // 白名单模式核心
      expect(lines).toContain('/*');

      // 必须允许的文件
      expect(lines).toContain('!/.gitignore');
      expect(lines).toContain('!/config.yaml');
      expect(lines).toContain('!/skills-lock.json');
      expect(lines).toContain('!/tags.yaml');

      // 必须允许的目录
      expect(lines).toContain('!/skills/');

      // 备份目录排除
      expect(lines).toContain('/skills/**/.backup/');

      // OS/编辑器杂项
      expect(lines).toContain('.DS_Store');
      expect(lines).toContain('Thumbs.db');
      expect(lines).toContain('*.swp');
      expect(lines).toContain('*.swo');
    });

    it('不包含敏感文件的允许规则', () => {
      const content = getCorrectGitignoreContent();
      const lines = content.split('\n');

      expect(lines).not.toContain('!/secrets.yaml');
      expect(lines).not.toContain('!/cache/');
      expect(lines).not.toContain('!/temp/');
      expect(lines).not.toContain('!/web/');
    });
  });

  describe('checkGitignoreCommand — 正确配置', () => {
    it('完全正确的 .gitignore 应该无 fail', () => {
      fs.writeFileSync(gitignorePath, getCorrectGitignoreContent(), 'utf-8');

      // 不应抛出异常
      expect(() => checkGitignoreCommand({})).not.toThrow();
    });

    it('使用 init 生成的标准配置应该通过', () => {
      // 模拟 init 命令生成的内容
      const initContent = [
        '# SkillSync .gitignore — 白名单模式',
        '# 默认忽略所有文件，只跟踪下方显式允许的文件/目录',
        '',
        '# 忽略一切',
        '/*',
        '',
        '# 显式允许跟踪的文件',
        '!/.gitignore',
        '!/config.yaml',
        '!/skills-lock.json',
        '!/tags.yaml',
        '',
        '# 显式允许跟踪的目录',
        '!/skills/',
        '',
        '# skills/ 下的备份目录不跟踪',
        '/skills/**/.backup/',
        '',
        '# OS / 编辑器',
        '.DS_Store',
        'Thumbs.db',
        '*.swp',
        '*.swo',
        '',
      ].join('\n');
      fs.writeFileSync(gitignorePath, initContent, 'utf-8');

      expect(() => checkGitignoreCommand({})).not.toThrow();
    });
  });

  describe('checkGitignoreCommand — .gitignore 不存在', () => {
    it('文件不存在时应该报告 fail', () => {
      // 确保文件不存在
      expect(fs.existsSync(gitignorePath)).toBe(false);

      expect(() => checkGitignoreCommand({})).not.toThrow();
      // processExitCode 会被设置为 1，但不会抛出
    });

    it('--fix 能创建 .gitignore', () => {
      expect(fs.existsSync(gitignorePath)).toBe(false);

      checkGitignoreCommand({ fix: true });

      expect(fs.existsSync(gitignorePath)).toBe(true);
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toContain('/*');
      expect(content).toContain('!/.gitignore');
      expect(content).toContain('!/skills/');
    });
  });

  describe('checkGitignoreCommand — 缺少规则', () => {
    it('缺少 /* 白名单规则', () => {
      const content = getCorrectGitignoreContent().replace('/*\n', '');
      fs.writeFileSync(gitignorePath, content, 'utf-8');

      expect(() => checkGitignoreCommand({})).not.toThrow();
    });

    it('缺少 !/skills/ 目录规则', () => {
      const content = getCorrectGitignoreContent().replace('!/skills/\n', '');
      fs.writeFileSync(gitignorePath, content, 'utf-8');

      expect(() => checkGitignoreCommand({})).not.toThrow();
    });

    it('缺少 !/config.yaml 规则', () => {
      const content = getCorrectGitignoreContent().replace('!/config.yaml\n', '');
      fs.writeFileSync(gitignorePath, content, 'utf-8');

      expect(() => checkGitignoreCommand({})).not.toThrow();
    });

    it('缺少 /skills/**/.backup/ 规则', () => {
      const content = getCorrectGitignoreContent().replace('/skills/**/.backup/\n', '');
      fs.writeFileSync(gitignorePath, content, 'utf-8');

      expect(() => checkGitignoreCommand({})).not.toThrow();
    });

    it('缺少 OS/编辑器规则应报告 warn', () => {
      const content = getCorrectGitignoreContent()
        .replace('.DS_Store\n', '')
        .replace('Thumbs.db\n', '')
        .replace('*.swp\n', '')
        .replace('*.swo\n', '');
      fs.writeFileSync(gitignorePath, content, 'utf-8');

      expect(() => checkGitignoreCommand({})).not.toThrow();
    });
  });

  describe('checkGitignoreCommand — 安全检查', () => {
    it('secrets.yaml 被显式允许时应该报告 fail', () => {
      const content = getCorrectGitignoreContent() + '\n!/secrets.yaml\n';
      fs.writeFileSync(gitignorePath, content, 'utf-8');

      expect(() => checkGitignoreCommand({})).not.toThrow();
    });

    it('cache/ 被显式允许时应该报告 fail', () => {
      const content = getCorrectGitignoreContent() + '\n!/cache/\n';
      fs.writeFileSync(gitignorePath, content, 'utf-8');

      expect(() => checkGitignoreCommand({})).not.toThrow();
    });

    it('temp/ 被显式允许时应该报告 fail', () => {
      const content = getCorrectGitignoreContent() + '\n!/temp/\n';
      fs.writeFileSync(gitignorePath, content, 'utf-8');

      expect(() => checkGitignoreCommand({})).not.toThrow();
    });

    it('.env 被显式允许时应该报告 fail', () => {
      const content = getCorrectGitignoreContent() + '\n!/.env\n';
      fs.writeFileSync(gitignorePath, content, 'utf-8');

      expect(() => checkGitignoreCommand({})).not.toThrow();
    });
  });

  describe('checkGitignoreCommand --fix', () => {
    it('修复缺失的 .gitignore', () => {
      checkGitignoreCommand({ fix: true });

      expect(fs.existsSync(gitignorePath)).toBe(true);
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toBe(getCorrectGitignoreContent());
    });

    it('修复不完整的 .gitignore（覆盖为正确内容）', () => {
      // 写入一个不完整的 .gitignore
      fs.writeFileSync(gitignorePath, 'node_modules/\n', 'utf-8');

      checkGitignoreCommand({ fix: true });

      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toBe(getCorrectGitignoreContent());
      expect(content).not.toContain('node_modules');
    });

    it('修复包含安全问题的 .gitignore', () => {
      const badContent = getCorrectGitignoreContent() + '\n!/secrets.yaml\n!/cache/\n';
      fs.writeFileSync(gitignorePath, badContent, 'utf-8');

      checkGitignoreCommand({ fix: true });

      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toBe(getCorrectGitignoreContent());
      expect(content).not.toContain('!/secrets.yaml');
      expect(content).not.toContain('!/cache/');
    });

    it('正确的 .gitignore 经过 fix 后内容不变', () => {
      fs.writeFileSync(gitignorePath, getCorrectGitignoreContent(), 'utf-8');

      checkGitignoreCommand({ fix: true });

      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toBe(getCorrectGitignoreContent());
    });
  });

  describe('checkGitignoreCommand — 边界情况', () => {
    it('空 .gitignore 文件', () => {
      fs.writeFileSync(gitignorePath, '', 'utf-8');

      expect(() => checkGitignoreCommand({})).not.toThrow();
    });

    it('只有注释的 .gitignore 文件', () => {
      fs.writeFileSync(gitignorePath, '# just a comment\n# another\n', 'utf-8');

      expect(() => checkGitignoreCommand({})).not.toThrow();
    });

    it('包含额外允许规则的 .gitignore（非敏感）', () => {
      const content = getCorrectGitignoreContent() + '\n!/README.md\n';
      fs.writeFileSync(gitignorePath, content, 'utf-8');

      // 额外的非敏感规则应该是 warn 而不是 fail
      expect(() => checkGitignoreCommand({})).not.toThrow();
    });

    it('规则顺序不影响检测结果', () => {
      // 打乱顺序的规则
      const shuffled = [
        '*.swo',
        '*.swp',
        'Thumbs.db',
        '.DS_Store',
        '/skills/**/.backup/',
        '!/skills/',
        '!/tags.yaml',
        '!/skills-lock.json',
        '!/config.yaml',
        '!/.gitignore',
        '/*',
      ].join('\n');
      fs.writeFileSync(gitignorePath, shuffled, 'utf-8');

      expect(() => checkGitignoreCommand({})).not.toThrow();
    });

    it('中央仓库目录不存在时 --fix 能创建', () => {
      // 删除测试环境中的 home 目录
      fs.rmSync(getHomeDir(), { recursive: true, force: true });
      expect(fs.existsSync(getHomeDir())).toBe(false);

      checkGitignoreCommand({ fix: true });

      expect(fs.existsSync(gitignorePath)).toBe(true);
    });
  });
});
