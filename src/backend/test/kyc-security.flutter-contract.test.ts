import fs from 'node:fs'; import path from 'node:path';
import { test } from 'vitest';

test('kyc security.flutter contract contract', () => {
  const root=path.resolve(import.meta.dirname,'../..');
  const k=fs.readFileSync(path.join(root,'lib/features/kyc/data/kyc_api.dart'),'utf8');
  const s=fs.readFileSync(path.join(root,'lib/features/security/data/security_api.dart'),'utf8');
  if(!k.includes("'/kyc'")||!k.includes("'/kyc/submit'")) throw new Error('Flutter KYC API missing');
  if(!s.includes("'/security/overview'")||!s.includes("'/security/sessions/revoke-others'")) throw new Error('Flutter security API missing');
});
