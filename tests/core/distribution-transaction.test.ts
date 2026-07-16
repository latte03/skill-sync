import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  beginRemovalJournal,
  recoverInterruptedRemoval,
} from '../../src/core/distribution-transaction.js';
import { removeLockEntry, setLockEntry } from '../../src/lib/lock.js';
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
