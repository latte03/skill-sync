/**
 * Local Skill source association.
 *
 * A name match from skills.sh is only a discovery hint.  The selected source
 * is always verified against GitHub's tree before it can replace local source
 * metadata, and association never downloads or overwrites the local skill.
 */

import { getDefaultBranch, getRepoTree, findSkillMdPaths, getSkillTreeSha } from '../lib/github.js';
import { getLockEntry, setLockEntry } from '../lib/lock.js';
import { readManifest, writeManifest } from '../lib/manifest.js';
import { homePath } from '../lib/paths.js';
import { withFileTransaction } from '../lib/persistence.js';
import { searchRemote } from '../lib/search.js';
import { parseSource } from '../lib/source.js';
import type { SearchResult, SkillSource } from '../lib/types.js';

export interface SourceCandidate extends SearchResult {
  /** Search terms that produced this candidate, useful for a transparent UI. */
  matchedQueries: string[];
}

export interface SourceAssociationInput {
  /** Original skills.sh source or a manually supplied GitHub URL. */
  source: string;
  /** Original skills.sh skill id, when available. */
  skillId?: string;
  /** Original skills.sh repo field, when source is not canonical. */
  repo?: string;
  /** Display name from the selected candidate, used only for safe disambiguation. */
  candidateName?: string;
}

export interface VerifiedGitHubSource {
  source: SkillSource;
  branch: string;
  treeSha: string | null;
  warning: string;
}

/** Discover possible remote sources for a local managed Skill. No state is changed. */
export async function discoverSourceCandidates(name: string, limit = 10): Promise<SourceCandidate[]> {
  const entry = getLockEntry(name);
  if (!entry) throw new Error(`Skill 未找到: ${name}`);
  if (entry.source.type !== 'local') return [];

  const manifest = readManifest(name);
  const leafName = name.split('/').at(-1) ?? name;
  const queries = uniqueNonEmpty([
    manifest.name,
    leafName,
    // A short description may be a better discriminator for common names, but
    // never let an entire untrusted markdown description become a query URL.
    manifest.description.split(/\s+/).slice(0, 8).join(' '),
  ]);

  const groups = await Promise.all(queries.map(async query => ({
    query,
    results: await searchRemote(query, limit),
  })));

  const candidates = new Map<string, SourceCandidate>();
  for (const { query, results } of groups) {
    for (const result of results) {
      const key = `${result.source}\u0000${result.skillId}`;
      const existing = candidates.get(key);
      if (existing) {
        existing.matchedQueries.push(query);
      } else {
        candidates.set(key, { ...result, matchedQueries: [query] });
      }
    }
  }

  return [...candidates.values()]
    .sort((a, b) => candidateScore(b, manifest.name, leafName) - candidateScore(a, manifest.name, leafName))
    .slice(0, limit);
}

/** Verify one candidate by locating its exact SKILL.md in the remote GitHub tree. */
export async function verifySourceCandidate(input: SourceAssociationInput): Promise<VerifiedGitHubSource> {
  const parsed = parseCandidateSource(input);
  if (parsed.type !== 'github' || !parsed.owner || !parsed.repo) {
    throw new Error('候选来源必须能解析为 GitHub owner/repo');
  }

  const branch = parsed.ref || await getDefaultBranch(parsed.owner, parsed.repo);
  const tree = await getRepoTree(parsed.owner, parsed.repo, branch);
  if (!tree) throw new Error(`无法获取 GitHub 仓库树: ${parsed.owner}/${parsed.repo}`);

  const available = findSkillMdPaths(tree.tree);
  const skillPath = selectSkillPath(available, parsed.skillPath, input, parsed.owner, parsed.repo);
  if (skillPath === undefined) {
    throw new Error('候选无法唯一定位到远端 SKILL.md；请提供包含 skill 路径的 GitHub URL');
  }

  return {
    source: {
      type: 'github',
      owner: parsed.owner,
      repo: parsed.repo,
      skillPath: skillPath || undefined,
      installedVia: 'init-scan',
    },
    branch,
    treeSha: skillPath ? getSkillTreeSha(tree.tree, skillPath) : tree.sha,
    warning: '关联不会下载或覆盖本地 Skill 内容；首次更新会沿用现有备份和 force 规则。',
  };
}

