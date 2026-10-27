import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { createDatabaseClient, type ConnectedDatabaseClient } from '../src/core/database/postgres.client.js';
import { requestDeposit, requestWithdrawal } from '../src/modules/payments/cashier.controller.js';
import { PaymentIdempotencyService } from '../src/modules/payments/payment-idempotency.service.js';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testSecret123@localhost:54328/n5_idempotency_test';

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
  };
  return res;
}

describe('Cashier Durable Idempotency & Reference Uniqueness Integration', () => {
  let db: ConnectedDatabaseClient | undefined;
  let isDbAvailable = false;
  let testUserAId: string;
  let testUserBId: string;
  let walletAccountAId: string;
  let walletAccountBId: string;

  beforeAll(async () => {
    try {
      db = createDatabaseClient(TEST_DB_URL);
      await db.query('SELECT 1');
      isDbAvailable = true;
    } catch {
      console.warn(`[INFO] PostgreSQL test database not reachable at ${TEST_DB_URL}. Skipping live DB integration tests in offline mode.`);
      return;
    }

    // Create isolated test users
    testUserAId = crypto.randomUUID();
    testUserBId = crypto.randomUUID();

    await db.query(
      `INSERT INTO users (id, phone_e164, date_of_birth, password_hash, status)
       VALUES ($1, $2, '1995-05-05', 'test_hash', 'active'),
              ($3, $4, '1996-06-06', 'test_hash', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [testUserAId, '+923009988771', testUserBId, '+923009988772'],
    );

    // Seed wallet accounts with initial balance of 50,000 PKR (5,000,000 minor)
    const walletResA = await db.query<{ id: string }>(
      `INSERT INTO wallet_accounts (user_id, currency, available_minor, locked_minor)
       VALUES ($1, 'PKR', 5000000, 0)
       RETURNING id`,
      [testUserAId],
    );
    walletAccountAId = walletResA.rows[0].id;

    const walletResB = await db.query<{ id: string }>(
      `INSERT INTO wallet_accounts (user_id, currency, available_minor, locked_minor)
       VALUES ($1, 'PKR', 5000000, 0)
       RETURNING id`,
      [testUserBId],
    );
    walletAccountBId = walletResB.rows[0].id;
  });

  beforeEach((ctx) => {
    if (!isDbAvailable) {
      ctx.skip();
    }
  });

  afterAll(async () => {
    if (!db || !isDbAvailable) return;
    // Clean up test data
    try {
      await db.query('DELETE FROM payment_idempotency_records WHERE user_id IN ($1, $2)', [testUserAId, testUserBId]);
      await db.query('DELETE FROM withdrawals WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id IN ($1, $2))', [testUserAId, testUserBId]);
      await db.query('DELETE FROM deposits WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id IN ($1, $2))', [testUserAId, testUserBId]);
      await db.query('DELETE FROM transactions WHERE user_id IN ($1, $2)', [testUserAId, testUserBId]);
      await db.query('DELETE FROM wallet_accounts WHERE id IN ($1, $2)', [walletAccountAId, walletAccountBId]);
      await db.query('DELETE FROM users WHERE id IN ($1, $2)', [testUserAId, testUserBId]);
    } catch (_) {}
    await db.close().catch(() => {});
  });

  // -------------------------------------------------------------
  // 1. DUPLICATE REFERENCE TEST
  // -------------------------------------------------------------
  it('enforces provider-scoped TRX uniqueness in PostgreSQL and rejects duplicate submissions', async () => {
    const trxId = `EP_${Date.now()}`;

    // First deposit submission
    const req1: any = {
      auth: { userId: testUserAId },
      app: { locals: { db } },
      body: {
        amountPkr: 500,
        gateway: 'easypaisa',
        trxId,
        senderPhone: '03001234567',
      },
      headers: {},
    };
    const res1 = createMockResponse();
    await requestDeposit(req1 as Request, res1 as Response);

    expect(res1.statusCode).toBe(201);
    expect(res1.body?.ok).toBe(true);
    expect(res1.body?.data?.trxId).toBe(trxId);

    // Duplicate submission attempt with same gateway and same trxId (even by different user)
    const req2: any = {
      auth: { userId: testUserBId },
      app: { locals: { db } },
      body: {
        amountPkr: 500,
        gateway: 'easypaisa',
        trxId,
        senderPhone: '03009999999',
      },
      headers: {},
    };
    const res2 = createMockResponse();
    await requestDeposit(req2 as Request, res2 as Response);

    expect(res2.statusCode).toBe(409);
    expect(res2.body?.ok).toBe(false);
    expect(res2.body?.error?.code).toBe('DUPLICATE_TRX_ID');

    // Verify DB contains exactly 1 deposit record for this TRX
    const countRes = await db.query<{ count: string }>(
      `SELECT count(*) FROM deposits WHERE LOWER(provider_name) = 'easypaisa' AND LOWER(provider_reference) = LOWER($1)`,
      [trxId],
    );
    expect(parseInt(countRes.rows[0].count, 10)).toBe(1);

    // Provider Scope Check: Same TRX string for JazzCash is permitted because provider scope is different
    const reqJazz: any = {
      auth: { userId: testUserAId },
      app: { locals: { db } },
      body: {
        amountPkr: 500,
        gateway: 'jazzcash',
        trxId,
        senderPhone: '03001234567',
      },
      headers: {},
    };
    const resJazz = createMockResponse();
    await requestDeposit(reqJazz as Request, resJazz as Response);

    expect(resJazz.statusCode).toBe(201);
    expect(resJazz.body?.ok).toBe(true);
    expect(resJazz.body?.data?.gateway).toBe('jazzcash');
  });

  // -------------------------------------------------------------
  // 2. REQUEST RETRY (DURABLE IDEMPOTENCY)
  // -------------------------------------------------------------
  it('returns identical result on deposit request retry without duplicating transactions', async () => {
    const key = `dep-retry-${Date.now()}`;
    const trxId = `TRX_DEP_${Date.now()}`;

    const makeReq = () => ({
      auth: { userId: testUserAId },
      app: { locals: { db } },
      body: {
        amountPkr: 1500,
        gateway: 'easypaisa',
        trxId,
        senderPhone: '03001234567',
      },
      headers: {
        'idempotency-key': key,
      },
    });

    // Attempt 1
    const res1 = createMockResponse();
    await requestDeposit(makeReq() as any, res1 as Response);

    expect(res1.statusCode).toBe(201);
    expect(res1.body?.ok).toBe(true);
    const initialTxId = res1.body?.data?.transactionId;
    const initialDepositId = res1.body?.data?.depositId;

    // Attempt 2 (Exact Retry)
    const res2 = createMockResponse();
    await requestDeposit(makeReq() as any, res2 as Response);

    expect(res2.statusCode).toBe(201);
    expect(res2.body?.ok).toBe(true);
    expect(res2.body?.data?.transactionId).toBe(initialTxId);
    expect(res2.body?.data?.depositId).toBe(initialDepositId);

    // Verify exactly ONE transaction row exists in database for this idempotency key
    const txCheck = await db.query<{ count: string }>(
      `SELECT count(*) FROM transactions WHERE idempotency_key = $1`,
      [key],
    );
    expect(parseInt(txCheck.rows[0].count, 10)).toBe(1);
  });

  it('returns identical result on withdrawal request retry without duplicate wallet holds', async () => {
    const key = `wd-retry-${Date.now()}`;

    // Get current available balance before withdrawal
    const beforeBal = await db.query<{ available_minor: string; locked_minor: string }>(
      `SELECT available_minor, locked_minor FROM wallet_accounts WHERE id = $1`,
      [walletAccountAId],
    );
    const startAvailable = BigInt(beforeBal.rows[0].available_minor);
    const startLocked = BigInt(beforeBal.rows[0].locked_minor);

    const makeWithdrawalReq = () => ({
      auth: { userId: testUserAId },
      app: { locals: { db } },
      body: {
        amountPkr: 2000,
        gateway: 'easypaisa',
        accountPhone: '03001234567',
        accountTitle: 'Account Owner',
      },
      headers: {
        'idempotency-key': key,
      },
    });

    // Attempt 1
    const res1 = createMockResponse();
    await requestWithdrawal(makeWithdrawalReq() as any, res1 as Response);

    expect(res1.statusCode).toBe(201);
    expect(res1.body?.ok).toBe(true);
    const firstTxId = res1.body?.data?.transactionId;
    const firstWdId = res1.body?.data?.withdrawalId;

    // Check balance after 1st attempt: 2,000 PKR (200,000 minor) held
    const midBal = await db.query<{ available_minor: string; locked_minor: string }>(
      `SELECT available_minor, locked_minor FROM wallet_accounts WHERE id = $1`,
      [walletAccountAId],
    );
    expect(BigInt(midBal.rows[0].available_minor)).toBe(startAvailable - 200000n);
    expect(BigInt(midBal.rows[0].locked_minor)).toBe(startLocked + 200000n);

    // Attempt 2 (Exact Retry)
    const res2 = createMockResponse();
    await requestWithdrawal(makeWithdrawalReq() as any, res2 as Response);

    expect(res2.statusCode).toBe(201);
    expect(res2.body?.ok).toBe(true);
    expect(res2.body?.data?.transactionId).toBe(firstTxId);
    expect(res2.body?.data?.withdrawalId).toBe(firstWdId);

    // Crucial: Verify wallet was NOT deducted a second time!
    const finalBal = await db.query<{ available_minor: string; locked_minor: string }>(
      `SELECT available_minor, locked_minor FROM wallet_accounts WHERE id = $1`,
      [walletAccountAId],
    );
    expect(BigInt(finalBal.rows[0].available_minor)).toBe(startAvailable - 200000n);
    expect(BigInt(finalBal.rows[0].locked_minor)).toBe(startLocked + 200000n);

    // Verify exactly ONE transaction row exists in database for this idempotency key
    const countCheck = await db.query<{ count: string }>(
      `SELECT count(*) FROM transactions WHERE idempotency_key = $1`,
      [key],
    );
    expect(parseInt(countCheck.rows[0].count, 10)).toBe(1);
  });

  // -------------------------------------------------------------
  // 3. CONFLICTING PAYLOAD REJECTION
  // -------------------------------------------------------------
  it('rejects conflicting payload with same idempotency key for deposit (409 IDEMPOTENCY_CONFLICT)', async () => {
    const key = `conflict-dep-${Date.now()}`;

    // Request with amount 500
    const req1: any = {
      auth: { userId: testUserAId },
      app: { locals: { db } },
      body: {
        amountPkr: 500,
        gateway: 'easypaisa',
        trxId: `TRX_C1_${Date.now()}`,
      },
      headers: { 'idempotency-key': key },
    };
    const res1 = createMockResponse();
    await requestDeposit(req1 as Request, res1 as Response);
    expect(res1.statusCode).toBe(201);

    // Reuse key with different amount (1000)
    const req2: any = {
      auth: { userId: testUserAId },
      app: { locals: { db } },
      body: {
        amountPkr: 1000,
        gateway: 'easypaisa',
        trxId: `TRX_C2_${Date.now()}`,
      },
      headers: { 'idempotency-key': key },
    };
    const res2 = createMockResponse();
    await requestDeposit(req2 as Request, res2 as Response);

    expect(res2.statusCode).toBe(409);
    expect(res2.body?.ok).toBe(false);
    expect(res2.body?.error?.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('rejects conflicting payload with same idempotency key for withdrawal (409 IDEMPOTENCY_CONFLICT)', async () => {
    const key = `conflict-wd-${Date.now()}`;

    // Request with phone A
    const req1: any = {
      auth: { userId: testUserAId },
      app: { locals: { db } },
      body: {
        amountPkr: 500,
        gateway: 'easypaisa',
        accountPhone: '03001111111',
      },
      headers: { 'idempotency-key': key },
    };
    const res1 = createMockResponse();
    await requestWithdrawal(req1 as Request, res1 as Response);
    expect(res1.statusCode).toBe(201);

    // Reuse key with different phone B
    const req2: any = {
      auth: { userId: testUserAId },
      app: { locals: { db } },
      body: {
        amountPkr: 500,
        gateway: 'easypaisa',
        accountPhone: '03009999999',
      },
      headers: { 'idempotency-key': key },
    };
    const res2 = createMockResponse();
    await requestWithdrawal(req2 as Request, res2 as Response);

    expect(res2.statusCode).toBe(409);
    expect(res2.body?.ok).toBe(false);
    expect(res2.body?.error?.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  // -------------------------------------------------------------
  // 4. SIMULTANEOUS / CONCURRENT IDENTICAL REQUESTS
  // -------------------------------------------------------------
  it('prevents duplicate transactions and duplicate wallet holds under concurrent simultaneous requests', async () => {
    const key = `concurrent-wd-${Date.now()}`;

    // Check balance before
    const balBefore = await db.query<{ available_minor: string }>(
      `SELECT available_minor FROM wallet_accounts WHERE id = $1`,
      [walletAccountAId],
    );
    const avBefore = BigInt(balBefore.rows[0].available_minor);

    const makeConcurrentReq = () => {
      const req: any = {
        auth: { userId: testUserAId },
        app: { locals: { db } },
        body: {
          amountPkr: 300,
          gateway: 'easypaisa',
          accountPhone: '03001234567',
        },
        headers: { 'idempotency-key': key },
      };
      const res = createMockResponse();
      return { req, res, promise: requestWithdrawal(req as Request, res as Response) };
    };

    // Fire 6 simultaneous concurrent requests
    const tasks = Array.from({ length: 6 }, () => makeConcurrentReq());
    await Promise.all(tasks.map((t) => t.promise));

    const responses = tasks.map((t) => ({ status: t.res.statusCode, body: t.res.body }));

    // Count how many succeeded
    const createdCount = responses.filter((r) => r.status === 201).length;
    expect(createdCount).toBeGreaterThanOrEqual(1);

    // Any non-201 response must be a 409 REQUEST_IN_PROGRESS or replay
    for (const r of responses) {
      if (r.status !== 201) {
        expect(r.status).toBe(409);
        expect(r.body?.error?.code).toBe('REQUEST_IN_PROGRESS');
      }
    }

    // Verify exactly ONE transaction row exists in database for this key
    const countCheck = await db.query<{ count: string }>(
      `SELECT count(*) FROM transactions WHERE idempotency_key = $1`,
      [key],
    );
    expect(parseInt(countCheck.rows[0].count, 10)).toBe(1);

    // Verify wallet was only held for 300 PKR (30,000 minor) exactly ONCE
    const balAfter = await db.query<{ available_minor: string }>(
      `SELECT available_minor FROM wallet_accounts WHERE id = $1`,
      [walletAccountAId],
    );
    expect(BigInt(balAfter.rows[0].available_minor)).toBe(avBefore - 30000n);
  });

  // -------------------------------------------------------------
  // 5. PARTIAL FAILURE & ROLLBACK
  // -------------------------------------------------------------
  it('rolls back completely and records failure when business validation or DB constraint fails mid-transaction', async () => {
    const key = `partial-fail-${Date.now()}`;

    // Balance check
    const balBefore = await db.query<{ available_minor: string; locked_minor: string }>(
      `SELECT available_minor, locked_minor FROM wallet_accounts WHERE id = $1`,
      [walletAccountBId],
    );
    const startAvailable = BigInt(balBefore.rows[0].available_minor);

    // Attempt withdrawal exceeding available balance (e.g. 99,999,999 PKR)
    const req: any = {
      auth: { userId: testUserBId },
      app: { locals: { db } },
      body: {
        amountPkr: 99999999,
        gateway: 'easypaisa',
        accountPhone: '03001234567',
      },
      headers: { 'idempotency-key': key },
    };
    const res = createMockResponse();
    await requestWithdrawal(req as Request, res as Response);

    expect(res.statusCode).toBe(400);
    expect(res.body?.ok).toBe(false);
    expect(res.body?.error?.code).toBe('INSUFFICIENT_BALANCE');

    // Verify wallet balance is 100% untouched
    const balAfter = await db.query<{ available_minor: string }>(
      `SELECT available_minor FROM wallet_accounts WHERE id = $1`,
      [walletAccountBId],
    );
    expect(BigInt(balAfter.rows[0].available_minor)).toBe(startAvailable);

    // Verify NO transaction row was inserted
    const txCount = await db.query<{ count: string }>(
      `SELECT count(*) FROM transactions WHERE idempotency_key = $1`,
      [key],
    );
    expect(parseInt(txCount.rows[0].count, 10)).toBe(0);

    // Verify idempotency record reflects 'failed' status
    const idempCheck = await db.query<{ status: string }>(
      `SELECT status FROM payment_idempotency_records WHERE user_id = $1 AND idempotency_key = $2`,
      [testUserBId, key],
    );
    expect(idempCheck.rows[0]?.status).toBe('failed');
  });

  // -------------------------------------------------------------
  // 6. ACCOUNT SCOPE ISOLATION
  // -------------------------------------------------------------
  it('scopes idempotency keys per user account so two users can use identical key without collision', async () => {
    const sharedKey = `shared-key-user-scope-${Date.now()}`;

    // User A request
    const reqA: any = {
      auth: { userId: testUserAId },
      app: { locals: { db } },
      body: {
        amountPkr: 200,
        gateway: 'easypaisa',
        accountPhone: '03001112233',
      },
      headers: { 'idempotency-key': sharedKey },
    };
    const resA = createMockResponse();
    await requestWithdrawal(reqA as Request, resA as Response);
    expect(resA.statusCode).toBe(201);

    // User B request with SAME idempotency key
    const reqB: any = {
      auth: { userId: testUserBId },
      app: { locals: { db } },
      body: {
        amountPkr: 200,
        gateway: 'easypaisa',
        accountPhone: '03004445566',
      },
      headers: { 'idempotency-key': sharedKey },
    };
    const resB = createMockResponse();
    await requestWithdrawal(reqB as Request, resB as Response);

    // User B must SUCCEED because idempotency is scoped to (user_id, scope, idempotency_key)
    expect(resB.statusCode).toBe(201);
    expect(resB.body?.data?.transactionId).not.toBe(resA.body?.data?.transactionId);

    // Both users have separate records
    const records = await db.query<{ user_id: string }>(
      `SELECT user_id FROM payment_idempotency_records WHERE idempotency_key = $1`,
      [sharedKey],
    );
    expect(records.rows.length).toBe(2);
  });
});

describe('Cashier without a configured database', () => {
  it('fails closed with 503 for deposits and withdrawals', async () => {
    const depositRes = createMockResponse();
    await requestDeposit({
      auth: { userId: 'no-db-user' },
      app: { locals: { db: undefined } },
      body: { amountPkr: 500, gateway: 'easypaisa', trxId: `NODB_${Date.now()}` },
      headers: {},
    } as any, depositRes as Response);
    expect(depositRes.statusCode).toBe(503);
    expect(depositRes.body?.error?.code).toBe('PAYMENTS_STORE_UNAVAILABLE');

    const withdrawalRes = createMockResponse();
    await requestWithdrawal({
      auth: { userId: 'no-db-user' },
      app: { locals: { db: undefined } },
      body: { amountPkr: 300, gateway: 'easypaisa', accountPhone: '03001234567' },
      headers: { 'idempotency-key': `nodb-${Date.now()}` },
    } as any, withdrawalRes as Response);
    expect(withdrawalRes.statusCode).toBe(503);
    expect(withdrawalRes.body?.error?.code).toBe('PAYMENTS_STORE_UNAVAILABLE');
  });
});

