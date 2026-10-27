import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';

test('account statement.sql contract', () => {
  const service = readFileSync(join(process.cwd(), 'src/modules/transactions/account-statement.service.ts'), 'utf8');
  assert.match(service, /WITH bounds AS/);
  assert.match(service, /tx AS/);
  assert.match(service, /wd AS/);
  assert.match(service, /FROM tx CROSS JOIN wd/);
});
