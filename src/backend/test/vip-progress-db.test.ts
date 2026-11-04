import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { createDatabaseClient, type ConnectedDatabaseClient } from '../src/core/database/postgres.client.js';
import * as auth from '../src/modules/auth/service.js';
import { syncVipLevel, claimVipSalary, getVipOverview } from '../src/modules/vip_referral/vip.service.js';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testSecret123@localhost:54328/n5_idempotency_test';
const randomPhone = () => `+92300${crypto.randomInt(1000000, 9999999)}`;

describe('VIP levels, bonuses and salary (PostgreSQL)', () => {
  let db: ConnectedDatabaseClient | undefined;

  beforeAll(async () => {
    const candidate = createDatabaseClient(TEST_DB_URL);
    try {
      await candidate.query('SELECT deposit_required_minor FROM vip_levels LIMIT 0');
      db = candidate;
    } catch {
      await candidate.close().catch(() => {});
      console.info(`[INFO] Migrated PostgreSQL test database not available at ${TEST_DB_URL}. Skipping.`);
    }
  });

  afterAll(async () => { await db?.close(); });

  const balance = async (userId: string) =>
    BigInt((await db!.query<{ a: string }>(`SELECT available_minor::text AS a FROM wallet_accounts WHERE user_id=$1`, [userId])).rows[0].a);

  async function deposit(userId: string, minor: number) {
    await db!.query(
      `INSERT INTO transactions (user_id, wallet_account_id, type, status, amount_minor, currency, idempotency_key)
       SELECT $1, id, 'deposit', 'completed', $2, 'PKR', $3 FROM wallet_accounts WHERE user_id=$1`,
      [userId, minor, `vip-test-dep-${crypto.randomUUID()}`]);
  }
  async function bet(userId: string, minor: number) {
    await db!.query(
      `INSERT INTO ledger_entries (wallet_account_id, entry_type, direction, amount_minor, currency)
       SELECT id, 'game_bet', 'debit', $2, 'PKR' FROM wallet_accounts WHERE user_id=$1`, [userId, minor]);
  }

  it('reaches level 2 only when both deposit and betting targets are met, and pays the bonus once', async (ctx) => {
    if (!db) return ctx.skip();
    // Level 2 is seeded with Rs 5,000 deposit, Rs 10,000 betting, Rs 10 bonus, Rs 2 salary.
    const p = await auth.register({ phone: randomPhone(), dob: '1990-01-01', password: 'Password-123' }, db);
    await deposit(p.userId, 500000);
    expect(await syncVipLevel(db, p.userId)).toBe(1);

    await bet(p.userId, 1000000);
    const before = await balance(p.userId);
    expect(await syncVipLevel(db, p.userId)).toBe(2);
    expect(await balance(p.userId)).toBe(before + 1000n);

    // Syncing again (or in parallel) never pays the bonus twice.
    await Promise.all([syncVipLevel(db, p.userId), syncVipLevel(db, p.userId)]);
    expect(await balance(p.userId)).toBe(before + 1000n);

    const note = (await db.query(`SELECT title FROM notifications WHERE user_id=$1`, [p.userId])).rows;
    expect(note.map((n: any) => n.title)).toContain('VIP 2 reached!');
  });

  it('pays the daily salary once per day', async (ctx) => {
    if (!db) return ctx.skip();
    const p = await auth.register({ phone: randomPhone(), dob: '1990-01-01', password: 'Password-123' }, db);
    await expect(claimVipSalary(db, p.userId)).rejects.toMatchObject({ code: 'NO_SALARY_FOR_LEVEL' });

    await deposit(p.userId, 500000);
    await bet(p.userId, 1000000);
    const before = await balance(p.userId);
    expect(await claimVipSalary(db, p.userId)).toEqual({ level: 2, amountMinor: 200 });
    await expect(claimVipSalary(db, p.userId)).rejects.toMatchObject({ code: 'SALARY_ALREADY_CLAIMED' });
    // Level bonus (Rs 10) + one salary (Rs 2).
    expect(await balance(p.userId)).toBe(before + 1000n + 200n);
    expect((await getVipOverview(db, p.userId)).salaryClaimedToday).toBe(true);
  });

  it('a level with no targets set cannot be reached', async (ctx) => {
    if (!db) return ctx.skip();
    const p = await auth.register({ phone: randomPhone(), dob: '1990-01-01', password: 'Password-123' }, db);
    await deposit(p.userId, 100000000);
    await bet(p.userId, 100000000);
    // Only level 2 has targets in a fresh database.
    expect(await syncVipLevel(db, p.userId)).toBe(2);
    expect((await getVipOverview(db, p.userId)).next).toBeNull();
  });
});
