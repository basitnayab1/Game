import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from 'vitest';

test('admin promotions rewards contract', () => {
  const routes=readFileSync(new URL("../src/routes/index.ts",import.meta.url),"utf8");
  assert.match(routes,/admin\/promotions/);
  assert.match(routes,/admin\/reward-configs/);
  const migration=readFileSync(new URL("../../database/migrations/032_admin_promotions_rewards.sql",import.meta.url),"utf8");
  assert.match(migration,/admin_reward_cycle_configs/);
});
