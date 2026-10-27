export type FinancialOperation = 'DEPOSIT' | 'WITHDRAWAL' | 'REWARD' | 'REVERSAL';

export interface IdempotencyGuardInput {
  key: string;
  operation: FinancialOperation;
}

export interface BalanceMutation {
  walletId: string;
  amountMinor: number;
  operation: FinancialOperation;
  idempotencyKey: string;
}

export interface ConcurrencyRules {
  lockWalletRow: true;
  atomicLedgerAndBalance: true;
  rejectNegativeBalance: true;
  uniqueIdempotencyKey: true;
  compensatingEntryForReversal: true;
}
