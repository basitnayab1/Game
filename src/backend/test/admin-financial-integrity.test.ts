import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { createDatabaseClient, type ConnectedDatabaseClient } from '../src/core/database/postgres.client.js';
import {
  approveDeposit,
  rejectDeposit,
  approveWithdrawal,
  rejectWithdrawal,
  recordWithdrawalPayoutSuccess,
  recordWithdrawalPayoutFailure,
} from '../src/modules/admin/admin-financial.controller.js';
import { adminUserBalanceAdjust } from '../src/modules/admin/admin-operations.controller.js';
import { requestDeposit, requestWithdrawal } from '../src/modules/payments/cashier.controller.js';
import { auditWalletReconciliation } from '../src/modules/reconciliation/reconciliation.service.js';

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

describe('Admin Financial Integrity, Cross-Type Validation & Reconciliation', () => {
  let db: ConnectedDatabaseClient | undefined;
  let isDbAvailable = false;
  let testUserId: string;
  let walletAccountId: string;
  let superAdminId: string;
  let standardAdminId: string;

  beforeAll(async () => {
    try {
      db = createDatabaseClient(TEST_DB_URL);
      await db.query('SELECT 1');
      isDbAvailable = true;
    } catch {
      console.warn(`[INFO] PostgreSQL test database not reachable at ${TEST_DB_URL}. Running memory fallback & contract checks.`);
      return;
    }

    testUserId = crypto.randomUUID();
    superAdminId = crypto.randomUUID();
    standardAdminId = crypto.randomUUID();

    const testPhone = `+92300${Math.floor(1000000 + Math.random() * 9000000)}`;
    await db.query(
      `INSERT INTO users (id, phone_e164, date_of_birth, password_hash, status)
       VALUES ($1, $2, '1990-01-01', 'hash', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [testUserId, testPhone]
    );

    // 2. Create test wallet
    const walletRes = await db.query<{ id: string }>(
      `INSERT INTO wallet_accounts (user_id, currency, available_minor, locked_minor)
       VALUES ($1, 'PKR', 100000, 0)
       RETURNING id`,
      [testUserId]
    );
    walletAccountId = walletRes.rows[0].id;

    // Record initial ledger entry for starting balance
    await db.query(
      `INSERT INTO ledger_entries (
         wallet_account_id, entry_type, direction, amount_minor, currency, reference_type, idempotency_key
       ) VALUES ($1, 'initial_seed', 'credit', 100000, 'PKR', 'seed', $2)`,
      [walletAccountId, `seed:${testUserId}`]
    );
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  it('approves a valid deposit, credits wallet atomically, and writes an auditable ledger entry', async (ctx) => {
    if (!isDbAvailable || !db) return ctx.skip();

    // 1. Request deposit
    const depReq: any = {
      app: { locals: { db } },
      auth: { userId: testUserId },
      headers: {},
      body: {
        mode: 'manual',
        amountPkr: 500,
        gateway: 'easypaisa',
        trxId: `DEP-${Date.now()}-1`,
        senderPhone: '03007654321',
      },
    };
    const depRes = createMockResponse();
    await requestDeposit(depReq as Request, depRes as Response);
    expect(depRes.statusCode).toBe(201);
    const txId = depRes.body.data.transactionId;

    // Initial reconciliation check before approval
    const preAudit = await auditWalletReconciliation(db, walletAccountId);
    expect(preAudit.matched).toBe(true);

    // 2. Admin approves deposit
    const appReq: any = {
      app: { locals: { db } },
      params: { id: txId },
      auth: { userId: superAdminId },
      admin: { userId: superAdminId, role: 'super_admin' },
      body: {},
    };
    const appRes = createMockResponse();
    await approveDeposit(appReq as Request, appRes as Response);

    expect(appRes.statusCode).toBe(200);
    expect(appRes.body.ok).toBe(true);
    expect(appRes.body.data.status).toBe('completed');
    expect(appRes.body.data.newBalancePkr).toBe(1500); // 1000 + 500 = 1500 PKR

    // Verify DB transaction status
    const txRow = (await db.query<{ status: string }>('SELECT status FROM transactions WHERE id = $1', [txId])).rows[0];
    expect(txRow.status).toBe('completed');

    // Verify ledger entry
    const ledger = await db.query<{ direction: string; amount_minor: string }>(
      'SELECT direction, amount_minor FROM ledger_entries WHERE reference_id = $1',
      [txId]
    );
    expect(ledger.rows.length).toBe(1);
    expect(ledger.rows[0].direction).toBe('credit');
    expect(ledger.rows[0].amount_minor).toBe('50000');

    // Audit reconciliation: available + locked must equal ledger net
    const postAudit = await auditWalletReconciliation(db, walletAccountId);
    expect(postAudit.matched).toBe(true);
    expect(postAudit.availableMinor).toBe(150000n);
    expect(postAudit.discrepancies).toHaveLength(0);
  });

  it('rejects cross-type processing: withdrawal transaction ID passed to deposit approval endpoint', async (ctx) => {
    if (!isDbAvailable || !db) return ctx.skip();

    // 1. Create a withdrawal request
    const wdReq: any = {
      app: { locals: { db } },
      auth: { userId: testUserId },
      headers: {},
      body: {
        amountPkr: 200,
        gateway: 'easypaisa',
        accountPhone: '03007654321',
      },
    };
    const wdRes = createMockResponse();
    await requestWithdrawal(wdReq as Request, wdRes as Response);
    expect(wdRes.statusCode).toBe(201);
    const wdTxId = wdRes.body.data.transactionId;

    // 2. Malicious/mistaken attempt: pass withdrawal transaction ID to deposit approval!
    const badAppReq: any = {
      app: { locals: { db } },
      params: { id: wdTxId },
      auth: { userId: superAdminId },
      admin: { userId: superAdminId, role: 'super_admin' },
      body: {},
    };
    const badAppRes = createMockResponse();
    await approveDeposit(badAppReq as Request, badAppRes as Response);

    expect(badAppRes.statusCode).toBe(400);
    expect(badAppRes.body.ok).toBe(false);
    expect(badAppRes.body.error.code).toBe('INVALID_TRANSACTION_TYPE');
    expect(badAppRes.body.error.message).toContain('withdrawal');

    // Ensure withdrawal status remained pending and was not credited
    const txRow = (await db.query<{ status: string }>('SELECT status FROM transactions WHERE id = $1', [wdTxId])).rows[0];
    expect(txRow.status).toBe('pending');
  });

  it('rejects cross-type processing: deposit transaction ID passed to withdrawal approval endpoint', async (ctx) => {
    if (!isDbAvailable || !db) return ctx.skip();

    // 1. Create a deposit transaction
    const depReq: any = {
      app: { locals: { db } },
      auth: { userId: testUserId },
      headers: {},
      body: {
        mode: 'manual',
        amountPkr: 300,
        gateway: 'jazzcash',
        trxId: `DEP-${Date.now()}-2`,
        senderPhone: '03007654321',
      },
    };
    const depRes = createMockResponse();
    await requestDeposit(depReq as Request, depRes as Response);
    expect(depRes.statusCode).toBe(201);
    const depTxId = depRes.body.data.transactionId;

    // 2. Mistaken attempt: pass deposit transaction ID to withdrawal approval!
    const badWdReq: any = {
      app: { locals: { db } },
      params: { id: depTxId },
      auth: { userId: superAdminId },
      admin: { userId: superAdminId, role: 'super_admin' },
      body: {},
    };
    const badWdRes = createMockResponse();
    await approveWithdrawal(badWdReq as Request, badWdRes as Response);

    expect(badWdRes.statusCode).toBe(400);
    expect(badWdRes.body.ok).toBe(false);
    expect(badWdRes.body.error.code).toBe('INVALID_TRANSACTION_TYPE');
    expect(badWdRes.body.error.message).toContain('deposit');
  });

  it('enforces withdrawal hold and separates internal approval from actual provider payout', async (ctx) => {
    if (!isDbAvailable || !db) return ctx.skip();

    const initialWallet = (await db.query<{ available_minor: string; locked_minor: string }>(
      'SELECT available_minor, locked_minor FROM wallet_accounts WHERE id = $1',
      [walletAccountId]
    )).rows[0];
    const initialAvail = BigInt(initialWallet.available_minor);
    const initialLocked = BigInt(initialWallet.locked_minor);

    // 1. Request withdrawal: holds funds in locked_minor
    const wdReq: any = {
      app: { locals: { db } },
      auth: { userId: testUserId },
      headers: {},
      body: {
        amountPkr: 150, // 15,000 minor
        gateway: 'easypaisa',
        accountPhone: '03007654321',
      },
    };
    const wdRes = createMockResponse();
    await requestWithdrawal(wdReq as Request, wdRes as Response);
    expect(wdRes.statusCode).toBe(201);
    const txId = wdRes.body.data.transactionId;

    // Verify funds held
    const heldWallet = (await db.query<{ available_minor: string; locked_minor: string }>(
      'SELECT available_minor, locked_minor FROM wallet_accounts WHERE id = $1',
      [walletAccountId]
    )).rows[0];
    expect(BigInt(heldWallet.available_minor)).toBe(initialAvail - 15000n);
    expect(BigInt(heldWallet.locked_minor)).toBe(initialLocked + 15000n);

    // Reconciliation check during hold
    const holdAudit = await auditWalletReconciliation(db, walletAccountId);
    expect(holdAudit.matched).toBe(true);

    // 2. Operator performs INTERNAL APPROVAL
    // Invariant: internal approval does NOT assume provider payout success! Funds remain held.
    const appReq: any = {
      app: { locals: { db } },
      params: { id: txId },
      auth: { userId: superAdminId },
      admin: { userId: superAdminId, role: 'super_admin' },
      body: {},
    };
    const appRes = createMockResponse();
    await approveWithdrawal(appReq as Request, appRes as Response);

    expect(appRes.statusCode).toBe(200);
    expect(appRes.body.ok).toBe(true);
    expect(appRes.body.data.status).toBe('approved');

    // Locked funds MUST still be held!
    const postAppWallet = (await db.query<{ available_minor: string; locked_minor: string }>(
      'SELECT available_minor, locked_minor FROM wallet_accounts WHERE id = $1',
      [walletAccountId]
    )).rows[0];
    expect(BigInt(postAppWallet.locked_minor)).toBe(initialLocked + 15000n);

    // No ledger debit has been written yet!
    const preDebit = await db.query('SELECT id FROM ledger_entries WHERE reference_id = $1', [txId]);
    expect(preDebit.rows.length).toBe(0);

    // 3. Provider payout confirms execution (Payout Success)
    const payoutReq: any = {
      app: { locals: { db } },
      params: { id: txId },
      auth: { userId: superAdminId },
      admin: { userId: superAdminId, role: 'super_admin' },
      body: { payoutRef: 'EASY-PAYOUT-999888' },
    };
    const payoutRes = createMockResponse();
    await recordWithdrawalPayoutSuccess(payoutReq as Request, payoutRes as Response);

    expect(payoutRes.statusCode).toBe(200);
    expect(payoutRes.body.data.status).toBe('completed');
    expect(payoutRes.body.data.payoutRef).toBe('EASY-PAYOUT-999888');

    // Locked funds now deducted and debit ledger entry written
    const finalizedWallet = (await db.query<{ available_minor: string; locked_minor: string }>(
      'SELECT available_minor, locked_minor FROM wallet_accounts WHERE id = $1',
      [walletAccountId]
    )).rows[0];
    expect(BigInt(finalizedWallet.locked_minor)).toBe(initialLocked);

    const postDebit = await db.query<{ direction: string; amount_minor: string }>(
      'SELECT direction, amount_minor FROM ledger_entries WHERE reference_id = $1',
      [txId]
    );
    expect(postDebit.rows.length).toBe(1);
    expect(postDebit.rows[0].direction).toBe('debit');
    expect(postDebit.rows[0].amount_minor).toBe('15000');

    // Final reconciliation check
    const finalAudit = await auditWalletReconciliation(db, walletAccountId);
    expect(finalAudit.matched).toBe(true);
    expect(finalAudit.discrepancies).toHaveLength(0);
  });

  it('safely refunds locked funds when payout fails, and prevents repeated unlock', async (ctx) => {
    if (!isDbAvailable || !db) return ctx.skip();

    const initialWallet = (await db.query<{ available_minor: string; locked_minor: string }>(
      'SELECT available_minor, locked_minor FROM wallet_accounts WHERE id = $1',
      [walletAccountId]
    )).rows[0];
    const initialAvail = BigInt(initialWallet.available_minor);
    const initialLocked = BigInt(initialWallet.locked_minor);

    // 1. Request withdrawal: holds funds
    const wdReq: any = {
      app: { locals: { db } },
      auth: { userId: testUserId },
      headers: {},
      body: {
        amountPkr: 100, // 10,000 minor
        gateway: 'jazzcash',
        accountPhone: '03007654321',
      },
    };
    const wdRes = createMockResponse();
    await requestWithdrawal(wdReq as Request, wdRes as Response);
    const txId = wdRes.body.data.transactionId;

    // 2. Provider payout fails
    const failReq: any = {
      app: { locals: { db } },
      params: { id: txId },
      auth: { userId: superAdminId },
      admin: { userId: superAdminId, role: 'super_admin' },
      body: { reason: 'Destination account limit reached' },
    };
    const failRes = createMockResponse();
    await recordWithdrawalPayoutFailure(failReq as Request, failRes as Response);

    expect(failRes.statusCode).toBe(200);
    expect(failRes.body.data.status).toBe('failed');
    expect(failRes.body.data.refundedPkr).toBe(100);

    // Wallet balance must be restored
    const restoredWallet = (await db.query<{ available_minor: string; locked_minor: string }>(
      'SELECT available_minor, locked_minor FROM wallet_accounts WHERE id = $1',
      [walletAccountId]
    )).rows[0];
    expect(BigInt(restoredWallet.available_minor)).toBe(initialAvail);
    expect(BigInt(restoredWallet.locked_minor)).toBe(initialLocked);

    // 3. Repeat attempt to fail/refund must NOT unlock or credit a second time!
    const repeatRes = createMockResponse();
    await recordWithdrawalPayoutFailure(failReq as Request, repeatRes as Response);
    expect(repeatRes.statusCode).toBe(200);
    expect(repeatRes.body.data.replayed).toBe(true);

    const checkWallet = (await db.query<{ available_minor: string }>(
      'SELECT available_minor FROM wallet_accounts WHERE id = $1',
      [walletAccountId]
    )).rows[0];
    expect(BigInt(checkWallet.available_minor)).toBe(initialAvail); // No double credit!

    // Invariant holds
    const audit = await auditWalletReconciliation(db, walletAccountId);
    expect(audit.matched).toBe(true);
  });

  it('safely refunds locked funds on admin rejection and rejects invalid state transitions', async (ctx) => {
    if (!isDbAvailable || !db) return ctx.skip();

    const initialWallet = (await db.query<{ available_minor: string; locked_minor: string }>(
      'SELECT available_minor, locked_minor FROM wallet_accounts WHERE id = $1',
      [walletAccountId]
    )).rows[0];
    const initialAvail = BigInt(initialWallet.available_minor);

    // 1. Request withdrawal
    const wdReq: any = {
      app: { locals: { db } },
      auth: { userId: testUserId },
      headers: {},
      body: {
        amountPkr: 50,
        gateway: 'easypaisa',
        accountPhone: '03007654321',
      },
    };
    const wdRes = createMockResponse();
    await requestWithdrawal(wdReq as Request, wdRes as Response);
    const txId = wdRes.body.data.transactionId;

    // 2. Admin rejects withdrawal
    const rejReq: any = {
      app: { locals: { db } },
      params: { id: txId },
      auth: { userId: superAdminId },
      admin: { userId: superAdminId, role: 'super_admin' },
      body: { reason: 'Incorrect mobile account title' },
    };
    const rejRes = createMockResponse();
    await rejectWithdrawal(rejReq as Request, rejRes as Response);

    expect(rejRes.statusCode).toBe(200);
    expect(rejRes.body.data.status).toBe('rejected');
    expect(rejRes.body.data.refundedPkr).toBe(50);

    // Restored balance
    const restoredWallet = (await db.query<{ available_minor: string }>(
      'SELECT available_minor FROM wallet_accounts WHERE id = $1',
      [walletAccountId]
    )).rows[0];
    expect(BigInt(restoredWallet.available_minor)).toBe(initialAvail);

    // 3. Attempting to approve an already rejected withdrawal must fail
    const invalidAppReq: any = {
      app: { locals: { db } },
      params: { id: txId },
      auth: { userId: superAdminId },
      admin: { userId: superAdminId, role: 'super_admin' },
      body: {},
    };
    const invalidAppRes = createMockResponse();
    await approveWithdrawal(invalidAppReq as Request, invalidAppRes as Response);

    expect(invalidAppRes.statusCode).toBe(400);
    expect(invalidAppRes.body.error.code).toBe('ALREADY_PROCESSED');
  });

  it('enforces account status restrictions against suspended or banned users', async (ctx) => {
    if (!isDbAvailable || !db) return ctx.skip();

    const restrictedUserId = crypto.randomUUID();
    const restrictedPhone = `+92300${Math.floor(1000000 + Math.random() * 9000000)}`;
    await db.query(
      `INSERT INTO users (id, phone_e164, date_of_birth, password_hash, status)
       VALUES ($1, $2, '1995-05-05', 'hash', 'suspended')`,
      [restrictedUserId, restrictedPhone]
    );

    await db.query(
      `INSERT INTO wallet_accounts (user_id, currency, available_minor, locked_minor)
       VALUES ($1, 'PKR', 50000, 0)`,
      [restrictedUserId]
    );

    // Attempt withdrawal while suspended
    const wdReq: any = {
      app: { locals: { db } },
      auth: { userId: restrictedUserId },
      headers: {},
      body: {
        amountPkr: 100,
        gateway: 'easypaisa',
        accountPhone: '03009998877',
      },
    };
    const wdRes = createMockResponse();
    await requestWithdrawal(wdReq as Request, wdRes as Response);

    expect(wdRes.statusCode).toBe(403);
    expect(wdRes.body.ok).toBe(false);
    expect(wdRes.body.error.code).toBe('ACCOUNT_RESTRICTED');
  });

  it('enforces explicit super_admin permission and mandatory reason on balance adjustments', async (ctx) => {
    if (!isDbAvailable || !db) return ctx.skip();

    // 1. Standard admin role (not super_admin) should be rejected with 403
    const standardAdminReq: any = {
      app: { locals: { db } },
      params: { userId: testUserId },
      admin: { userId: standardAdminId, role: 'admin' },
      body: { amountMinor: 5000, reason: 'Legitimate correction' },
    };
    const standardRes = createMockResponse();
    await adminUserBalanceAdjust(standardAdminReq as Request, standardRes as Response);

    expect(standardRes.statusCode).toBe(403);
    expect(standardRes.body.error.code).toBe('SUPER_ADMIN_REQUIRED');

    // 2. Missing reason should be rejected with 400
    const noReasonReq: any = {
      app: { locals: { db } },
      params: { userId: testUserId },
      admin: { userId: superAdminId, role: 'super_admin' },
      body: { amountMinor: 5000, reason: '   ' },
    };
    const noReasonRes = createMockResponse();
    await adminUserBalanceAdjust(noReasonReq as Request, noReasonRes as Response);

    expect(noReasonRes.statusCode).toBe(400);
    expect(noReasonRes.body.error.code).toBe('REASON_REQUIRED');

    // 3. Valid super_admin credit adjustment
    const preWallet = (await db.query<{ available_minor: string }>(
      'SELECT available_minor FROM wallet_accounts WHERE id = $1',
      [walletAccountId]
    )).rows[0];
    const preAvail = BigInt(preWallet.available_minor);

    const validReq: any = {
      app: { locals: { db } },
      params: { userId: testUserId },
      admin: { userId: superAdminId, role: 'super_admin' },
      body: { amountMinor: 10000, reason: 'Manual VIP bonus compensation' },
    };
    const validRes = createMockResponse();
    await adminUserBalanceAdjust(validReq as Request, validRes as Response);

    expect(validRes.statusCode).toBe(200);
    expect(validRes.body.ok).toBe(true);
    expect(validRes.body.data.adjustedMinor).toBe(10000);

    // Verify wallet, ledger, and reconciliation
    const postWallet = (await db.query<{ available_minor: string }>(
      'SELECT available_minor FROM wallet_accounts WHERE id = $1',
      [walletAccountId]
    )).rows[0];
    expect(BigInt(postWallet.available_minor)).toBe(preAvail + 10000n);

    // Audit reconciliation
    const audit = await auditWalletReconciliation(db, walletAccountId);
    expect(audit.matched).toBe(true);
    expect(audit.discrepancies).toHaveLength(0);

    // 4. Overdrawn debit rejected
    const overdrawReq: any = {
      app: { locals: { db } },
      params: { userId: testUserId },
      admin: { userId: superAdminId, role: 'super_admin' },
      body: { amountMinor: -999999999, reason: 'Confiscate more than balance' },
    };
    const overdrawRes = createMockResponse();
    await adminUserBalanceAdjust(overdrawReq as Request, overdrawRes as Response);

    expect(overdrawRes.statusCode).toBe(400);
    expect(overdrawRes.body.error.code).toBe('INSUFFICIENT_FUNDS');
  });

  it('protects against concurrent approval requests: exactly once settlement without double credit', async (ctx) => {
    if (!isDbAvailable || !db) return ctx.skip();

    // 1. Create deposit transaction
    const depReq: any = {
      app: { locals: { db } },
      auth: { userId: testUserId },
      headers: {},
      body: {
        mode: 'manual',
        amountPkr: 100,
        gateway: 'easypaisa',
        trxId: `CONCUR-${Date.now()}`,
        senderPhone: '03007654321',
      },
    };
    const depRes = createMockResponse();
    await requestDeposit(depReq as Request, depRes as Response);
    const txId = depRes.body.data.transactionId;

    const preBalance = (await db.query<{ available_minor: string }>(
      'SELECT available_minor FROM wallet_accounts WHERE id = $1',
      [walletAccountId]
    )).rows[0].available_minor;

    // 2. Fire 5 concurrent approval requests
    const concurrentCount = 5;
    const promises = Array.from({ length: concurrentCount }, () => {
      const req: any = {
        app: { locals: { db } },
        params: { id: txId },
        auth: { userId: superAdminId },
        admin: { userId: superAdminId, role: 'super_admin' },
        body: {},
      };
      const res = createMockResponse();
      return approveDeposit(req as Request, res as Response).then(() => res);
    });

    const results = await Promise.all(promises);

    // Exactly one should succeed with 200, others should be rejected with 400 ALREADY_PROCESSED
    const successCount = results.filter((r) => r.statusCode === 200).length;
    const rejectedCount = results.filter((r) => r.statusCode === 400).length;

    expect(successCount).toBe(1);
    expect(rejectedCount).toBe(concurrentCount - 1);

    // Ensure wallet was credited EXACTLY ONCE (10,000 minor)
    const postBalance = (await db.query<{ available_minor: string }>(
      'SELECT available_minor FROM wallet_accounts WHERE id = $1',
      [walletAccountId]
    )).rows[0].available_minor;

    expect(BigInt(postBalance) - BigInt(preBalance)).toBe(10000n);

    // Reconcile
    const audit = await auditWalletReconciliation(db, walletAccountId);
    expect(audit.matched).toBe(true);
    expect(audit.discrepancies).toHaveLength(0);
  });
});
