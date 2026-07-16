/**
 * Shared managed-state preparation for every public entry point.
 *
 * Both the CLI and HTTP API must complete (or roll back) an interrupted
 * central deletion before reading or mutating the managed state.
 */

import { recoverInterruptedRemoval } from './distribution-transaction.js';
import { homePath } from '../lib/paths.js';
import { withFileTransaction } from '../lib/persistence.js';

export function recoverManagedState(): { restored: number; cleaned: number } {
  return withFileTransaction(homePath('.state'), () => recoverInterruptedRemoval());
}
