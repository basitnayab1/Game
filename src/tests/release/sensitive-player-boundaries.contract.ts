import { strict as assert } from 'node:assert';
import { assertClientCannotSetKycStatus, assertAuthenticatedUserScope } from '../../backend/src/modules/security_kyc/player_api';

assert.throws(() => assertClientCannotSetKycStatus({ status: 'VERIFIED' }));
assert.throws(() => assertClientCannotSetKycStatus({ verificationResult: 'approved' }));
assert.doesNotThrow(() => assertClientCannotSetKycStatus({ documentId: 'doc_1' }));
assert.throws(() => assertAuthenticatedUserScope('user-a', 'user-b'));
assert.doesNotThrow(() => assertAuthenticatedUserScope('user-a', 'user-a'));
console.log('Sensitive player boundary tests passed');
