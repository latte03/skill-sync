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
import { atomicWriteFile, withFileTransaction } from './persistence.js';
import type { LockFile, LockEntry } from './types.js';

// ── 内存缓存 ────────────────────────────────────────

let cachedLock: LockFile | null = null;
let cachedPath: string | null = null;
let cachedFingerprint: string | null = null;

/**
 * 清除 lock 缓存
 *
 * 正常使用无需调用：lockPath 变化时缓存自动失效。
 * 仅在需要强制从磁盘重新读取时使用（如外部进程修改了 lock 文件）。
 */
export function clearLockCache(): void {
  cachedLock = null;
  cachedPath = null;
  cachedFingerprint = null;
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
  const fingerprint = getFileFingerprint(p);

  // 缓存命中（路径和磁盘版本一致）。保留缓存，同时能感知其他进程的原子替换。
  if (cachedPath === p && cachedFingerprint === fingerprint && cachedLock !== null) {
    return cachedLock;
  }

  const lock = readLockFromDisk(p);

  cachedLock = lock;
  cachedPath = p;
  cachedFingerprint = fingerprint;
  return lock;
}

/**
 * 写入 skills-lock.json
 *
 * 同步更新内存缓存。
 */
export function writeLock(data: LockFile): void {
  const p = lockPath();
  withFileTransaction(p, () => persistLock(p, data));
}

/** Execute one read-modify-write transaction against the latest lock data. */
export function updateLock(mutator: (lock: LockFile) => void): LockFile {
  const p = lockPath();
  return withFileTransaction(p, () => {
    const lock = readLockFromDisk(p);
    mutator(lock);
    persistLock(p, lock);
    return lock;
  });
}

function persistLock(p: string, data: LockFile): void {
  data.generatedAt = new Date().toISOString();
  data.generator = `skill-sync v${getCliVersion()}`;
  atomicWriteFile(p, JSON.stringify(data, null, 2) + '\n');
  cachedLock = data;
  cachedPath = p;
  cachedFingerprint = getFileFingerprint(p);
}

function readLockFromDisk(p: string): LockFile {
  if (!fs.existsSync(p)) {
    return {
      lockfileVersion: LOCKFILE_VERSION,
      generatedAt: new Date().toISOString(),
      generator: `skill-sync v${getCliVersion()}`,
      skills: {},
    };
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as LockFile;
}

function getFileFingerprint(p: string): string {
  try {
    const stat = fs.statSync(p);
    return `${stat.ino}:${stat.mtimeMs}:${stat.size}`;
  } catch {
    return 'missing';
  }
}

// ── 便捷方法 ────────────────────────────────────────

/**
 * 获取 lock 中的某个 skill 条目
 */
export function getLockEntry(name: string): LockEntry | null {
  const lock = readLock();
  const entry = lock.skills[name];
  return entry ? structuredClone(entry) : null;
}

/**
 * 设置/更新 lock 中的某个 skill 条目
 */
export function setLockEntry(name: string, entry: LockEntry): void {
  updateLock(lock => {
    // Callers that replace an entry (notably remove/update rollback) need an
    // exact snapshot write; implicit merging can resurrect removed targets.
    lock.skills[name] = structuredClone(entry);
  });
}

/** Atomically update just one current lock entry without stale read-modify-write. */
export function updateLockEntry(name: string, mutator: (entry: LockEntry) => void): LockEntry {
  let updated: LockEntry | undefined;
  updateLock(lock => {
    const entry = lock.skills[name];
    if (!entry) throw new Error(`Skill 未找到: ${name}`);
    mutator(entry);
    updated = structuredClone(entry);
  });
  return updated!;
}

/**
 * 删除 lock 中的某个 skill 条目
 */
export function removeLockEntry(name: string): void {
  updateLock(lock => {
    delete lock.skills[name];
  });
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
