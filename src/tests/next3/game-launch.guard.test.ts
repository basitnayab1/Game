import { strict as assert } from 'node:assert';
import { validateLaunchSession, classifyLaunchFailure, shouldCreateFreshSession } from '../../backend/src/modules/games/game-launch.guard';

const future = new Date(Date.now() + 60_000).toISOString();
assert.doesNotThrow(() => validateLaunchSession({ sessionId:'s', gameId:'g', providerId:'p', state:'LAUNCHING', expiresAt:future }));
assert.throws(() => validateLaunchSession({ sessionId:'s', gameId:'g', providerId:'p', state:'EXPIRED', expiresAt:future }), /LAUNCH_SESSION_NOT_ACTIVE/);
const timeout = classifyLaunchFailure('NETWORK_TIMEOUT');
assert.equal(timeout.retryable, true);
assert.equal(shouldCreateFreshSession(timeout), true);
const eligibility = classifyLaunchFailure('ELIGIBILITY_FAILED');
assert.equal(eligibility.retryable, false);
assert.equal(shouldCreateFreshSession(eligibility), false);
console.log('game-launch guard tests passed');
