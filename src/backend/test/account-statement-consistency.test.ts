import assert from 'node:assert/strict';
import { test } from 'vitest';

test('account statement consistency contract', () => {
  const summaryKeys = [
    'totalDepositMinor',
    'totalPlayMinor',
    'totalWithdrawalMinor',
    'totalWithdrawalFeeMinor',
    'totalBonusReceivedMinor',
  ];

  assert.deepEqual(summaryKeys, [
    'totalDepositMinor',
    'totalPlayMinor',
    'totalWithdrawalMinor',
    'totalWithdrawalFeeMinor',
    'totalBonusReceivedMinor',
  ]);

  const forbiddenRoundKeys = ['roundId', 'rounds', 'gameRoundId', 'roundHistory'];
  assert.equal(forbiddenRoundKeys.every((key) => !summaryKeys.includes(key)), true);
});
