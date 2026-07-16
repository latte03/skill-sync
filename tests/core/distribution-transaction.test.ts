import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  beginDistributionJournal,
  beginRemovalJournal,
  recoverInterruptedDistribution,
  recoverInterruptedRemoval,
} from '../../src/core/distribution-transaction.js';
import { getLockEntry, removeLockEntry, setLockEntry } from '../../src/lib/lock.js';
import { createManifestFromFrontmatter, readManifest, writeManifest } from '../../src/lib/manifest.js';
import { recoverManagedState } from '../../src/core/state-recovery.js';
import { setupTestEnv, cleanupTestEnv } from '../test-utils.js';

describe('distribution removal recovery journal', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = setupTestEnv().tempDir;
    setLockEntry('local/test', {
      source: { type: 'local' },
      version: '1.0.0',
      installedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      distribution: {},
    });
  });

  afterEach(() => {
    cleanupTestEnv();
  });

  it('restores moved directories when durable removal state was not committed', () => {
    const destination = path.join(tempDir, 'agent-skill');
    const previous = path.join(tempDir, '.agent-skill.distribution-previous-crash');
    fs.mkdirSync(destination);
    fs.writeFileSync(path.join(destination, 'SKILL.md'), 'original');
    const journal = beginRemovalJournal('local/test');
    journal.prepareMove(destination, previous);
    fs.renameSync(destination, previous);

    expect(recoverInterruptedRemoval()).toEqual({ restored: 1, cleaned: 0 });
    expect(fs.readFileSync(path.join(destination, 'SKILL.md'), 'utf-8')).toBe('original');
    expect(fs.existsSync(previous)).toBe(false);
  });

  it('cleans moved-aside directories when lock removal was already committed', () => {
    const destination = path.join(tempDir, 'agent-skill');
    const previous = path.join(tempDir, '.agent-skill.distribution-previous-crash');
    fs.mkdirSync(destination);
    const journal = beginRemovalJournal('local/test');
    journal.prepareMove(destination, previous);
    fs.renameSync(destination, previous);
    removeLockEntry('local/test');

    expect(recoverInterruptedRemoval()).toEqual({ restored: 0, cleaned: 1 });
    expect(fs.existsSync(destination)).toBe(false);
    expect(fs.existsSync(previous)).toBe(false);
  });
});

describe('distribution batch recovery journal', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = setupTestEnv().tempDir;
    setLockEntry('local/test', {
      source: { type: 'local' },
      version: '1.0.0',
      installedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      distribution: {},
    });
  });

  afterEach(() => {
    cleanupTestEnv();
  });

  it('restores Agent directories and metadata when a batch did not commit', () => {
    const { originalManifest, originalLockEntry, expectedManifest, expectedLockEntry } = createDistributionStates();
    const destination = path.join(tempDir, 'agent-skill');
    const previous = path.join(tempDir, '.agent-skill.distribution-previous-crash');
    fs.mkdirSync(destination);
    fs.writeFileSync(path.join(destination, 'SKILL.md'), 'original');
    const journal = beginDistributionJournal(
      'local/test', originalManifest, originalLockEntry, expectedManifest, expectedLockEntry,
    );
    journal.prepareMove(destination, previous);
    fs.renameSync(destination, previous);
    fs.mkdirSync(destination);
    fs.writeFileSync(path.join(destination, 'SKILL.md'), 'replacement');

    expect(recoverManagedState()).toEqual({ restored: 1, cleaned: 0 });
    expect(fs.readFileSync(path.join(destination, 'SKILL.md'), 'utf-8')).toBe('original');
    expect(readManifest('local/test')).toEqual(originalManifest);
    expect(getLockEntry('local/test')).toEqual(originalLockEntry);
  });

  it('keeps committed replacements and only cleans their old directories', () => {
    const { originalManifest, originalLockEntry, expectedManifest, expectedLockEntry } = createDistributionStates();
    const destination = path.join(tempDir, 'agent-skill');
    const previous = path.join(tempDir, '.agent-skill.distribution-previous-crash');
    fs.mkdirSync(destination);
    fs.writeFileSync(path.join(destination, 'SKILL.md'), 'original');
    const journal = beginDistributionJournal(
      'local/test', originalManifest, originalLockEntry, expectedManifest, expectedLockEntry,
    );
    journal.prepareMove(destination, previous);
    fs.renameSync(destination, previous);
    fs.mkdirSync(destination);
    fs.writeFileSync(path.join(destination, 'SKILL.md'), 'replacement');
    writeManifest('local/test', expectedManifest);
    setLockEntry('local/test', expectedLockEntry);

    expect(recoverInterruptedDistribution()).toEqual({ restored: 0, cleaned: 1 });
    expect(fs.readFileSync(path.join(destination, 'SKILL.md'), 'utf-8')).toBe('replacement');
    expect(fs.existsSync(previous)).toBe(false);
  });

  it('removes a newly created destination when the batch never committed', () => {
    const { originalManifest, originalLockEntry, expectedManifest, expectedLockEntry } = createDistributionStates();
    const destination = path.join(tempDir, 'new-agent-skill');
    const journal = beginDistributionJournal(
      'local/test', originalManifest, originalLockEntry, expectedManifest, expectedLockEntry,
    );
    journal.prepareMove(destination);
    fs.mkdirSync(destination);

    expect(recoverInterruptedDistribution()).toEqual({ restored: 1, cleaned: 0 });
    expect(fs.existsSync(destination)).toBe(false);
  });
});

function createDistributionStates() {
  const originalManifest = createManifestFromFrontmatter({}, 'test-skill', {
    type: 'local',
    installedVia: 'cli',
  });
  writeManifest('local/test', originalManifest);
  const originalLockEntry = structuredClone(getLockEntry('local/test')!);
  const expectedManifest = structuredClone(originalManifest);
  expectedManifest.distribution.targets.push({
    agent: 'claude-code',
    path: '/tmp/agent-skill',
    mode: 'symlink',
    version: '1.0.0',
    distributedAt: '2024-01-01T00:00:00Z',
    sourceHash: 'source-hash',
    managed: true,
  });
  const expectedLockEntry = structuredClone(originalLockEntry);
  expectedLockEntry.distribution['claude-code'] = {
    mode: 'symlink',
    distributedAt: '2024-01-01T00:00:00Z',
    sourceHash: 'source-hash',
    managed: true,
  };
  return { originalManifest, originalLockEntry, expectedManifest, expectedLockEntry };
}
