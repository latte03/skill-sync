/**
 * 全局常量定义
 */

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

// CLI 版本
export const CLI_VERSION = '0.1.0';
