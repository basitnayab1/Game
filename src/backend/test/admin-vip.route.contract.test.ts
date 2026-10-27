import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

test('admin VIP routes and policy are present',()=>{
 const routes=readFileSync('src/routes/index.ts','utf8');
 const service=readFileSync('src/modules/admin/admin-vip.service.ts','utf8');
 const migration=readFileSync('../database/migrations/033_admin_vip_management.sql','utf8');
 assert.match(routes,/\/admin\/vip\/levels/);
 assert.match(routes,/adminVipLevelUpdate/);
 assert.match(service,/admin\.vip\.update/);
 assert.match(migration,/daily_salary_minor=33300/);
});
