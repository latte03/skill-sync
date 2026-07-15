/**
 * 全局常量定义
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 文件名常量
export const CONFIG_FILE = 'config.yaml';
export const SECRETS_FILE = 'secrets.yaml';
export const LOCK_FILE = 'skills-lock.json';
export const TAGS_FILE = 'tags.yaml';
export const SKILLS_DIR = 'skills';
export const CACHE_DIR = 'cache';
export const TEMP_DIR = 'temp';
export const BACKUP_DIR = '.backup';
export const MANIFEST_FILE = 'manifest.yaml';
export const SKILL_MD_FILE = 'SKILL.md';

// 锁文件版本
export const LOCKFILE_VERSION = 2;

// 默认配置值
export const DEFAULT_MAX_BACKUPS = 5;
export const DEFAULT_NETWORK_TIMEOUT = 15000;
export const DEFAULT_NETWORK_RETRY = 3;
export const DEFAULT_DISTRIBUTION_MODE = 'symlink' as const;

// GitHub API 常量
export const GITHUB_API_BASE = 'https://api.github.com';
export const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';
export const SKILLS_SH_API_BASE = 'https://skills.sh/api';

// CLI 版本（从 package.json 动态读取，避免手动维护）
// 延迟读取，避免模块加载时的同步 I/O 副作用
let _cliVersion: string | null = null;

export function getCliVersion(): string {
  if (_cliVersion !== null) return _cliVersion;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.join(__dirname, '..', '..', 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    _cliVersion = pkg.version as string;
  } catch {
    _cliVersion = '0.0.0';
  }
  return _cliVersion;
}
