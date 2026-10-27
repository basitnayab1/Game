import { strict as assert } from 'node:assert';
import { validateRewardClaim, assertClaimMayPostToLedger } from '../../backend/src/modules/promotions/reward-claim.guard';

const now = new Date();
const later = new Date(now.getTime() + 60_000);
assert.doesNotThrow(() => validateRewardClaim({ rewardId:'r1', idempotencyKey:'idem-1', now, startsAt:new Date(now.getTime()-60_000), endsAt:later, status:'ACTIVE' }));
assert.throws(() => validateRewardClaim({ rewardId:'r1', idempotencyKey:'', now, startsAt:now, endsAt:later, status:'ACTIVE' }), /IDEMPOTENCY_KEY_REQUIRED/);
assert.throws(() => validateRewardClaim({ rewardId:'r1', idempotencyKey:'idem-1', now, startsAt:now, endsAt:later, status:'EXPIRED' }), /REWARD_NOT_ACTIVE/);
assert.doesNotThrow(() => assertClaimMayPostToLedger({ eligible:true, duplicate:false, walletPostAuthorized:true }));
assert.throws(() => assertClaimMayPostToLedger({ eligible:true, duplicate:true, walletPostAuthorized:true }), /REWARD_ALREADY_CLAIMED/);
console.log('reward-claim guard tests passed');
