import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestContext } from '../../src/core/context.js';
import { installGitHubSkill } from '../../src/core/installer.js';
import { updateSkill } from '../../src/core/version-manager.js';
import { addTag } from '../../src/lib/tags.js';
import { readManifest } from '../../src/lib/manifest.js';
import { deploySkill, listBackups } from '../../src/core/skill-manager.js';
import { skillRepoPath } from '../../src/lib/paths.js';
import { getAgentSkillDir } from '../../src/lib/agents.js';
import { cleanupTestEnv, setupTestEnv } from '../test-utils.js';

vi.mock('../../src/lib/github.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/lib/github.js')>();
  return {
    ...actual,
    getDefaultBranch: vi.fn(async () => 'main'),
    getRepoTree: vi.fn(),
    downloadRawFile: vi.fn(),
  };
});

import * as github from '../../src/lib/github.js';

const getRepoTree = vi.mocked(github.getRepoTree);
const downloadRawFile = vi.mocked(github.downloadRawFile);

describe('GitHub installation and update', () => {
  let homeDir: string;
  let currentFiles: Record<string, string>;

  const key = 'acme/catalog/skills/pdf';
  const tree = (paths: string[]) => ({
    sha: `commit-${paths.length}`,
    tree: paths.map(filePath => ({ path: filePath, type: 'blob' as const, sha: `sha-${filePath}` })),
  });

  beforeEach(() => {
    homeDir = setupTestEnv().homeDir;
    currentFiles = {};
    getRepoTree.mockImplementation(async () => tree(Object.keys(currentFiles)));
    downloadRawFile.mockImplementation(async (_owner, _repo, filePath) => {
      const content = currentFiles[filePath];
      if (content === undefined) throw new Error(`missing remote file: ${filePath}`);
      return content;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanupTestEnv();
  });

  it('stores the complete GitHub location in the manifest and downloads its snapshot', async () => {
    currentFiles = {
      'skills/pdf/SKILL.md': '---\nname: pdf\nversion: 1.0.0\ndescription: PDF\n---\n# PDF\n',
      'skills/pdf/guide.md': 'guide',
    };

    const result = await installGitHubSkill(createTestContext(), 'acme/catalog/skills/pdf', {
      noDeploy: true,
      ignoreDeps: true,
    });

    expect(result.name).toBe(key);
    expect(readManifest(key).source).toMatchObject({
      type: 'github', owner: 'acme', repo: 'catalog', skillPath: 'skills/pdf',
    });
    expect(fs.readFileSync(path.join(skillRepoPath(key), 'guide.md'), 'utf-8')).toBe('guide');
  });

  it('keeps the previous snapshot untouched when a remote download fails', async () => {
    const repoPath = skillRepoPath(key);
    fs.mkdirSync(repoPath, { recursive: true });
    fs.writeFileSync(path.join(repoPath, 'old.md'), 'preserve');
    currentFiles = {
      'skills/pdf/SKILL.md': '---\nname: pdf\n---\n# PDF\n',
      'skills/pdf/guide.md': 'guide',
    };
    downloadRawFile.mockImplementation(async (_owner, _repo, filePath) => {
      if (filePath.endsWith('guide.md')) throw new Error('network interrupted');
      return currentFiles[filePath]!;
    });

    await expect(installGitHubSkill(createTestContext(), 'acme/catalog/skills/pdf', {
      noDeploy: true,
      ignoreDeps: true,
      targetKey: key,
    })).rejects.toThrow('network interrupted');

    expect(fs.readFileSync(path.join(repoPath, 'old.md'), 'utf-8')).toBe('preserve');
  });

  it('restores the previous snapshot when committing the staged download fails', async () => {
    const repoPath = skillRepoPath(key);
    fs.mkdirSync(repoPath, { recursive: true });
    fs.writeFileSync(path.join(repoPath, 'old.md'), 'preserve');
    currentFiles = { 'skills/pdf/SKILL.md': '---\nname: pdf\n---\n# PDF\n' };

    const originalRename = fs.renameSync.bind(fs);
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (String(from).includes('.staging-') && path.resolve(String(to)) === repoPath) {
        throw new Error('replace blocked');
      }
      return originalRename(from, to);
    });

    await expect(installGitHubSkill(createTestContext(), 'acme/catalog/skills/pdf', {
      noDeploy: true,
      ignoreDeps: true,
      targetKey: key,
    })).rejects.toThrow('replace blocked');
    renameSpy.mockRestore();

    expect(fs.readFileSync(path.join(repoPath, 'old.md'), 'utf-8')).toBe('preserve');
  });

  it('updates to a complete remote snapshot while preserving local metadata and backups', async () => {
    currentFiles = {
      'skills/pdf/SKILL.md': '---\nname: pdf\nversion: 1.0.0\n---\n# PDF v1\n',
      'skills/pdf/obsolete.md': 'remove on update',
    };
    const ctx = createTestContext();
    await installGitHubSkill(ctx, 'acme/catalog/skills/pdf', { noDeploy: true, ignoreDeps: true });
    addTag(key, 'document');

    currentFiles = {
      'skills/pdf/SKILL.md': '---\nname: pdf\nversion: 2.0.0\n---\n# PDF v2\n',
    };
    const result = await updateSkill(ctx, key);

    expect(result.success).toBe(true);
    expect(fs.existsSync(path.join(skillRepoPath(key), 'obsolete.md'))).toBe(false);
    expect(readManifest(key).tags).toEqual(['document']);
    expect(listBackups(key)).toHaveLength(1);
  });

  it('updates every unchanged managed copy from the new remote snapshot', async () => {
    currentFiles = {
      'skills/pdf/SKILL.md': '---\nname: pdf\nversion: 1.0.0\n---\n# PDF v1\n',
      'skills/pdf/obsolete.md': 'remove on update',
    };
    const ctx = createTestContext();
    await installGitHubSkill(ctx, 'acme/catalog/skills/pdf', { noDeploy: true, ignoreDeps: true });
    deploySkill(ctx, key, 'cursor', { mode: 'copy' });
    const copyPath = path.join(getAgentSkillDir('cursor'), key);

    currentFiles = {
      'skills/pdf/SKILL.md': '---\nname: pdf\nversion: 2.0.0\n---\n# PDF v2\n',
    };
    const result = await updateSkill(ctx, key);

    expect(result.success).toBe(true);
    expect(fs.readFileSync(path.join(copyPath, 'SKILL.md'), 'utf-8')).toContain('PDF v2');
    expect(fs.existsSync(path.join(copyPath, 'obsolete.md'))).toBe(false);
  });

  it('rejects an update before replacing the central snapshot when a managed copy was edited', async () => {
    currentFiles = {
      'skills/pdf/SKILL.md': '---\nname: pdf\nversion: 1.0.0\n---\n# PDF v1\n',
    };
    const ctx = createTestContext();
    await installGitHubSkill(ctx, 'acme/catalog/skills/pdf', { noDeploy: true, ignoreDeps: true });
    deploySkill(ctx, key, 'cursor', { mode: 'copy' });
    const copyPath = path.join(getAgentSkillDir('cursor'), key, 'SKILL.md');
    fs.appendFileSync(copyPath, '\nmanual change\n');

    currentFiles = {
      'skills/pdf/SKILL.md': '---\nname: pdf\nversion: 2.0.0\n---\n# PDF v2\n',
    };

    await expect(updateSkill(ctx, key)).rejects.toThrow('受管 copy 已被手动修改');
    expect(fs.readFileSync(path.join(skillRepoPath(key), 'SKILL.md'), 'utf-8')).toContain('PDF v1');
    expect(fs.readFileSync(copyPath, 'utf-8')).toContain('manual change');
  });

  it('force-updates a manually edited managed copy when explicitly requested', async () => {
    currentFiles = {
      'skills/pdf/SKILL.md': '---\nname: pdf\nversion: 1.0.0\n---\n# PDF v1\n',
    };
    const ctx = createTestContext();
    await installGitHubSkill(ctx, 'acme/catalog/skills/pdf', { noDeploy: true, ignoreDeps: true });
    deploySkill(ctx, key, 'cursor', { mode: 'copy' });
    const copyPath = path.join(getAgentSkillDir('cursor'), key, 'SKILL.md');
    fs.appendFileSync(copyPath, '\nmanual change\n');
    currentFiles = {
      'skills/pdf/SKILL.md': '---\nname: pdf\nversion: 2.0.0\n---\n# PDF v2\n',
    };

    const result = await updateSkill(ctx, key, { force: true });

    expect(result.success).toBe(true);
    expect(fs.readFileSync(copyPath, 'utf-8')).toContain('PDF v2');
    expect(fs.readFileSync(copyPath, 'utf-8')).not.toContain('manual change');
  });

  it('rolls a failed replacement back to the backed-up central snapshot', async () => {
    currentFiles = {
      'skills/pdf/SKILL.md': '---\nname: pdf\nversion: 1.0.0\n---\n# PDF v1\n',
    };
    const ctx = createTestContext();
    await installGitHubSkill(ctx, 'acme/catalog/skills/pdf', { noDeploy: true, ignoreDeps: true });
    currentFiles = {
      'skills/pdf/SKILL.md': '---\nname: pdf\nversion: 2.0.0\n---\n# PDF v2\n',
    };

    const repoPath = skillRepoPath(key);
    const originalRename = fs.renameSync.bind(fs);
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (String(from).includes('.staging-') && path.resolve(String(to)) === repoPath) {
        throw new Error('replace blocked');
      }
      return originalRename(from, to);
    });
    const result = await updateSkill(ctx, key);
    renameSpy.mockRestore();

    expect(result.success).toBe(false);
    expect(result.error).toContain('已恢复更新前版本');
    expect(fs.readFileSync(path.join(repoPath, 'SKILL.md'), 'utf-8')).toContain('PDF v1');
  });
});
