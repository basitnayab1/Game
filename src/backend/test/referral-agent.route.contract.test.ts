import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
const routes=readFileSync(new URL('../src/routes/index.ts',import.meta.url),'utf8');
const migration=readFileSync(new URL('../../database/migrations/025_referral_agent_safety.sql',import.meta.url),'utf8');
describe('referral/agent safety gate',()=>{
 it('mounts authenticated referral and agent endpoints',()=>{expect(routes).toContain("router.get('/referral', requireAuth, getReferral)");expect(routes).toContain("router.get('/referral/history', requireAuth, getReferralHistory)");expect(routes).toContain("router.get('/agent', requireAuth, getAgent)");expect(routes).toContain("router.post('/agent/apply', requireAuth, applyAgent)");});
 it('prevents duplicate invited users and duplicate commission source',()=>{expect(migration).toContain('uq_referral_invited_user');expect(migration).toContain('uq_agent_commission_source');});
 it('keeps reward/commission decisions server-side',()=>{expect(migration).toContain('risk_status');expect(readFileSync(new URL('../src/modules/referral/referral.service.ts',import.meta.url),'utf8')).toContain('qualification');});
});
