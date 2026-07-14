/**
 * skills-lock.json 读写模块
 *
 * skills-lock.json 是全局锁定文件（PRD §5.3）。
 * 是 manifest.yaml 的全局镜像 + 补充字段（tree_sha, installed_at 等）。
 */

import fs from 'node:fs';
import { lockPath } from './paths.js';
import { LOCKFILE_VERSION, CLI_VERSION } from './constants.js';
import type { LockFile, LockEntry } from './types.js';

/**
 * 读取 skills-lock.json
 *
 * 如果文件不存在，返回空结构
 */
export function readLock(): LockFile {
  const p = lockPath();
  if (!fs.existsSync(p)) {
    return {
      lockfileVersion: LOCKFILE_VERSION,
      generatedAt: new Date().toISOString(),
      generator: `skill-sync v${CLI_VERSION}`,
      skills: {},
    };
  }
  const raw = fs.readFileSync(p, 'utf-8');
  return JSON.parse(raw) as LockFile;
}

/**
 * 写入 skills-lock.json
 */
export function writeLock(data: LockFile): void {
  const p = lockPath();
  data.generatedAt = new Date().toISOString();
  data.generator = `skill-sync v${CLI_VERSION}`;
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * 获取 lock 中的某个 skill 条目
 */
export function getLockEntry(name: string): LockEntry | null {
  const lock = readLock();
  return lock.skills[name] ?? null;
}

/**
 * 设置/更新 lock 中的某个 skill 条目
 */
export function setLockEntry(name: string, entry: LockEntry): void {
  const lock = readLock();
  lock.skills[name] = entry;
  writeLock(lock);
}

/**
 * 删除 lock 中的某个 skill 条目
 */
export function removeLockEntry(name: string): void {
  const lock = readLock();
  delete lock.skills[name];
  writeLock(lock);
}

/**
 * 检查 lock 中是否存在某个 skill
 */
export function hasLockEntry(name: string): boolean {
  return getLockEntry(name) !== null;
}

/**
 * 获取 lock 中所有 skill 名称
 */
export function getAllLockSkillNames(): string[] {
  const lock = readLock();
  return Object.keys(lock.skills);
}
