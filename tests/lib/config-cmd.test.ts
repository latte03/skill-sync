/**
 * config 命令 + 配置系统测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readConfig, writeConfig, getDefaultConfig, updateConfig } from '../../src/config.js';
import { configPath } from '../../src/lib/paths.js';
import fs from 'node:fs';
import { setupTestEnv, cleanupTestEnv } from '../test-utils.js';

describe('config system', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(() => {
    cleanupTestEnv();
  });

  it('getDefaultConfig 返回默认配置', () => {
    const config = getDefaultConfig();
    expect(config.distributionMode).toBe('symlink');
    expect(config.colorOutput).toBe(true);
    expect(config.logLevel).toBe('info');
    expect(config.version?.maxBackups).toBe(5);
  });

  it('readConfig 文件不存在时返回默认配置', () => {
    const config = readConfig();
    expect(config.distributionMode).toBe('symlink');
  });

  it('writeConfig + readConfig 往返', () => {
    const config = getDefaultConfig();
    config.defaultAgent = 'claude-code';
    writeConfig(config);

    const read = readConfig();
    expect(read.defaultAgent).toBe('claude-code');
  });

  it('updateConfig 合并写入', () => {
    updateConfig({ defaultAgent: 'cursor' });
    const config = readConfig();
    expect(config.defaultAgent).toBe('cursor');
    // 原有配置不丢失
    expect(config.distributionMode).toBe('symlink');
  });

  it('writeConfig 创建目录', () => {
    // 删除目录
    const dir = configPath();
    if (fs.existsSync(dir)) {
      fs.rmSync(dir);
    }

    writeConfig(getDefaultConfig());
    expect(fs.existsSync(configPath())).toBe(true);
  });
});
