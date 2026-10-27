import { strict as assert } from 'node:assert';
import { validateBalanceMutation } from '../backend/src/modules/financial/financial-transaction.guard';

validateBalanceMutation({
  walletId: 'wallet-1',
  amountMinor: 10000,
  operation: 'WITHDRAWAL',
  idempotencyKey: 'withdrawal-1',
});

assert.throws(() => validateBalanceMutation({
  walletId: 'wallet-1',
  amountMinor: 0,
  operation: 'WITHDRAWAL',
  idempotencyKey: 'withdrawal-2',
}));

assert.throws(() => validateBalanceMutation({
  walletId: 'wallet-1',
  amountMinor: 100,
  operation: 'WITHDRAWAL',
  idempotencyKey: '',
}));

console.log('Part 115 guard tests passed.');
