import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  atomicWriteFile,
  transactionLockPath,
  withFileTransaction,
} from '../../src/lib/persistence.js';
import { cleanupTestEnv, setupTestEnv } from '../test-utils.js';

describe('persistent file operations', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = setupTestEnv().tempDir;
  });

  afterEach(() => {
    cleanupTestEnv();
  });

  it('replaces an existing file without leaving a temporary file', () => {
    const target = path.join(tempDir, 'state.yaml');
    fs.writeFileSync(target, 'old: true\n');

    atomicWriteFile(target, 'new: true\n');

    expect(fs.readFileSync(target, 'utf-8')).toBe('new: true\n');
    expect(fs.readdirSync(tempDir).some(name => name.includes('.tmp-'))).toBe(false);
  });

  it('creates parent directories before taking the transaction lock', () => {
    const target = path.join(tempDir, 'nested', 'state.yaml');

    withFileTransaction(target, () => atomicWriteFile(target, 'ready: true\n'));

    expect(fs.readFileSync(target, 'utf-8')).toBe('ready: true\n');
  });

  it('keeps the existing destination intact when the final replace cannot complete', () => {
    const target = path.join(tempDir, 'state.yaml');
    fs.mkdirSync(target);

    expect(() => atomicWriteFile(target, 'new: true\n')).toThrow();

    expect(fs.statSync(target).isDirectory()).toBe(true);
    expect(fs.readdirSync(tempDir).some(name => name.includes('.tmp-'))).toBe(false);
  });

  it('rejects a second writer while a transaction lock exists', () => {
    const target = path.join(tempDir, 'skills-lock.json');
    fs.writeFileSync(transactionLockPath(target), 'another process');

    expect(() => withFileTransaction(target, () => undefined)).toThrow('正在被其他进程修改');
  });

  it('recovers an expired transaction lock left by an interrupted process', () => {
    const target = path.join(tempDir, 'skills-lock.json');
    const lockPath = transactionLockPath(target);
    fs.writeFileSync(lockPath, 'crashed process');
    const staleTime = new Date(Date.now() - 10 * 60 * 1000);
    fs.utimesSync(lockPath, staleTime, staleTime);

    expect(withFileTransaction(target, () => 'recovered')).toBe('recovered');
  });

  it('releases the transaction lock when the operation throws', () => {
    const target = path.join(tempDir, 'skills-lock.json');

    expect(() => withFileTransaction(target, () => {
      throw new Error('interrupted');
    })).toThrow('interrupted');

    expect(fs.existsSync(transactionLockPath(target))).toBe(false);
    expect(withFileTransaction(target, () => 'recovered')).toBe('recovered');
  });

  it('does not remove a lock that was replaced by stale-lock recovery', () => {
    const target = path.join(tempDir, 'skills-lock.json');
    const lockPath = transactionLockPath(target);

    withFileTransaction(target, () => {
      fs.writeFileSync(lockPath, 'replacement owner');
    });

    expect(fs.readFileSync(lockPath, 'utf-8')).toBe('replacement owner');
  });
});
