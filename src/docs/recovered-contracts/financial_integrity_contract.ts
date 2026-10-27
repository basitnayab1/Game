export type FinancialOperation = 'DEPOSIT' | 'WITHDRAWAL' | 'REVERSAL' | 'REWARD';

export type RecoveryState =
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'REVERSED'
  | 'UNDER_REVIEW';

export interface FinancialMutationRequest {
  operation: FinancialOperation;
  transactionId: string;
  idempotencyKey: string;
}

export interface FinancialRecoveryResult {
  transactionId: string;
  state: RecoveryState;
  authoritative: true;
}

export function requireFinancialIdempotency(key: string): void {
  if (!key.trim()) throw new Error('Financial idempotency key required');
}

export function requireServerAuthoritativeResult(
  result: FinancialRecoveryResult,
): void {
  if (result.authoritative !== true) {
    throw new Error('Financial result is not authoritative');
  }
}
