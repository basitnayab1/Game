import type { BalanceMutation, IdempotencyGuardInput } from './concurrency.types';

export function validateIdempotencyGuard(input: IdempotencyGuardInput): void {
  if (!input.key.trim()) throw new Error('Idempotency key required');
  if (!input.operation) throw new Error('Operation required');
}

export function validateBalanceMutation(input: BalanceMutation): void {
  if (!input.walletId.trim()) throw new Error('Wallet ID required');
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Amount must be a positive integer in minor units');
  }
  validateIdempotencyGuard({ key: input.idempotencyKey, operation: input.operation });
}

/**
 * Persistence layer contract:
 * 1. BEGIN database transaction.
 * 2. Lock the wallet row with SELECT ... FOR UPDATE.
 * 3. Check the unique idempotency key inside the same transaction.
 * 4. Validate the resulting balance (no negative available balance).
 * 5. Insert the immutable ledger entry.
 * 6. Update the wallet balance.
 * 7. Commit atomically; rollback everything on error.
 */
export const FINANCIAL_TRANSACTION_CONTRACT = Object.freeze({
  lockMode: 'FOR UPDATE',
  atomic: true,
  immutableLedger: true,
  noNegativeBalance: true,
  uniqueIdempotency: true,
});
