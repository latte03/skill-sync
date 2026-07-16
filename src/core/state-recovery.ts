/**
 * Shared managed-state preparation for every public entry point.
 *
 * Both the CLI and HTTP API must complete (or roll back) interrupted removal
 * and distribution work before reading or mutating the managed state.
 */

import { recoverInterruptedDistribution, recoverInterruptedRemoval } from './distribution-transaction.js';
import { homePath } from '../lib/paths.js';
import { withFileTransaction } from '../lib/persistence.js';

export function recoverManagedState(): { restored: number; cleaned: number } {
  return withFileTransaction(homePath('.state'), () => {
    const distribution = recoverInterruptedDistribution();
    const removal = recoverInterruptedRemoval();
    return {
      restored: distribution.restored + removal.restored,
      cleaned: distribution.cleaned + removal.cleaned,
    };
  });
}
