import { strict as assert } from 'node:assert';
import { ResponsibleGamingService, ResponsibleGamingRepository } from '../../backend/src/modules/responsibleGaming/responsible-gaming.service';
import { AccountClosureService, AccountClosureGate, AccountClosureRepository } from '../../backend/src/modules/accountClosure/account-closure.service';

const rgRepo: ResponsibleGamingRepository = { async get() { return { sessionReminderMinutes: 60, depositLimitMinor: 0, lossLimitMinor: 0, takeABreakUntil: null, selfExcludedUntil: null }; }, async save(_u, c) { return c; } };
const rg = new ResponsibleGamingService(rgRepo);
assert.rejects(() => rg.update('u1', { sessionReminderMinutes: 1 }));
assert.rejects(() => rg.update('u1', { selfExcludedUntil: null, unknownField: true } as any));
assert.doesNotReject(() => rg.update('u1', { sessionReminderMinutes: 120 }));

const closureRepo: AccountClosureRepository = { async create() { return { id: 'c1', userId: 'u1', status: 'PENDING' } as any; }, async getOpen() { return null; }, async updateStatus() { return {} as any; } };
let verified = false;
const gate: AccountClosureGate = { async requireRecentSecurityVerification() { verified = true; }, async getPendingObligations() { return { pendingTransactions: 0, openSupportCases: 0 }; } };
const closure = new AccountClosureService(closureRepo, gate);
assert.doesNotReject(() => closure.request('u1', null));
assert.equal(verified, true);
console.log('Responsible gaming and closure boundary tests passed');
