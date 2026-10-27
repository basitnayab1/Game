import { compareAmounts, decideReconciliation } from '../../src/modules/reconciliation/reconciliation.service.js';

describe('reconciliation decision safety', () => {
  test('matched success requires no action', () => {
    const item = compareAmounts(1000n, 1000n, 'tx-1', 'provider-1');
    expect(decideReconciliation('SUCCESS', item, false).action).toBe('NO_ACTION');
  });

  test('pending provider outcome remains under review', () => {
    const item = compareAmounts(1000n, 1000n);
    expect(decideReconciliation('PENDING', item, false).status).toBe('UNDER_REVIEW');
  });

  test('reversal never directly mutates the ledger', () => {
    const item = compareAmounts(1000n, 1000n);
    expect(decideReconciliation('REVERSED', item, false).action).toBe('RECORD_REVERSAL_PENDING');
  });

  test('duplicate reversal callback produces no second action', () => {
    const item = compareAmounts(1000n, 1000n);
    expect(decideReconciliation('REVERSED', item, true).action).toBe('NO_ACTION');
  });

  test('amount mismatch cannot be silently resolved', () => {
    const item = compareAmounts(1000n, 900n);
    expect(decideReconciliation('SUCCESS', item, false).status).toBe('UNDER_REVIEW');
  });
});
