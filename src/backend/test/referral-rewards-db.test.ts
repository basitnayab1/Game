import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { createDatabaseClient, type ConnectedDatabaseClient } from '../src/core/database/postgres.client.js';
import * as auth from '../src/modules/auth/service.js';
import { payDepositCommission, settleReferralQualification } from '../src/modules/referral/referral-rewards.js';
import { listReferralHistory, getReferralSummary, ensureReferralCode } from '../src/modules/referral/referral.service.js';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testSecret123@localhost:54328/n5_idempotency_test';
const randomPhone = () => `+92300${crypto.randomInt(1000000, 9999999)}`;

describe('Referral rewards (PostgreSQL)', () => {
  let db: ConnectedDatabaseClient | undefined;

  beforeAll(async () => {
    const candidate = createDatabaseClient(TEST_DB_URL);
    try {
      await candidate.query('SELECT 1 FROM referral_earnings LIMIT 0');
      db = candidate;
    } catch {
      await candidate.close().catch(() => {});
      console.info(`[INFO] Migrated PostgreSQL test database not available at ${TEST_DB_URL}. Skipping.`);
    }
  });
  afterAll(async () => { await db?.close(); });

  const balance = async (userId: string) =>
    BigInt((await db!.query<{ a: string }>(`SELECT available_minor::text AS a FROM wallet_accounts WHERE user_id=$1`, [userId])).rows[0].a);

  async function completedDeposit(userId: string, minor: number) {
    return db!.transaction(async (tx) => {
      const t = (await tx.query<{ id: string }>(
        `INSERT INTO transactions (user_id, wallet_account_id, type, status, amount_minor, currency, idempotency_key)
         SELECT $1, id, 'deposit', 'completed', $2, 'PKR', $3 FROM wallet_accounts WHERE user_id=$1 RETURNING id`,
        [userId, minor, `ref-test-${crypto.randomUUID()}`])).rows[0];
      await payDepositCommission(tx, userId, t.id, BigInt(minor));
      return t.id;
    });
  }
  async function bet(userId: string, minor: number) {
    await db!.query(`INSERT INTO ledger_entries (wallet_account_id, entry_type, direction, amount_minor, currency)
      SELECT id, 'game_bet', 'debit', $2, 'PKR' FROM wallet_accounts WHERE user_id=$1`, [userId, minor]);
  }

  async function pair() {
    const inviter = await auth.register({ phone: randomPhone(), dob: '1990-01-01', password: 'Password-123' }, db!);
    const code = await ensureReferralCode(db!, inviter.userId);
    const friend = await auth.register({ phone: randomPhone(), dob: '1990-01-01', password: 'Password-123', referralCode: code }, db!);
    return { inviter: inviter.userId, friend: friend.userId };
  }

  it('pays Rs 5 per Rs 1,000 of every deposit the friend makes, once per deposit', async (ctx) => {
    if (!db) return ctx.skip();
    const { inviter, friend } = await pair();
    const before = await balance(inviter);
    const txId = await completedDeposit(friend, 100000); // Rs 1,000
    expect(await balance(inviter)).toBe(before + 500n);
    // The same deposit never pays twice.
    await db.transaction((tx) => payDepositCommission(tx, friend, txId, 100000n));
    expect(await balance(inviter)).toBe(before + 500n);
  });

  it('pays Rs 400 once the friend has deposited Rs 600 and bet Rs 6,000, and only once', async (ctx) => {
    if (!db) return ctx.skip();
    const { inviter, friend } = await pair();
    await completedDeposit(friend, 60000); // Rs 600 -> Rs 3 commission
    await bet(friend, 500000);
    expect(await settleReferralQualification(db, friend)).toBe(false);

    await bet(friend, 100000); // Rs 6,000 in total
    const before = await balance(inviter);
    const results = await Promise.all([1, 2, 3].map(() => settleReferralQualification(db!, friend)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await balance(inviter)).toBe(before + 40000n);

    const [row] = await listReferralHistory(db, inviter);
    expect(row).toMatchObject({ status: 'rewarded', depositedMinor: 60000, betMinor: 600000, earnedMinor: 40300 });
    expect(row.phone).toContain('****');
    expect((await getReferralSummary(db, inviter)).earnedMinor).toBe(40300);
  });

  it('pays nothing for a player who was not invited', async (ctx) => {
    if (!db) return ctx.skip();
    const solo = await auth.register({ phone: randomPhone(), dob: '1990-01-01', password: 'Password-123' }, db);
    await completedDeposit(solo.userId, 100000);
    expect(await settleReferralQualification(db, solo.userId)).toBe(false);
    expect((await db.query(`SELECT 1 FROM referral_earnings e JOIN referrals r ON r.id=e.referral_id WHERE r.invited_user_id=$1`, [solo.userId])).rows).toHaveLength(0);
  });
});
