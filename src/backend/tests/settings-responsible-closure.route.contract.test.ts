import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';

test('settings responsible closure.route contract', () => {
  const root=join(process.cwd(),'src');
  const routes=readFileSync(join(root,'routes/index.ts'),'utf8');
  const migration=readFileSync(join(process.cwd(),'../database/migrations/028_settings_responsible_closure_integrity.sql'),'utf8');
  if(!routes.includes("router.get('/settings', requireAuth, getSettings)")||!routes.includes("router.patch('/settings', requireAuth, updateSettings)")) throw new Error('settings routes missing');
  if(!routes.includes("router.get('/responsible-gaming', requireAuth, getResponsibleGaming)")||!routes.includes("router.patch('/responsible-gaming', requireAuth, updateResponsibleGaming)")) throw new Error('responsible gaming routes missing');
  if(!routes.includes("router.post('/account-closure', requireAuth, requestClosure)")||!routes.includes("router.post('/account-closure/cancel', requireAuth, cancelClosure)")) throw new Error('closure routes missing');
  if(!migration.includes("CREATE TABLE IF NOT EXISTS user_settings")||!migration.includes("locale IN ('en','tr','hi','ur','ar')")) throw new Error('settings persistence guard missing');
});
