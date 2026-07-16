/** Shared HTTP mapping for errors raised by core state operations. */

import type { Context } from 'hono';
import { isStateLockConflictError, STATE_LOCKED_CODE } from '../lib/persistence.js';

export function apiError(c: Context, error: unknown): Response {
  const message = error instanceof Error ? error.message : '未知错误';
  if (isStateLockConflictError(error)) {
    return c.json({ error: message, code: STATE_LOCKED_CODE }, 409);
  }
  return c.json({ error: message }, 500);
}
