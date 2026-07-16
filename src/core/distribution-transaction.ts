/**
 * Reversible filesystem steps used by distribution operations.
 *
 * State files remain the source of truth; Agent and repository paths are first
 * moved aside and deleted only after their matching state transition commits.
 */

import fs from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { getLockEntry, setLockEntry } from '../lib/lock.js';
import { readManifest, writeManifest } from '../lib/manifest.js';
import { homePath, lockPath, manifestPath } from '../lib/paths.js';
import { atomicWriteFile, StateLockConflictError, transactionLockPath } from '../lib/persistence.js';
import type { LockEntry, Manifest } from '../lib/types.js';

export interface ReplacedDestination {
  commit(): void;
  rollback(): void;
}

interface RemovalJournal {
  name: string;
  entries: Array<{ destination: string; previous: string }>;
}

interface DistributionJournal {
  name: string;
  originalManifest: Manifest;
  originalLockEntry: LockEntry;
  expectedManifest: Manifest;
  expectedLockEntry: LockEntry;
  entries: Array<{ destination: string; previous?: string }>;
}

export interface RemovalJournalHandle {
  prepareMove(destination: string, previous?: string): void;
  clear(): void;
}

export interface DistributionJournalHandle extends RemovalJournalHandle {}

/** Durable intent log for a multi-directory central deletion. */
export function beginRemovalJournal(name: string): RemovalJournalHandle {
  const journal: RemovalJournal = { name, entries: [] };
  const journalPath = removalJournalPath();
  persistJournal(journalPath, journal);
  return {
    prepareMove(destination, previous) {
      if (!previous) return;
      journal.entries.push({ destination, previous });
      persistJournal(journalPath, journal);
    },
    clear() {
      fs.rmSync(journalPath, { force: true });
    },
  };
}

/** Durable intent log for an atomic deploy or undeploy batch. */
export function beginDistributionJournal(
  name: string,
  originalManifest: Manifest,
  originalLockEntry: LockEntry,
  expectedManifest: Manifest,
  expectedLockEntry: LockEntry,
): DistributionJournalHandle {
  const journal: DistributionJournal = {
    name,
    originalManifest,
    originalLockEntry,
    expectedManifest,
    expectedLockEntry,
    entries: [],
  };
  const journalPath = distributionJournalPath();
  persistJournal(journalPath, journal);
  return {
    prepareMove(destination, previous) {
      journal.entries.push({ destination, previous });
      persistJournal(journalPath, journal);
    },
    clear() {
      fs.rmSync(journalPath, { force: true });
    },
  };
}

/**
 * Complete a batch distribution that durably committed, or restore an
 * incomplete batch to its original paths and metadata.
 */
export function recoverInterruptedDistribution(): { restored: number; cleaned: number } {
  const journalPath = distributionJournalPath();
  if (!fs.existsSync(journalPath)) return { restored: 0, cleaned: 0 };

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8')) as DistributionJournal;
  const committed = distributionStateMatches(journal);
  let restored = 0;
  let cleaned = 0;

  for (const entry of [...journal.entries].reverse()) {
    if (committed) {
      if (entry.previous && fs.existsSync(entry.previous)) {
        fs.rmSync(entry.previous, { recursive: true, force: true });
        cleaned++;
      }
      continue;
    }

    if (entry.previous && fs.existsSync(entry.previous)) {
      fs.rmSync(entry.destination, { recursive: true, force: true });
      fs.renameSync(entry.previous, entry.destination);
      restored++;
    } else if (!entry.previous && fs.existsSync(entry.destination)) {
      fs.rmSync(entry.destination, { recursive: true, force: true });
      restored++;
    }
  }

  if (!committed) {
    writeManifest(journal.name, journal.originalManifest);
    setLockEntry(journal.name, journal.originalLockEntry);
  }
  fs.rmSync(journalPath, { force: true });
  return { restored, cleaned };
}

/** Recover a deletion interrupted after one or more directories were moved aside. */
export function recoverInterruptedRemoval(): { restored: number; cleaned: number } {
  const journalPath = removalJournalPath();
  if (!fs.existsSync(journalPath)) return { restored: 0, cleaned: 0 };

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8')) as RemovalJournal;
  const removalCommitted = getLockEntry(journal.name) === null;
  let restored = 0;
  let cleaned = 0;

  for (const entry of [...journal.entries].reverse()) {
    if (!fs.existsSync(entry.previous)) continue;
    if (removalCommitted) {
      fs.rmSync(entry.previous, { recursive: true, force: true });
      cleaned++;
    } else {
      fs.rmSync(entry.destination, { recursive: true, force: true });
      fs.renameSync(entry.previous, entry.destination);
      restored++;
    }
  }
  fs.rmSync(journalPath, { force: true });
  return { restored, cleaned };
}

/** Fail before changing a directory if either durable state file is locked. */
export function assertDistributionStateUnlocked(name: string): void {
  const locked = [manifestPath(name), lockPath()]
    .map(transactionLockPath)
    .find(fs.existsSync);
  if (locked) throw new StateLockConflictError(locked.slice(0, -'.lock'.length));
}

/**
 * Move the current destination aside, create its replacement, then either
 * commit deletion of the previous target or restore it on a later failure.
 */
export function replaceDestination(
  destination: string,
  createReplacement: () => void,
  options?: { beforeMove?: (destination: string, previous?: string) => void },
): ReplacedDestination {
  const previous = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.distribution-previous-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  let hadPrevious = false;
  try {
    fs.lstatSync(destination);
    options?.beforeMove?.(destination, previous);
    fs.renameSync(destination, previous);
    hadPrevious = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    options?.beforeMove?.(destination);
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

function removalJournalPath(): string {
  return homePath('.distribution-remove.transaction.json');
}

function distributionJournalPath(): string {
  return homePath('.distribution.transaction.json');
}

function distributionStateMatches(journal: DistributionJournal): boolean {
  try {
    return isDeepStrictEqual(readManifest(journal.name), journal.expectedManifest) &&
      isDeepStrictEqual(getLockEntry(journal.name), journal.expectedLockEntry);
  } catch {
    return false;
  }
}

function persistJournal(journalPath: string, journal: RemovalJournal | DistributionJournal): void {
  atomicWriteFile(journalPath, JSON.stringify(journal, null, 2) + '\n');
}
