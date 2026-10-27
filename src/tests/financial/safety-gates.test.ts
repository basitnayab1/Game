import { strict as assert } from 'node:assert';
import { assertSufficientBalance, validateConcurrentWalletMutation } from '../../backend/src/modules/financial/concurrency.guard';
import { requireReconciliationForUnknown, isSafeToRetryDatabaseFailure, shouldNotRetryFinancialMutation } from '../../backend/src/modules/financial/recovery.guard';
import { validateWebhookEventKey } from '../../backend/src/modules/webhooks/event-replay.guard';

validateConcurrentWalletMutation({ walletAccountId: 'w1', amountMinor: 100n, direction: 'debit', idempotencyKey: 'idem-1' });
assert.throws(() => validateConcurrentWalletMutation({ walletAccountId: 'w1', amountMinor: 100n, direction: 'debit', idempotencyKey: '' }));
assert.doesNotThrow(() => assertSufficientBalance(100n, 100n));
assert.throws(() => assertSufficientBalance(99n, 100n));
assert.equal(isSafeToRetryDatabaseFailure('deadlock detected'), true);
assert.equal(isSafeToRetryDatabaseFailure('serialization failure'), true);
assert.equal(shouldNotRetryFinancialMutation('network timeout'), true);
assert.throws(() => requireReconciliationForUnknown('UNKNOWN'));
validateWebhookEventKey({ provider: 'authorized-provider', eventId: 'evt-1' });
assert.throws(() => validateWebhookEventKey({ provider: 'authorized-provider', eventId: '' }));
console.log('N5 financial safety gates passed');

// Withdrawal policy is pure and must not mount a live payout route.
