/** Review-first package dependency API. */

import { Hono } from 'hono';
import { installReviewedDependencies, reviewSkillDependencies } from '../../core/dependency-review.js';
import type { PackageManager } from '../../lib/types.js';
import { ApiValidationError, apiError } from '../api-error.js';

export const dependencyRoutes = new Hono();

dependencyRoutes.get('/skill/dependencies', (c) => {
  try {
    return c.json({ review: reviewSkillDependencies(requiredSkillKey(c.req.query('name'))) });
  } catch (error) {
    return apiError(c, error);
  }
});

dependencyRoutes.post('/skill/dependencies/install', async (c) => {
  try {
    const name = requiredSkillKey(c.req.query('name'));
    const body = await c.req.json<{ managers?: unknown }>().catch((): { managers?: unknown } => ({}));
    const managers = parseManagers(body.managers);
    const review = reviewSkillDependencies(name);
    if (!review.requiresExplicitInstall) throw new ApiValidationError('该 Skill 未声明可安装的包依赖');
    const result = installReviewedDependencies(name, managers);
    return c.json({ success: true, ...result });
  } catch (error) {
    return apiError(c, error);
  }
});

function requiredSkillKey(name: string | undefined): string {
  if (!name?.trim()) throw new ApiValidationError('缺少查询参数 name');
  return name.trim();
}

function parseManagers(value: unknown): PackageManager[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some(item => item !== 'npm' && item !== 'pip')) {
    throw new ApiValidationError('managers 必须是 npm/pip 数组');
  }
  if (value.length === 0) throw new ApiValidationError('managers 不能为空');
  return [...new Set(value)] as PackageManager[];
}
