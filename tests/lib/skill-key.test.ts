import { describe, expect, it } from 'vitest';
import {
  createGitHubSkillKey,
  getGitHubSkillLocation,
  normalizeSkillKey,
} from '../../src/lib/skill-key.js';
import { createManifestFromFrontmatter } from '../../src/lib/manifest.js';
import { skillRepoPath } from '../../src/lib/paths.js';

describe('SkillKey', () => {
  it('normalizes a nested path into one stable key', () => {
    expect(normalizeSkillKey(' write-a-skill//engineering/./tdd ')).toBe(
      'write-a-skill/engineering/tdd',
    );
  });

  it('uses owner, repository, and source skill path for a GitHub key', () => {
    expect(createGitHubSkillKey({
      owner: 'anthropics',
      repo: 'skills',
      skillPath: 'skills/pdf-processing',
    })).toBe('anthropics/skills/skills/pdf-processing');
  });

  it('reads legacy GitHub source metadata without losing its path', () => {
    expect(getGitHubSkillLocation({
      type: 'github',
      repo: 'anthropics/skills',
      path: 'skills/pdf-processing',
      installedVia: 'cli',
    })).toEqual({
      owner: 'anthropics',
      repo: 'skills',
      skillPath: 'skills/pdf-processing',
    });
  });

  it('keeps GitHub owner, repo, and skillPath in manifest source data', () => {
    const source = {
      type: 'github' as const,
      owner: 'anthropics',
      repo: 'skills',
      skillPath: 'skills/pdf-processing',
      installedVia: 'cli' as const,
    };
    const manifest = createManifestFromFrontmatter({}, 'anthropics/skills/skills/pdf-processing', source);

    expect(manifest.source).toMatchObject(source);
  });

  it('rejects non-canonical keys before they reach filesystem paths', () => {
    expect(() => skillRepoPath('../../victim')).toThrow('非法 SkillKey');
  });
});
