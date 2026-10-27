import { strict as assert } from 'node:assert';
import { requireWalletOwner, validateWalletReadResponse } from '../../backend/src/modules/wallet/wallet-read.guard';

assert.throws(() => requireWalletOwner(undefined), /AUTHENTICATED_SESSION_REQUIRED/);
assert.doesNotThrow(() => requireWalletOwner({ userId: 'u1', sessionId: 's1' }));
assert.doesNotThrow(() => validateWalletReadResponse({ currency: 'PKR', availableMinor: 1000, bonusMinor: 0, pendingMinor: 0, lockedMinor: 0, refreshedAt: new Date().toISOString() }));
assert.throws(() => validateWalletReadResponse({ currency: 'PKR', availableMinor: -1, bonusMinor: 0, pendingMinor: 0, lockedMinor: 0, refreshedAt: new Date().toISOString() }));
console.log('wallet-read guard tests passed');
