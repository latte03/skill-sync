/** Filesystem primitives shared by distribution and update operations. */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { copyDirRecursive } from '../lib/fs-utils.js';
import type { DeployMode, UserDeployMode } from '../lib/types.js';

/** Resolve the platform-specific deployment mode. */
export function resolveDeployMode(userMode: UserDeployMode | undefined): DeployMode {
  if (userMode === 'copy') return 'copy';
  return process.platform === 'win32' ? 'junction' : 'symlink';
}

/** Create a symlink, junction, or managed copy at a destination. */
export function createLink(src: string, dest: string, mode: DeployMode): void {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let exists = false;
  try {
    fs.lstatSync(dest);
    exists = true;
  } catch {
    // The destination does not yet exist.
  }
  if (exists) removeLink(dest);

  switch (mode) {
    case 'symlink':
      fs.symlinkSync(src, dest, 'dir');
      break;
    case 'junction':
      fs.symlinkSync(src, dest, 'junction');
      break;
    case 'copy':
      copyDirRecursive(src, dest);
      break;
  }
}

/** Remove a link, directory, or ordinary file without following symlinks. */
export function removeLink(dest: string): void {
  const lstat = fs.lstatSync(dest);
  if (lstat.isSymbolicLink()) fs.unlinkSync(dest);
  else if (lstat.isDirectory()) fs.rmSync(dest, { recursive: true, force: true });
  else fs.unlinkSync(dest);
}

/** Hash a skill directory while excluding retained update backups. */
export function computeSourceHash(dir: string): string {
  const hash = crypto.createHash('sha256');
  const names = fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.name !== '.backup')
    .map(entry => entry.name)
    .sort();

  for (const name of names) {
    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      hash.update(name + '/');
      hash.update(computeSourceHash(fullPath));
    } else {
      hash.update(name);
      hash.update(fs.readFileSync(fullPath));
    }
  }
  return hash.digest('hex');
}
