/** Explicit, review-first dependency handling for already managed Skills. */

import fs from 'node:fs';
import { checkSkillDependencies, extractPackageDependencies, installDependencies, isEmptyDependencies } from '../lib/dependencies.js';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { getAllLockSkillNames, getLockEntry } from '../lib/lock.js';
import { readManifest } from '../lib/manifest.js';
import { skillMdPath, skillRepoPath } from '../lib/paths.js';
import type { Dependency, PackageManager, SkillDependencies } from '../lib/types.js';

export interface SkillDependencyReview {
  name: string;
  version: string;
  skillDependencies: Array<Dependency & { installed: boolean }>;
  packageDependencies: SkillDependencies;
  requiresExplicitInstall: boolean;
}

/** Read dependency declarations without running anything. */
export function reviewSkillDependencies(name: string): SkillDependencyReview {
  const entry = getLockEntry(name);
  if (!entry) throw new Error(`Skill 未找到: ${name}`);

  const manifest = readManifest(name);
  const packageDependencies = readPackageDependencies(name);
  const installed = new Set(getAllLockSkillNames());
  const missing = new Set(checkSkillDependencies(manifest.dependsOn ?? [], installed));

  return {
    name,
    version: entry.version,
    skillDependencies: (manifest.dependsOn ?? []).map(dependency => ({
      ...dependency,
      installed: !missing.has(dependency.name),
    })),
    packageDependencies,
    requiresExplicitInstall: !isEmptyDependencies(packageDependencies),
  };
}

/**
 * Install a selected subset of the persisted package declarations.
 *
 * Package names never come from this API call. npm lifecycle scripts remain
 * disabled by the lower-level installer; this function only gates the action
 * behind a deliberate request.
 */
export function installReviewedDependencies(
  name: string,
  requestedManagers?: PackageManager[],
): { review: SkillDependencyReview; installedManagers: PackageManager[] } {
  const review = reviewSkillDependencies(name);
  const declaredManagers = (['npm', 'pip'] as const)
    .filter(manager => (review.packageDependencies[manager]?.length ?? 0) > 0);
  if (declaredManagers.length === 0) throw new Error('该 Skill 未声明可安装的包依赖');

  const managers = requestedManagers ?? declaredManagers;
  if (managers.length === 0) throw new Error('请至少选择一个已声明的依赖管理器');
  const invalid = managers.filter(manager => !declaredManagers.includes(manager));
  if (invalid.length > 0) throw new Error(`未声明的依赖管理器: ${invalid.join(', ')}`);

  const selected: SkillDependencies = {};
  for (const manager of managers) selected[manager] = review.packageDependencies[manager];
  if (!installDependencies(skillRepoPath(name), selected)) throw new Error('包依赖安装失败');

  return { review, installedManagers: [...new Set(managers)] };
}

function readPackageDependencies(name: string): SkillDependencies {
  const path = skillMdPath(name);
  if (!fs.existsSync(path)) throw new Error(`SKILL.md 不存在: ${path}`);
  return extractPackageDependencies(parseFrontmatter(fs.readFileSync(path, 'utf-8')).data);
}
