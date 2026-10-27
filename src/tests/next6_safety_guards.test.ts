import { strict as assert } from 'node:assert';
import { verifyHmacSha256Signature, validateWebhookEnvelope } from '../backend/src/modules/webhooks/webhook.security';
import { IdempotencyService } from '../backend/src/modules/idempotency/idempotency.service';
import { isSafeToRetryAfterAuthRefresh, isFinancialMutation } from '../backend/src/core/http/retry-policy';
import { createHmac } from 'node:crypto';

const secret = 'test-secret';
const body = '{"eventId":"evt-1"}';
const signature = createHmac('sha256', secret).update(body).digest('hex');
assert.equal(verifyHmacSha256Signature(secret, body, signature), true);
assert.equal(verifyHmacSha256Signature(secret, body + 'x', signature), false);
assert.equal(verifyHmacSha256Signature(secret, body, 'bad'), false);
assert.doesNotThrow(() => validateWebhookEnvelope('provider', 'evt-1', signature));
assert.throws(() => validateWebhookEnvelope('', 'evt-1', signature));

const service = new IdempotencyService();
const record = service.begin(' key-1 ', ' withdrawal.create ');
assert.equal(record.key, 'key-1');
assert.equal(record.operation, 'withdrawal.create');
assert.throws(() => service.begin('', 'withdrawal.create'));
assert.throws(() => service.begin('key-2', ''));
assert.equal(service.complete(record, 'hash').status, 'COMPLETED');
assert.equal(service.fail(record).status, 'FAILED');

assert.equal(isSafeToRetryAfterAuthRefresh('GET', true), true);
assert.equal(isSafeToRetryAfterAuthRefresh('POST', true), false);
assert.equal(isSafeToRetryAfterAuthRefresh('GET', false), false);
assert.equal(isFinancialMutation('POST', false), true);
assert.equal(isFinancialMutation('GET', false), false);

console.log('N5 next6 safety guards passed');
