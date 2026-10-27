import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';

test('account statement.route contract', () => {
  const route = readFileSync(join(process.cwd(), 'src/routes/index.ts'), 'utf8');
  assert.match(route, /router\.get\('\/wallet\/statement', requireAuth, getMyAccountStatement\)/);
});
