/**
 * config 模块单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createTestEnv } from '../test-utils.js';
import {
  getDefaultConfig,
  readConfig,
  writeConfig,
  updateConfig,
  readSecrets,
  writeSecrets,
  getGitHubToken,
  isInitialized,
} from '../../src/config.js';

describe('config', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    env.cleanup();
  });

  describe('getDefaultConfig', () => {
    it('返回包含默认值的配置', () => {
      const config = getDefaultConfig();
      expect(config.distributionMode).toBe('symlink');
      expect(config.colorOutput).toBe(true);
      expect(config.logLevel).toBe('info');
      expect(config.version?.maxBackups).toBe(5);
      expect(config.install?.allowScripts).toBe('prompt');
      expect(config.network?.timeout).toBe(15000);
    });
  });

  describe('readConfig', () => {
    it('文件不存在时返回默认配置', () => {
      const config = readConfig();
      expect(config.distributionMode).toBe('symlink');
    });
  });

  describe('writeConfig / readConfig', () => {
    it('写入后能正确读取', () => {
      const config = getDefaultConfig();
      config.defaultAgent = 'claude-code';
      config.logLevel = 'debug';
      writeConfig(config);

      const read = readConfig();
      expect(read.defaultAgent).toBe('claude-code');
      expect(read.logLevel).toBe('debug');
    });

    it('写入创建目录和文件', () => {
      const config = getDefaultConfig();
      writeConfig(config);
      expect(fs.existsSync(path.join(env.homeDir, 'config.yaml'))).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('合并写入', () => {
      const config = getDefaultConfig();
      writeConfig(config);

      updateConfig({ logLevel: 'warn' });
      const read = readConfig();
      expect(read.logLevel).toBe('warn');
      // 其他值保持不变
      expect(read.distributionMode).toBe('symlink');
    });

    it('深度合并嵌套对象', () => {
      const config = getDefaultConfig();
      writeConfig(config);

      updateConfig({ version: { maxBackups: 10 } });
      const read = readConfig();
      expect(read.version?.maxBackups).toBe(10);
    });
  });

  describe('secrets', () => {
    it('写入和读取 secrets', () => {
      writeSecrets({ GITHUB_TOKEN: 'ghp_test_token' });
      const read = readSecrets();
      expect(read.GITHUB_TOKEN).toBe('ghp_test_token');
    });

    it('secrets 文件权限为 0600', () => {
      writeSecrets({ GITHUB_TOKEN: 'ghp_test' });
      const stat = fs.statSync(path.join(env.homeDir, 'secrets.yaml'));
      const mode = stat.mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it('空 secrets 返回空对象', () => {
      const read = readSecrets();
      expect(read).toEqual({});
    });
  });

  describe('getGitHubToken', () => {
    afterEach(() => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_TOKEN;
    });

    it('优先从 secrets.yaml 读取', () => {
      writeSecrets({ GITHUB_TOKEN: 'from_secrets' });
      process.env.GITHUB_TOKEN = 'from_env';
      expect(getGitHubToken()).toBe('from_secrets');
    });

    it('回退到 GITHUB_TOKEN 环境变量', () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_TOKEN;
      writeSecrets({});
      process.env.GITHUB_TOKEN = 'from_env';
      expect(getGitHubToken()).toBe('from_env');
    });

    it('回退到 GH_TOKEN 环境变量', () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_TOKEN;
      writeSecrets({});
      process.env.GH_TOKEN = 'from_gh';
      expect(getGitHubToken()).toBe('from_gh');
    });

    it('无 token 返回 null', () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_TOKEN;
      writeSecrets({});
      expect(getGitHubToken()).toBeNull();
    });
  });

  describe('isInitialized', () => {
    it('未初始化返回 false', () => {
      expect(isInitialized()).toBe(false);
    });

    it('初始化后返回 true', () => {
      writeConfig(getDefaultConfig());
      expect(isInitialized()).toBe(true);
    });
  });
});
