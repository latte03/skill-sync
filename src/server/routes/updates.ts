/** Routes for source association and single-Skill update operations. */

import { Hono } from 'hono';
import { createContext } from '../../core/context.js';
import {
  associateLocalSkillSource,
  discoverSourceCandidates,
  verifySourceCandidate,
} from '../../core/source-association.js';
import { checkAllUpdates, checkForUpdate, listSkillBackups, updateSkill } from '../../core/version-manager.js';
import { ApiValidationError, apiError } from '../api-error.js';

export const updateRoutes = new Hono();

/** Backwards-compatible global check endpoint. */
updateRoutes.get('/check', async (c) => {
  try {
    const ctx = createContext();
    const name = c.req.query('name');
    const results = name ? [await checkForUpdate(ctx, name)] : await checkAllUpdates(ctx);
    return c.json({ results });
  } catch (error) {
    return apiError(c, error);
  }
});

/** Check one Skill only. The existing /api/check remains the all-Skills compatibility endpoint. */
updateRoutes.get('/skill/update', async (c) => {
  try {
    const name = requiredSkillKey(c.req.query('name'));
    return c.json({ result: await checkForUpdate(createContext(), name) });
  } catch (error) {
    return apiError(c, error);
  }
});

updateRoutes.post('/skill/update', async (c) => {
  try {
    const name = requiredSkillKey(c.req.query('name'));
    const body = await c.req.json<{ force?: unknown; noBackup?: unknown }>()
      .catch((): { force?: unknown; noBackup?: unknown } => ({}));
    if (body.force !== undefined && typeof body.force !== 'boolean') throw new ApiValidationError('force 必须是布尔值');
    if (body.noBackup !== undefined && typeof body.noBackup !== 'boolean') throw new ApiValidationError('noBackup 必须是布尔值');

    const result = await updateSkill(createContext(), name, {
      force: body.force === true,
      noBackup: body.noBackup === true,
    });
    if (!result.success) return c.json({ error: result.error ?? '更新失败', result }, 409);
    return c.json({ success: true, result });
  } catch (error) {
    return apiError(c, error);
  }
});

updateRoutes.get('/skill/backups', (c) => {
  try {
    const name = requiredSkillKey(c.req.query('name'));
    return c.json({ backups: listSkillBackups(name) });
  } catch (error) {
    return apiError(c, error);
  }
});

/** Search only; returned candidates are never automatically associated. */
updateRoutes.get('/skill/source-candidates', async (c) => {
  try {
    const name = requiredSkillKey(c.req.query('name'));
    const limit = optionalLimit(c.req.query('limit'));
    return c.json({ candidates: await discoverSourceCandidates(name, limit) });
  } catch (error) {
    return apiError(c, error);
  }
});

/** Re-check a selected candidate against the remote GitHub tree without changing local metadata. */
updateRoutes.post('/skill/source-candidates/verify', async (c) => {
  try {
    const body = await c.req.json<SourceBody>();
    return c.json({ verified: await verifySourceCandidate(parseSourceBody(body)) });
  } catch (error) {
    return apiError(c, error);
  }
});

/** Explicit, metadata-only association. The server verifies again before writing. */
updateRoutes.post('/skill/source-association', async (c) => {
  try {
    const name = requiredSkillKey(c.req.query('name'));
    const body = await c.req.json<SourceBody>();
    const verified = await associateLocalSkillSource(name, parseSourceBody(body));
    return c.json({ success: true, source: verified.source, branch: verified.branch, warning: verified.warning });
  } catch (error) {
    return apiError(c, error);
  }
});

interface SourceBody {
  source?: unknown;
  skillId?: unknown;
  repo?: unknown;
  candidateName?: unknown;
}

function parseSourceBody(body: SourceBody) {
  if (typeof body.source !== 'string' || body.source.trim() === '') {
    throw new ApiValidationError('source 必须是非空字符串');
  }
  for (const [key, value] of Object.entries(body)) {
    if (key !== 'source' && value !== undefined && typeof value !== 'string') {
      throw new ApiValidationError(`${key} 必须是字符串`);
    }
  }
  return {
    source: body.source.trim(),
    skillId: typeof body.skillId === 'string' ? body.skillId.trim() || undefined : undefined,
    repo: typeof body.repo === 'string' ? body.repo.trim() || undefined : undefined,
    candidateName: typeof body.candidateName === 'string' ? body.candidateName.trim() || undefined : undefined,
  };
}

function requiredSkillKey(name: string | undefined): string {
  if (!name?.trim()) throw new ApiValidationError('缺少查询参数 name');
  return name.trim();
}

function optionalLimit(value: string | undefined): number {
  if (value === undefined) return 10;
  const limit = Number.parseInt(value, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new ApiValidationError('limit 必须是 1 到 50 的整数');
  return limit;
}
