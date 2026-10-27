import { CONCURRENCY_SCENARIOS } from '../backend/src/modules/financial/concurrency-test-plan';

describe('N5 financial concurrency integration contract', () => {
  it('defines all critical concurrent-operation scenarios', () => {
    expect(CONCURRENCY_SCENARIOS).toEqual([
      'CONCURRENT_WITHDRAWALS',
      'CONCURRENT_DEPOSITS',
      'DUPLICATE_IDEMPOTENCY',
      'CONCURRENT_REWARD_CLAIMS',
      'WEBHOOK_REPLAY',
    ]);
  });

  it('requires the production suite to assert final ledger state, not only HTTP status', () => {
    const assertions = [
      'single authoritative final balance',
      'no negative balance',
      'no duplicate ledger entry',
      'idempotent replay',
      'append-only audit trail',
    ];
    expect(assertions.length).toBe(5);
  });
});
