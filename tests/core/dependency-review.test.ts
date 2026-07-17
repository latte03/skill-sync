import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { cleanupTestEnv, setupTestEnv } from '../test-utils.js';
import { createTestContext } from '../../src/core/context.js';
import { installLocalSkill } from '../../src/core/installer.js';
import { setLockEntry } from '../../src/lib/lock.js';
import { skillRepoPath } from '../../src/lib/paths.js';

const mocks = vi.hoisted(() => ({ installDependencies: vi.fn() }));

vi.mock('../../src/lib/dependencies.js', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/lib/dependencies.js')>(),
  installDependencies: mocks.installDependencies,
}));

const { installReviewedDependencies, reviewSkillDependencies } = await import('../../src/core/dependency-review.js');

describe('dependency review', () => {
  let sourceDir: string;

  beforeEach(() => {
    const env = setupTestEnv();
    sourceDir = path.join(env.tempDir, 'reviewed-skill');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'SKILL.md'), `---
name: reviewed-skill
description: dependency review fixture
metadata:
  version: 1.0.0
  depends_on:
    - name: shared-base
      version: ^1.0.0
  dependencies:
    npm:
      - lodash
    pip:
      - requests
---
# fixture
`);
    installLocalSkill(createTestContext(), sourceDir, { noDeploy: true, ignoreDeps: true });
    mocks.installDependencies.mockReset();
    mocks.installDependencies.mockReturnValue(true);
  });

  afterEach(() => cleanupTestEnv());

  it('reports missing Skill dependencies and persisted package declarations without running them', () => {
    const review = reviewSkillDependencies('reviewed-skill');

    expect(review.skillDependencies).toEqual([{ name: 'shared-base', version: '^1.0.0', installed: false }]);
    expect(review.packageDependencies).toEqual({ npm: ['lodash'], pip: ['requests'] });
    expect(review.requiresExplicitInstall).toBe(true);
    expect(mocks.installDependencies).not.toHaveBeenCalled();
  });

  it('marks installed Skill dependencies and only installs the selected persisted manager', () => {
    setLockEntry('shared-base', {
      source: { type: 'local' }, version: '1.0.0', installedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z', distribution: {},
    });
    expect(reviewSkillDependencies('reviewed-skill').skillDependencies[0]?.installed).toBe(true);

    const result = installReviewedDependencies('reviewed-skill', ['npm']);

    expect(result.installedManagers).toEqual(['npm']);
    expect(mocks.installDependencies).toHaveBeenCalledWith(skillRepoPath('reviewed-skill'), { npm: ['lodash'] });
  });

  it('rejects a package manager not declared by the Skill', () => {
    expect(() => installReviewedDependencies('reviewed-skill', ['npm', 'pip', 'npm'])).not.toThrow();
    expect(() => installReviewedDependencies('reviewed-skill', ['bun' as never])).toThrow('未声明的依赖管理器');
  });
});
