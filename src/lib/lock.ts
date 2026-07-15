/**
 * skills-lock.json 读写模块
 *
 * skills-lock.json 是全局锁定文件（PRD §5.3）。
 * 是 manifest.yaml 的全局镜像 + 补充字段（tree_sha, installed_at 等）。
 *
 * 性能优化：模块内缓存 lock 文件内容，同一进程内重复调用直接命中内存，
 * 避免每次 getLockEntry/setLockEntry 都全量 readFileSync + JSON.parse。
 * 写操作（writeLock）同步更新缓存与磁盘。
 * lockPath 变化时缓存自动失效（测试隔离场景）。
 */

import fs from 'node:fs';
import { lockPath } from './paths.js';
import { LOCKFILE_VERSION, getCliVersion } from './constants.js';
import type { LockFile, LockEntry } from './types.js';

// ── 内存缓存 ────────────────────────────────────────

let cachedLock: LockFile | null = null;
let cachedPath: string | null = null;

/**
 * 清除 lock 缓存
 *
 * 正常使用无需调用：lockPath 变化时缓存自动失效。
 * 仅在需要强制从磁盘重新读取时使用（如外部进程修改了 lock 文件）。
 */
export function clearLockCache(): void {
  cachedLock = null;
  cachedPath = null;
}

// ── 核心 I/O ────────────────────────────────────────

/**
 * 读取 skills-lock.json
 *
 * 如果文件不存在，返回空结构。
 * 同一进程内重复调用使用内存缓存，避免重复 I/O。
 */
export function readLock(): LockFile {
  const p = lockPath();

  // 缓存命中（路径一致）
  if (cachedPath === p && cachedLock !== null) {
    return cachedLock;
  }

  let lock: LockFile;
  if (!fs.existsSync(p)) {
    lock = {
      lockfileVersion: LOCKFILE_VERSION,
      generatedAt: new Date().toISOString(),
      generator: `skill-sync v${getCliVersion()}`,
      skills: {},
    };
  } else {
    const raw = fs.readFileSync(p, 'utf-8');
    lock = JSON.parse(raw) as LockFile;
  }

  cachedLock = lock;
  cachedPath = p;
  return lock;
}

/**
 * 写入 skills-lock.json
 *
 * 同步更新内存缓存。
 */
export function writeLock(data: LockFile): void {
  const p = lockPath();
  data.generatedAt = new Date().toISOString();
  data.generator = `skill-sync v${getCliVersion()}`;
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  cachedLock = data;
  cachedPath = p;
}

// ── 便捷方法 ────────────────────────────────────────

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
