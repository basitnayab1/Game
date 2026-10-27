export interface WalletMutation {
  walletAccountId: string;
  amountMinor: bigint;
  direction: 'credit' | 'debit';
  idempotencyKey: string;
}

export function validateConcurrentWalletMutation(input: WalletMutation): void {
  if (!input.walletAccountId.trim()) throw new Error('walletAccountId is required');
  if (input.amountMinor <= 0n) throw new Error('amount must be positive');
  if (!input.idempotencyKey.trim()) throw new Error('idempotency key required');
}

export function assertSufficientBalance(availableMinor: bigint, debitMinor: bigint): void {
  if (debitMinor <= 0n) throw new Error('debit amount must be positive');
  if (availableMinor < debitMinor) throw new Error('insufficient available balance');
}

/** Production persistence order: BEGIN -> SELECT wallet FOR UPDATE -> idempotency lookup -> balance check -> ledger insert -> balance update -> COMMIT. */
export const financialTransactionPolicy = Object.freeze({
  lockWalletRowBeforeBalanceCheck: true,
  ledgerIsAppendOnly: true,
  debitCannotCreateNegativeBalance: true,
  duplicateIdempotencyMustBeRejectedOrReplayed: true,
  unknownOutcomeRequiresReconciliation: true,
});
