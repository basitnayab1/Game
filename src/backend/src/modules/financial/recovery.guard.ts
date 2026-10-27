export type MutationOutcome = 'COMMITTED' | 'ROLLED_BACK' | 'UNKNOWN';

export function requireReconciliationForUnknown(outcome: MutationOutcome): void {
  if (outcome === 'UNKNOWN') throw new Error('financial transaction outcome is unknown; reconcile server-side');
}

export function isSafeToRetryDatabaseFailure(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('deadlock') || normalized.includes('serialization failure');
}

export function shouldNotRetryFinancialMutation(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('timeout') || normalized.includes('unknown') || normalized.includes('connection reset');
}
