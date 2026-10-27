export type ConcurrencyScenario =
  | 'CONCURRENT_WITHDRAWALS'
  | 'CONCURRENT_DEPOSITS'
  | 'DUPLICATE_IDEMPOTENCY'
  | 'CONCURRENT_REWARD_CLAIMS'
  | 'WEBHOOK_REPLAY';

export interface ConcurrencyExpectation {
  scenario: ConcurrencyScenario;
  expectedSuccessfulOperations: number;
  expectedFinalBalanceMinor: number;
  duplicateOperationsRejected: boolean;
}

export const CONCURRENCY_SCENARIOS: ConcurrencyScenario[] = [
  'CONCURRENT_WITHDRAWALS',
  'CONCURRENT_DEPOSITS',
  'DUPLICATE_IDEMPOTENCY',
  'CONCURRENT_REWARD_CLAIMS',
  'WEBHOOK_REPLAY',
];
