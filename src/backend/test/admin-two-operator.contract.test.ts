import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';

test('admin two operator contract', () => {
  const migration = fs.readFileSync(new URL('../../database/migrations/030_admin_two_operator_and_operations.sql', import.meta.url), 'utf8');
  const routes = fs.readFileSync(new URL('../src/routes/index.ts', import.meta.url), 'utf8');
  const access = fs.readFileSync(new URL('../src/modules/admin/admin-access.middleware.ts', import.meta.url), 'utf8');
  const controller = fs.readFileSync(new URL('../src/modules/admin/admin-operations.controller.ts', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../src/modules/admin/admin-operations.service.ts', import.meta.url), 'utf8');
  assert.match(migration, /N5_ADMIN_OPERATOR_LIMIT_REACHED/);
  assert.match(migration, /COUNT\(\*\) FROM admin_users WHERE status='active'/);
  for (const route of ['/admin/overview','/admin/users','/admin/users/:userId/kyc','/admin/risk/:flagId','/admin/support/tickets','/admin/config']) assert.match(routes, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(access, /FROM admin_users au JOIN admin_roles ar/);
  assert.match(access, /status !== 'active'/);
  assert.match(service, /admin\.kyc\.review/);
  assert.match(service, /admin\.risk\.update/);
  assert.match(service, /admin\.support\.status/);
  assert.match(controller, /adminKycReview/);
  assert.match(controller, /adminRiskUpdate/);
  assert.match(controller, /adminSupportStatus/);
});
