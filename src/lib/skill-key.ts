/**
 * SkillKey — the canonical, opaque identifier for a managed skill.
 *
 * A key is a normalized slash-separated path. Callers may pass it to storage,
 * lock, tag, API, and deployment operations, but must never infer source
 * fields by splitting it.
 */

export type SkillKey = string;

export interface GitHubSkillLocation {
  owner: string;
  repo: string;
  skillPath?: string;
}

interface GitHubSourceLike {
  type: 'github' | 'local';
  owner?: string;
  repo?: string;
  skillPath?: string;
  /** Legacy persisted field. Read-only compatibility during migration. */
  path?: string;
}

/** Normalize arbitrary user/source input into one safe storage key. */
export function normalizeSkillKey(value: string): SkillKey {
  const segments = value
    .replaceAll('\\', '/')
    .split('/')
    .filter(segment => segment.trim() !== '' && segment.trim() !== '.' && segment.trim() !== '..')
    .map(segment => segment
      .trim()
      .replace(/\.\./g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, ''))
    .filter(Boolean);

  return segments.join('/') || 'unnamed-skill';
}

/** Reject persisted or user-supplied keys that are not already canonical. */
export function assertCanonicalSkillKey(value: string): SkillKey {
  if (!value || value !== normalizeSkillKey(value)) {
    throw new Error(`非法 SkillKey: ${value}`);
  }
  return value;
}

/** Build an unambiguous GitHub SkillKey from the complete remote location. */
export function createGitHubSkillKey(location: GitHubSkillLocation): SkillKey {
  return normalizeSkillKey([
    location.owner,
    location.repo,
    location.skillPath,
  ].filter(Boolean).join('/'));
}

/**
 * Read both the current source shape and manifests written before this change.
 * Legacy data is interpreted but never recreated by new writes.
 */
export function getGitHubSkillLocation(source: GitHubSourceLike): GitHubSkillLocation | null {
  if (source.type !== 'github' || !source.repo) return null;

  if (source.owner) {
    return {
      owner: source.owner,
      repo: source.repo,
      skillPath: source.skillPath ?? source.path,
    };
  }

  const [owner, repo] = source.repo.split('/');
  if (!owner || !repo) return null;

  return {
    owner,
    repo,
    skillPath: source.skillPath ?? source.path,
  };
}
