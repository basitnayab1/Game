import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

test('support notifications.route contract', () => {
  const routes=readFileSync(resolve(process.cwd(),'src/routes/index.ts'),'utf8');
  for (const path of ['/notifications','/notifications/:id/read','/notifications/read-all','/support/tickets','/support/tickets/:id','/support/tickets/:id/messages']) {
    if (!routes.includes(path)) throw new Error(`missing ${path}`);
  }
  const migration=readFileSync(resolve(process.cwd(),'../database/migrations/027_notifications_support_integrity.sql'),'utf8');
  if (!migration.includes('notifications_category_chk')||!migration.includes('support_tickets_status_chk')) throw new Error('integrity migration incomplete');
});
