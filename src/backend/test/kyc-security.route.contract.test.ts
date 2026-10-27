import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';

test('kyc security.route contract', () => {
  const root=path.resolve(import.meta.dirname,'..');
  const routes=fs.readFileSync(path.join(root,'src/routes/index.ts'),'utf8');
  const migration=fs.readFileSync(path.join(root,'../database/migrations/026_kyc_security_risk_integrity.sql'),'utf8');
  if(!routes.includes("router.get('/kyc', requireAuth, getKyc)")) throw new Error('KYC route missing');
  if(!routes.includes("router.post('/kyc/submit', requireAuth, submitKyc)")) throw new Error('KYC submit route missing');
  if(!routes.includes("router.post('/kyc/webhook/:provider', handleKycWebhook)")) throw new Error('KYC provider webhook route missing');
  if(/kyc\/webhook[^\n]*requireAuth/.test(routes)) throw new Error('KYC provider webhook must not require player auth (signature-verified instead)');
  if(!routes.includes("router.get('/security/overview', requireAuth, getSecurity)")) throw new Error('Security route missing');
  if(!routes.includes("router.post('/security/sessions/revoke-others', requireAuth, revokeOthers)")) throw new Error('Session revoke route missing');
  if(!migration.includes('user_risk_flags') || !migration.includes('security_login_events')) throw new Error('Risk/security tables missing');
});
