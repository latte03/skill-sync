/**
 * 配置系统：config.yaml / secrets.yaml 读写
 *
 * 参考 PRD §5.4 配置文件设计
 *
 * 设计要点：
 * - config.yaml: 非敏感配置（默认 Agent、分发模式、日志级别、同步设置等）
 * - secrets.yaml: 敏感配置（GitHub token 等凭证），权限 0600
 * - 灰度测试：通过 SKILL_SYNC_HOME 环境变量重定向到临时目录
 */

import fs from 'node:fs';
import path from 'node:path';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import { configPath, secretsPath, getHomeDir } from './lib/paths.js';
import { DEFAULT_DISTRIBUTION_MODE, DEFAULT_MAX_BACKUPS, DEFAULT_NETWORK_TIMEOUT, DEFAULT_NETWORK_RETRY } from './lib/constants.js';
import type { Config } from './lib/types.js';

/**
 * 默认配置
 */
export function getDefaultConfig(): Config {
  return {
    defaultAgent: undefined,
    distributionMode: 'symlink',
    colorOutput: true,
    logLevel: 'info',
    version: {
      maxBackups: DEFAULT_MAX_BACKUPS,
    },
    sync: {
      github: {
        branch: 'main',
        autoCommit: false,
        commitMessagePrefix: 'skill-sync:',
      },
    },
    conflict: {
      defaultStrategy: 'manual',
    },
    install: {
      allowScripts: 'prompt',
    },
    network: {
      timeout: DEFAULT_NETWORK_TIMEOUT,
      retryCount: DEFAULT_NETWORK_RETRY,
    },
    scanPaths: [],
  };
}

/**
 * 读取 config.yaml
 *
 * 如果文件不存在，返回默认配置
 */
export function readConfig(): Config {
  const p = configPath();
  if (!fs.existsSync(p)) {
    return getDefaultConfig();
  }
  const raw = fs.readFileSync(p, 'utf-8');
  const parsed = (parseYaml(raw) as Config) ?? {};
  // 合并默认值
  return { ...getDefaultConfig(), ...parsed };
}

/**
 * 写入 config.yaml
 */
export function writeConfig(config: Config): void {
  const p = configPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const yamlStr = stringifyYaml(config, { indent: 2 });
  fs.writeFileSync(p, yamlStr, 'utf-8');
}

/**
 * 更新 config.yaml（合并写入）
 */
export function updateConfig(partial: Partial<Config>): Config {
  const current = readConfig();
  const merged = deepMerge(current as unknown as Record<string, unknown>, partial as unknown as Record<string, unknown>) as Config;
  writeConfig(merged);
  return merged;
}

/**
 * 读取 secrets.yaml
 */
export function readSecrets(): Record<string, string> {
  const p = secretsPath();
  if (!fs.existsSync(p)) {
    return {};
  }
  const raw = fs.readFileSync(p, 'utf-8');
  return (parseYaml(raw) as Record<string, string>) ?? {};
}

/**
 * 写入 secrets.yaml（权限 0600）
 */
export function writeSecrets(secrets: Record<string, string>): void {
  const p = secretsPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const yamlStr = stringifyYaml(secrets, { indent: 2 });
  fs.writeFileSync(p, yamlStr, { encoding: 'utf-8', mode: 0o600 });
}

/**
 * 获取 GitHub token（优先 secrets.yaml > 环境变量）
 */
export function getGitHubToken(): string | null {
  // 1. secrets.yaml
  const secrets = readSecrets();
  if (secrets.GITHUB_TOKEN) return secrets.GITHUB_TOKEN;

  // 2. 环境变量
  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (envToken) return envToken;

  return null;
}

/**
 * 检查是否已初始化
 */
export function isInitialized(): boolean {
  return fs.existsSync(configPath());
}

/**
 * 深度合并两个对象
 */
function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overrideVal = override[key];
    if (
      baseVal && typeof baseVal === 'object' && !Array.isArray(baseVal) &&
      overrideVal && typeof overrideVal === 'object' && !Array.isArray(overrideVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      );
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal;
    }
  }
  return result;
}
