/**
 * Crash-safe primitives for the project-owned state files.
 *
 * A write is committed by renaming a completed sibling file, so a process
 * interruption leaves either the old complete file or the new complete file.
 */

import fs from 'node:fs';
import path from 'node:path';

const STALE_TRANSACTION_LOCK_MS = 5 * 60 * 1000;

/** Stable error code for a conflicting durable-state transaction. */
export const STATE_LOCKED_CODE = 'STATE_LOCKED';

/**
 * Raised when another process currently owns a durable-state transaction.
 *
 * The typed error keeps the core independent from HTTP while allowing callers
 * such as the API to present this expected, retryable condition as a 409.
 */
export class StateLockConflictError extends Error {
  readonly code = STATE_LOCKED_CODE;

  constructor(filePath: string) {
    super(`状态文件正在被其他进程修改: ${filePath}`);
    this.name = 'StateLockConflictError';
  }
}

export function isStateLockConflictError(error: unknown): error is StateLockConflictError {
  return error instanceof StateLockConflictError ||
    (typeof error === 'object' && error !== null &&
      'code' in error && (error as { code?: unknown }).code === STATE_LOCKED_CODE);
}

export interface AtomicWriteOptions {
  mode?: number;
}

/** Returns the lock file used for a state file transaction. */
export function transactionLockPath(filePath: string): string {
  return `${filePath}.lock`;
}

/** Atomically replace one file with complete content. */
export function atomicWriteFile(
  filePath: string,
  content: string,
  options?: AtomicWriteOptions,
): void {
  const directory = path.dirname(filePath);
  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  fs.mkdirSync(directory, { recursive: true });
  try {
    const descriptor = fs.openSync(tempPath, 'w', options?.mode);
    try {
      fs.writeFileSync(descriptor, content, 'utf-8');
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(tempPath, filePath);
    fsyncDirectory(directory);
  } finally {
    // A failed write or rename must not accumulate partial files.
    fs.rmSync(tempPath, { force: true });
  }
}

function fsyncDirectory(directory: string): void {
  try {
    const descriptor = fs.openSync(directory, 'r');
    try {
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  } catch {
    // Some filesystems do not allow opening directories; rename still gives
    // atomic replacement semantics there.
  }
}

/**
 * Run a short read-modify-write transaction for one state file.
 *
 * The lock deliberately fails fast: callers can surface a conflict instead of
 * silently overwriting data from another CLI or Web-server process.
 */
export function withFileTransaction<T>(filePath: string, operation: () => T): T {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const lockPath = transactionLockPath(filePath);
  const lock = acquireTransactionLock(filePath, lockPath);

  try {
    fs.writeFileSync(lock.descriptor, lock.token, 'utf-8');
    return operation();
  } finally {
    fs.closeSync(lock.descriptor);
    removeTransactionLockIfOwned(lockPath, lock.token);
  }
}

/** Async variant for a transaction that must cover network-backed state work. */
export async function withFileTransactionAsync<T>(
  filePath: string,
  operation: () => Promise<T>,
): Promise<T> {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const lockPath = transactionLockPath(filePath);
  const lock = acquireTransactionLock(filePath, lockPath);

  try {
    fs.writeFileSync(lock.descriptor, lock.token, 'utf-8');
    return await operation();
  } finally {
    fs.closeSync(lock.descriptor);
    removeTransactionLockIfOwned(lockPath, lock.token);
  }
}

function acquireTransactionLock(filePath: string, lockPath: string): { descriptor: number; token: string } {
  const token = `${process.pid}:${Date.now()}:${Math.random().toString(16).slice(2)}\n`;
  try {
    return { descriptor: fs.openSync(lockPath, 'wx', 0o600), token };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;

    try {
      const age = Date.now() - fs.statSync(lockPath).mtimeMs;
      if (age > STALE_TRANSACTION_LOCK_MS && !isLiveLockOwner(lockPath)) {
        fs.rmSync(lockPath, { force: true });
        return { descriptor: fs.openSync(lockPath, 'wx', 0o600), token };
      }
    } catch (retryError) {
      if ((retryError as NodeJS.ErrnoException).code !== 'EEXIST') throw retryError;
    }

    throw new StateLockConflictError(filePath);
  }
}

/**
 * Never steal an old lock from a live local process. Besides being safer for
 * long operations, this prevents an old owner from deleting a lock recovered
 * by another process between its ownership check and cleanup.
 */
function isLiveLockOwner(lockPath: string): boolean {
  try {
    const pid = Number.parseInt(fs.readFileSync(lockPath, 'utf-8').split(':', 1)[0] ?? '', 10);
    if (!Number.isInteger(pid) || pid <= 0) return false;
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to a different user.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function removeTransactionLockIfOwned(lockPath: string, token: string): void {
  try {
    if (fs.readFileSync(lockPath, 'utf-8') === token) {
      fs.rmSync(lockPath, { force: true });
    }
  } catch {
    // A stale-lock recovery may already have replaced or removed this lock.
  }
}
