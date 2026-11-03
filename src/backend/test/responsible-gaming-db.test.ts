import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createDatabaseClient, type ConnectedDatabaseClient } from '../src/core/database/postgres.client.js';
import { createApp } from '../src/app.js';
import * as auth from '../src/modules/auth/service.js';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testSecret123@localhost:54328/n5_idempotency_test';
const randomPhone = () => `+92300${crypto.randomInt(1000000, 9999999)}`;

describe('Responsible gaming, lucky wheel and referrals (PostgreSQL)', () => {
  let db: ConnectedDatabaseClient | undefined;
  let server: Server;
  let baseUrl = '';

  beforeAll(async () => {
    const candidate = createDatabaseClient(TEST_DB_URL);
    try {
      await candidate.query('SELECT failed_login_count FROM users LIMIT 0');
      db = candidate;
    } catch {
      await candidate.close().catch(() => {});
      console.info(`[INFO] Migrated PostgreSQL test database not available at ${TEST_DB_URL}. Skipping.`);
      return;
    }
    server = createApp(db).listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  });

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await db?.close();
  });

  async function player(balanceMinor = 0) {
    const s = await auth.register({ phone: randomPhone(), dob: '1990-01-01', password: 'Password-123' }, db!);
    if (balanceMinor) await db!.query('UPDATE wallet_accounts SET available_minor = $2 WHERE user_id = $1', [s.userId, balanceMinor]);
    const call = (method: string, path: string, body?: unknown) =>
      fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${s.accessToken}` },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    return { ...s, call };
  }
  const deposit = (p: Awaited<ReturnType<typeof player>>, amountPkr: number) =>
    p.call('POST', '/payments/deposits', { amountPkr, gateway: 'easypaisa', mode: 'manual', trxId: `T${crypto.randomInt(1e9, 9e9)}` });

  it('enforces the daily deposit limit', async (ctx) => {
    if (!db) return ctx.skip();
    const p = await player();
    expect((await p.call('PATCH', '/responsible-gaming', { depositLimitMinor: 100000 })).status).toBe(200);
    expect((await deposit(p, 600)).status).toBeLessThan(300);
    const blocked = await deposit(p, 500);
    expect(blocked.status).toBe(403);
    expect(((await blocked.json()) as any).error.code).toBe('DEPOSIT_LIMIT_REACHED');
  });

  it('enforces the daily loss limit on slot spins', async (ctx) => {
    if (!db) return ctx.skip();
    const p = await player(1_000_000);
    await p.call('PATCH', '/responsible-gaming', { lossLimitMinor: 1500 });
    const spin = await p.call('POST', '/games/play/spin', { betMinor: 2000 });
    expect(spin.status).toBe(403);
    expect(((await spin.json()) as any).error.code).toBe('LOSS_LIMIT_REACHED');
  });

  it('a break blocks play, deposits and the wheel, and cannot be shortened', async (ctx) => {
    if (!db) return ctx.skip();
    const p = await player(1_000_000);
    const until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    expect((await p.call('PATCH', '/responsible-gaming', { takeABreakUntil: until })).status).toBe(200);

    expect((await p.call('POST', '/games/play/spin', { betMinor: 1000 })).status).toBe(403);
    expect((await deposit(p, 500)).status).toBe(403);
    expect((await p.call('POST', '/rewards/wheel/spin', {})).status).toBe(403);

    const earlier = new Date(Date.now() + 60 * 1000).toISOString();
    const r = await p.call('PATCH', '/responsible-gaming', { takeABreakUntil: earlier });
    expect(new Date(((await r.json()) as any).data.takeABreakUntil).getTime()).toBe(new Date(until).getTime());
  });

  async function completedDeposit(userId: string) {
    await db!.query(
      `INSERT INTO transactions (user_id, wallet_account_id, type, status, amount_minor, currency, idempotency_key)
       SELECT $1, id, 'deposit', 'completed', 50000, 'PKR', $2 FROM wallet_accounts WHERE user_id = $1`,
      [userId, `test-deposit-${crypto.randomUUID()}`],
    );
  }

  it('the lucky wheel is locked until the first completed deposit', async (ctx) => {
    if (!db) return ctx.skip();
    const p = await player();
    const status = ((await (await p.call('GET', '/rewards/wheel')).json()) as any).data;
    expect(status).toMatchObject({ canSpin: false, depositRequired: true });
    const spin = await p.call('POST', '/rewards/wheel/spin', {});
    expect(spin.status).toBe(403);
    expect(((await spin.json()) as any).error.code).toBe('DEPOSIT_REQUIRED');
  });

  it('the lucky wheel pays once per day, even for parallel spins', async (ctx) => {
    if (!db) return ctx.skip();
    const p = await player();
    await completedDeposit(p.userId);
    expect(((await (await p.call('GET', '/rewards/wheel')).json()) as any).data.canSpin).toBe(true);

    const results = await Promise.all(Array.from({ length: 5 }, () => p.call('POST', '/rewards/wheel/spin', {})));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 429)).toHaveLength(4);

    const claims = (await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM reward_events WHERE user_id = $1 AND reward_type = 'daily_wheel'`, [p.userId])).rows[0];
    expect(claims.n).toBe('1');
    expect(((await (await p.call('GET', '/rewards/wheel')).json()) as any).data.canSpin).toBe(false);
  });

  it('links a new player to the inviter through the referral code', async (ctx) => {
    if (!db) return ctx.skip();
    const inviter = await player();
    const code = ((await (await inviter.call('GET', '/referral')).json()) as any).data.code as string;

    const invited = await auth.register({ phone: randomPhone(), dob: '1990-01-01', password: 'Password-123', referralCode: code.toLowerCase() }, db);
    const link = (await db.query('SELECT 1 FROM referrals WHERE inviter_user_id = $1 AND invited_user_id = $2', [inviter.userId, invited.userId])).rows;
    expect(link).toHaveLength(1);
    expect(((await (await inviter.call('GET', '/referral')).json()) as any).data.summary.total).toBe(1);

    await expect(auth.register({ phone: randomPhone(), dob: '1990-01-01', password: 'Password-123', referralCode: 'NOPE1234' }, db))
      .rejects.toThrow('INVALID_REFERRAL_CODE');
  });
});
