/**
 * Reversible filesystem steps used by distribution operations.
 *
 * State files remain the source of truth; Agent and repository paths are first
 * moved aside and deleted only after their matching state transition commits.
 */

import fs from 'node:fs';
import path from 'node:path';
import { lockPath, manifestPath } from '../lib/paths.js';
import { transactionLockPath } from '../lib/persistence.js';

export interface ReplacedDestination {
  commit(): void;
  rollback(): void;
}

/** Fail before changing a directory if either durable state file is locked. */
export function assertDistributionStateUnlocked(name: string): void {
  const locked = [manifestPath(name), lockPath()]
    .map(transactionLockPath)
    .find(fs.existsSync);
  if (locked) throw new Error(`状态文件正在被其他进程修改: ${locked.slice(0, -'.lock'.length)}`);
}

/**
 * Move the current destination aside, create its replacement, then either
 * commit deletion of the previous target or restore it on a later failure.
 */
export function replaceDestination(
  destination: string,
  createReplacement: () => void,
): ReplacedDestination {
  const previous = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.distribution-previous-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  let hadPrevious = false;
  try {
    fs.lstatSync(destination);
    fs.renameSync(destination, previous);
    hadPrevious = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  try {
    createReplacement();
  } catch (error) {
    // copyDirRecursive can leave a partial destination before throwing.
    fs.rmSync(destination, { recursive: true, force: true });
    if (hadPrevious) fs.renameSync(previous, destination);
    throw error;
  }

  return {
    commit: () => {
      if (hadPrevious) fs.rmSync(previous, { recursive: true, force: true });
    },
    rollback: () => {
      fs.rmSync(destination, { recursive: true, force: true });
      if (hadPrevious) fs.renameSync(previous, destination);
    },
  };
}