/**
 * Associate an existing local Skill with a verified GitHub location.
 *
 * This changes only durable metadata. The pair of manifest/lock writes is
 * protected by a shared transaction and compensated on failure.
 */
export async function associateLocalSkillSource(
  name: string,
  input: SourceAssociationInput,
): Promise<VerifiedGitHubSource> {
  const entry = getLockEntry(name);
  if (!entry) throw new Error(`Skill 未找到: ${name}`);
  if (entry.source.type !== 'local') throw new Error(`Skill 已有关联远端来源: ${name}`);

  const verified = await verifySourceCandidate(input);

  withFileTransaction(homePath('.state'), () => {
    // Read the latest durable records while holding the cross-file transaction.
    const currentEntry = getLockEntry(name);
    if (!currentEntry) throw new Error(`Skill 未找到: ${name}`);
    if (currentEntry.source.type !== 'local') throw new Error(`Skill 已有关联远端来源: ${name}`);
    const manifest = readManifest(name);
    const oldManifest = structuredClone(manifest);
    const oldEntry = structuredClone(currentEntry);
    const source: SkillSource = {
      ...verified.source,
      // Source association preserves provenance of the original local install.
      installedVia: manifest.source.installedVia,
    };

    try {
      writeManifest(name, { ...manifest, source });
      setLockEntry(name, {
        ...currentEntry,
        source: {
          type: 'github',
          owner: source.owner,
          repo: source.repo,
          skillPath: source.skillPath,
          installedVia: currentEntry.source.installedVia,
        },
        // An association deliberately appears updateable on its first check;
        // do not claim the local snapshot is identical to remote content.
        treeSha: undefined,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      // Each individual write is atomic. Compensate to preserve the two-file
      // invariant if the second durable write cannot be committed.
      try {
        writeManifest(name, oldManifest);
        setLockEntry(name, oldEntry);
      } catch {
        // Preserve the original error; recovery/audit can surface a rare
        // secondary rollback failure rather than masking the write failure.
      }
      throw error;
    }
  });

  return verified;
}

function parseCandidateSource(input: SourceAssociationInput) {
  const sources = [input.source, input.repo]
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .flatMap(value => [value, value.startsWith('github.com/') ? `https://${value}` : value]);

  for (const value of sources) {
    try {
      const parsed = parseSource(value);
      if (parsed.type === 'github' && parsed.owner && parsed.repo) return parsed;
    } catch {
      // Try the next representation returned by skills.sh.
    }
  }
  throw new Error('无法从候选解析 GitHub 来源');
}

function selectSkillPath(
  available: Array<{ path: string; name: string }>,
  parsedPath: string | null,
  input: SourceAssociationInput,
  owner: string,
  repo: string,
): string | undefined {
  const exactPaths = uniqueNonEmpty([
    parsedPath ?? '',
    skillIdPath(input.skillId, owner, repo),
  ]);
  for (const path of exactPaths) {
    if (available.some(skill => skill.path === path)) return path;
  }

  const names = uniqueNonEmpty([
    input.candidateName ?? '',
    input.skillId?.split('/').at(-1) ?? '',
  ]);
  const named = available.filter(skill => names.includes(skill.name));
  if (named.length === 1) return named[0]!.path;
  if (available.length === 1) return available[0]!.path;
  return undefined;
}

function skillIdPath(skillId: string | undefined, owner: string, repo: string): string {
  if (!skillId) return '';
  const prefix = `${owner}/${repo}/`;
  if (skillId.startsWith(prefix)) return skillId.slice(prefix.length).replace(/\/SKILL\.md$/, '');
  return '';
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function candidateScore(candidate: SearchResult, manifestName: string, leafName: string): number {
  const name = candidate.name.toLowerCase();
  const skillId = candidate.skillId.toLowerCase();
  const terms = [manifestName, leafName].map(value => value.toLowerCase());
  return terms.reduce((score, term) => score + (name === term ? 100 : 0) + (skillId.includes(term) ? 20 : 0), 0)
    + (candidate.stars ?? 0) / 1000 + (candidate.installs ?? 0) / 10000;
}
