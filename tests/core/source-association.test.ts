import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSkillDir, cleanupTestEnv, setupTestEnv } from '../test-utils.js';
import { createTestContext } from '../../src/core/context.js';
import { installLocalSkill } from '../../src/core/installer.js';
import { getLockEntry } from '../../src/lib/lock.js';
import { readManifest } from '../../src/lib/manifest.js';
import { checkForUpdate } from '../../src/core/version-manager.js';

const mocks = vi.hoisted(() => ({
  searchRemote: vi.fn(),
  getDefaultBranch: vi.fn(),
  getRepoTree: vi.fn(),
}));

vi.mock('../../src/lib/search.js', () => ({ searchRemote: mocks.searchRemote }));
vi.mock('../../src/lib/github.js', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/lib/github.js')>(),
  getDefaultBranch: mocks.getDefaultBranch,
  getRepoTree: mocks.getRepoTree,
}));

const {
  associateLocalSkillSource,
  discoverSourceCandidates,
  verifySourceCandidate,
} = await import('../../src/core/source-association.js');

describe('source association', () => {
  let sourceDir: string;

  beforeEach(() => {
    const env = setupTestEnv();
    sourceDir = createMockSkillDir(env.tempDir, 'local-pdf', {
      name: 'pdf-helper',
      description: 'Create and inspect PDF documents',
      version: '1.2.3',
    });
    installLocalSkill(createTestContext(), sourceDir, { noDeploy: true, ignoreDeps: true });
    mocks.searchRemote.mockReset();
    mocks.getDefaultBranch.mockReset();
    mocks.getRepoTree.mockReset();
    mocks.getDefaultBranch.mockResolvedValue('main');
    mocks.getRepoTree.mockResolvedValue({
      sha: 'commit-sha',
      truncated: false,
      tree: [
        { path: 'skills/pdf-helper', type: 'tree', mode: '040000', sha: 'skill-tree-sha' },
        { path: 'skills/pdf-helper/SKILL.md', type: 'blob', mode: '100644', sha: 'skill-md-sha' },
      ],
    });
  });

  afterEach(() => cleanupTestEnv());

  it('merges multiple search results into selectable candidates without writing metadata', async () => {
    mocks.searchRemote.mockResolvedValue([
      { source: 'acme/skills/skills/pdf-helper', skillId: 'acme/skills/skills/pdf-helper', name: 'pdf-helper', description: 'PDF', stars: 10 },
      { source: 'other/pdf-tools', skillId: 'other/pdf-tools', name: 'pdf-helper', description: 'Another PDF', stars: 2 },
    ]);

    const candidates = await discoverSourceCandidates('local-pdf');

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({ source: 'acme/skills/skills/pdf-helper' });
    expect(candidates[0]!.matchedQueries.length).toBeGreaterThan(0);
    expect(getLockEntry('local-pdf')?.source.type).toBe('local');
  });

  it('keeps a Skill local when skills.sh has no candidates', async () => {
    mocks.searchRemote.mockResolvedValue([]);

    await expect(discoverSourceCandidates('local-pdf')).resolves.toEqual([]);
    expect(getLockEntry('local-pdf')?.source.type).toBe('local');
  });

  it('rejects candidates whose remote tree cannot be verified', async () => {
    mocks.getRepoTree.mockResolvedValue(null);

    await expect(verifySourceCandidate({ source: 'acme/skills/skills/pdf-helper' }))
      .rejects.toThrow('无法获取 GitHub 仓库树');
  });

  it('associates only verified GitHub metadata and preserves local content/version state', async () => {
    const verified = await associateLocalSkillSource('local-pdf', {
      source: 'acme/skills/skills/pdf-helper',
      candidateName: 'pdf-helper',
    });

    expect(verified.source).toMatchObject({
      type: 'github', owner: 'acme', repo: 'skills', skillPath: 'skills/pdf-helper',
    });
    expect(verified.warning).toContain('不会下载或覆盖');
    expect(readManifest('local-pdf').source).toMatchObject({
      type: 'github', owner: 'acme', repo: 'skills', skillPath: 'skills/pdf-helper', installedVia: 'cli',
    });
    expect(getLockEntry('local-pdf')).toMatchObject({
      version: '1.2.3',
      source: { type: 'github', owner: 'acme', repo: 'skills', skillPath: 'skills/pdf-helper' },
    });
    expect(getLockEntry('local-pdf')?.treeSha).toBeUndefined();

    // The unknown equivalence is intentional: the first check must present a
    // real remote snapshot as updateable instead of claiming local equality.
    await expect(checkForUpdate(createTestContext(), 'local-pdf')).resolves.toMatchObject({
      isLocal: false,
      hasUpdate: true,
    });
  });
});
