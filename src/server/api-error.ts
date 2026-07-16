/** Shared HTTP mapping for errors raised by core state operations. */

import type { Context } from 'hono';
import { isStateLockConflictError, STATE_LOCKED_CODE } from '../lib/persistence.js';

/** Expected client-input failure shared by modular API routes. */
export class ApiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiValidationError';
  }
}

export function apiError(c: Context, error: unknown): Response {
  const message = error instanceof Error ? error.message : '未知错误';
  if (error instanceof ApiValidationError) return c.json({ error: message, code: 'INVALID_REQUEST' }, 400);
  if (isStateLockConflictError(error)) {
    return c.json({ error: message, code: STATE_LOCKED_CODE }, 409);
  }
  return c.json({ error: message }, 500);
}
