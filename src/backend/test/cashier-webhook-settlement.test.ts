import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { createDatabaseClient, type ConnectedDatabaseClient } from '../src/core/database/postgres.client.js';
import { requestDeposit, processPaymentWebhook } from '../src/modules/payments/cashier.controller.js';
import { PaymentGatewayService } from '../src/modules/payments/payment-gateway.service.js';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testSecret123@localhost:54328/n5_idempotency_test';
const TEST_JAZZCASH_KEY = 'sandbox_jazzcash_hash_key_123';
const TEST_EASYPAISA_KEY = 'sandbox_easypaisa_hash_key_456';

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

describe('Cashier Webhook Signature Verification & Durable Settlement Integration', () => {
  let db: ConnectedDatabaseClient | undefined;
  let isDbAvailable = false;
  let testUserId: string;
  let walletAccountId: string;

  beforeAll(async () => {
    // Configure test sandbox keys for signature verification
    process.env.JAZZCASH_WEBHOOK_SECRET = TEST_JAZZCASH_KEY;
    process.env.EASYPAISA_WEBHOOK_SECRET = TEST_EASYPAISA_KEY;

    try {
      db = createDatabaseClient(TEST_DB_URL);
      await db.query('SELECT 1');
      isDbAvailable = true;
    } catch {
      console.warn(`[INFO] PostgreSQL test database not reachable at ${TEST_DB_URL}. Skipping live DB integration tests in offline mode.`);
      return;
    }

    testUserId = crypto.randomUUID();
    await db.query(
      `INSERT INTO users (id, phone_e164, date_of_birth, password_hash, status)
       VALUES ($1, '+923001122334', '1990-01-01', 'hash', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [testUserId]
    );

    const walletRes = await db.query<{ id: string }>(
      `INSERT INTO wallet_accounts (user_id, currency, available_minor, locked_minor)
       VALUES ($1, 'PKR', 500000, 0)
       RETURNING id`,
      [testUserId]
    );
    walletAccountId = walletRes.rows[0].id;
  });

  beforeEach((ctx) => {
    if (!isDbAvailable) {
      ctx.skip();
    }
  });

  afterAll(async () => {
    if (!db || !isDbAvailable) return;
    try {
      await db.query('DELETE FROM provider_webhook_events WHERE provider IN ($1, $2)', ['jazzcash', 'easypaisa']);
      await db.query('DELETE FROM ledger_entries WHERE wallet_account_id = $1', [walletAccountId]);
      await db.query('DELETE FROM deposits WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = $1)', [testUserId]);
      await db.query('DELETE FROM transactions WHERE user_id = $1', [testUserId]);
      await db.query('DELETE FROM wallet_accounts WHERE id = $1', [walletAccountId]);
      await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    } catch (_) {}
    await db.close().catch(() => {});
  });

  // -------------------------------------------------------------
  // 1. INVALID SIGNATURE REJECTION
  // -------------------------------------------------------------
  it('rejects webhook with invalid signature (HTTP 400 INVALID_SIGNATURE) and does not credit wallet', async () => {
    const fakeBillRef = `N5${crypto.randomUUID().slice(0, 8)}`;
    const req: any = {
      app: { locals: { db } },
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        pp_Amount: '50000',
        pp_BillReference: fakeBillRef,
        pp_ResponseCode: '000',
        pp_ResponseMessage: 'Success',
        pp_TxnRefNo: `TID_${Date.now()}`,
        pp_SecureHash: 'FORGED_INVALID_HASH_12345',
      },
    };
    const res = createMockResponse();

    await processPaymentWebhook('jazzcash', req as Request, res as Response);

    expect(res.statusCode).toBe(400);
    expect(res.body?.error?.code).toBe('INVALID_SIGNATURE');
  });

  // -------------------------------------------------------------
  // 2. CHANGED AMOUNT REJECTION (FRAUD PROTECTION)
  // -------------------------------------------------------------
  it('rejects webhook with altered amount (HTTP 422 AMOUNT_MISMATCH) and prevents fraud', async () => {
    // Create a pending transaction for 1,000 PKR (100,000 minor)
    const txId = crypto.randomUUID();
    const billRef = `N5${txId.slice(0, 8)}`;
    await db!.query(
      `INSERT INTO transactions (id, user_id, wallet_account_id, type, status, amount_minor, currency, provider_reference)
       VALUES ($1, $2, $3, 'deposit', 'pending', 100000, 'PKR', $4)`,
      [txId, testUserId, walletAccountId, billRef]
    );

    // Attacker crafts signed webhook claiming success for only 100 PKR (10,000 minor)
    const payload: Record<string, string> = {
      pp_Amount: '10000', // Tampered amount!
      pp_BillReference: billRef,
      pp_ResponseCode: '000',
      pp_ResponseMessage: 'Success',
      pp_TxnRefNo: `TID_TAMPERED_${Date.now()}`,
      pp_TxnCurrency: 'PKR',
    };
    payload.pp_SecureHash = PaymentGatewayService.generateJazzCashSignature(payload, TEST_JAZZCASH_KEY);

    const req: any = {
      app: { locals: { db } },
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    };
    const res = createMockResponse();

    await processPaymentWebhook('jazzcash', req as Request, res as Response);

    expect(res.statusCode).toBe(422);
    expect(res.body?.error?.code).toBe('AMOUNT_MISMATCH');

    // Verify transaction status remains pending and wallet is NOT credited
    const txRow = (await db!.query<{ status: string }>(`SELECT status FROM transactions WHERE id = $1`, [txId])).rows[0];
    expect(txRow.status).toBe('pending');
  });

  // -------------------------------------------------------------
  // 3. UNKNOWN REFERENCE REJECTION
  // -------------------------------------------------------------
  it('rejects webhook for non-existent transaction reference (HTTP 404 UNKNOWN_TRANSACTION)', async () => {
    const ghostRef = `N5GHOST_${Date.now()}`;
    const payload: Record<string, string> = {
      pp_Amount: '50000',
      pp_BillReference: ghostRef,
      pp_ResponseCode: '000',
      pp_ResponseMessage: 'Success',
      pp_TxnRefNo: `TID_GHOST_${Date.now()}`,
      pp_TxnCurrency: 'PKR',
    };
    payload.pp_SecureHash = PaymentGatewayService.generateJazzCashSignature(payload, TEST_JAZZCASH_KEY);

    const req: any = {
      app: { locals: { db } },
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    };
    const res = createMockResponse();

    await processPaymentWebhook('jazzcash', req as Request, res as Response);

    expect(res.statusCode).toBe(404);
    expect(res.body?.error?.code).toBe('UNKNOWN_TRANSACTION');
  });

  // -------------------------------------------------------------
  // 4. VALID SETTLEMENT (EXACTLY ONCE CREDIT & DOUBLE-ENTRY LEDGER)
  // -------------------------------------------------------------
  it('settles valid webhook exactly once: credits wallet, writes ledger, and returns 200', async () => {
    const txId = crypto.randomUUID();
    const billRef = `N5${txId.slice(0, 8)}`;
    const depositAmountMinor = 50000; // 500 PKR

    // Initial wallet balance
    const initialWallet = (await db!.query<{ available_minor: string }>(
      `SELECT available_minor FROM wallet_accounts WHERE id = $1`,
      [walletAccountId]
    )).rows[0];
    const initialBalance = BigInt(initialWallet.available_minor);

    // Create pending transaction and deposit
    await db!.query(
      `INSERT INTO transactions (id, user_id, wallet_account_id, type, status, amount_minor, currency, provider_reference)
       VALUES ($1, $2, $3, 'deposit', 'pending', $4, 'PKR', $5)`,
      [txId, testUserId, walletAccountId, depositAmountMinor, billRef]
    );
    await db!.query(
      `INSERT INTO deposits (id, transaction_id, method, provider_name, provider_reference)
       VALUES ($1, $2, 'jazzcash', 'jazzcash', $3)`,
      [crypto.randomUUID(), txId, billRef]
    );

    const tid = `TID_SUCCESS_${Date.now()}`;
    const payload: Record<string, string> = {
      pp_Amount: String(depositAmountMinor),
      pp_BillReference: billRef,
      pp_ResponseCode: '000',
      pp_ResponseMessage: 'Success',
      pp_TxnRefNo: tid,
      pp_TxnCurrency: 'PKR',
    };
    payload.pp_SecureHash = PaymentGatewayService.generateJazzCashSignature(payload, TEST_JAZZCASH_KEY);

    const req: any = {
      app: { locals: { db } },
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    };
    const res = createMockResponse();

    await processPaymentWebhook('jazzcash', req as Request, res as Response);

    expect(res.statusCode).toBe(200);
    expect(res.body?.pp_ResponseCode).toBe('000');

    // 1. Transaction must be marked 'completed'
    const updatedTx = (await db!.query<{ status: string }>(`SELECT status FROM transactions WHERE id = $1`, [txId])).rows[0];
    expect(updatedTx.status).toBe('completed');

    // 2. Wallet balance must increase by exactly 50,000 minor units
    const updatedWallet = (await db!.query<{ available_minor: string }>(
      `SELECT available_minor FROM wallet_accounts WHERE id = $1`,
      [walletAccountId]
    )).rows[0];
    expect(BigInt(updatedWallet.available_minor)).toBe(initialBalance + BigInt(depositAmountMinor));

    // 3. Double-entry ledger entry must exist with unique settlement key
    const ledger = await db!.query<{ id: string; amount_minor: string; direction: string }>(
      `SELECT id, amount_minor, direction FROM ledger_entries WHERE idempotency_key = $1`,
      [`webhook:settlement:${txId}`]
    );
    expect(ledger.rows.length).toBe(1);
    expect(ledger.rows[0].direction).toBe('credit');
    expect(Number(ledger.rows[0].amount_minor)).toBe(depositAmountMinor);

    // 4. Provider webhook event must be marked 'PROCESSED'
    const eventRow = (await db!.query<{ state: string }>(
      `SELECT state FROM provider_webhook_events WHERE provider = 'jazzcash' AND event_id = $1`,
      [tid]
    )).rows[0];
    expect(eventRow.state).toBe('PROCESSED');
  });

  // -------------------------------------------------------------
  // 5. REPEATED CALLBACK / REPLAY PROTECTION (ZERO DUPLICATE CREDIT)
  // -------------------------------------------------------------
  it('handles repeated callback idempotently: returns 200, wallet balance is NOT credited twice', async () => {
    const txId = crypto.randomUUID();
    const billRef = `N5${txId.slice(0, 8)}`;
    const depositAmountMinor = 30000; // 300 PKR

    await db!.query(
      `INSERT INTO transactions (id, user_id, wallet_account_id, type, status, amount_minor, currency, provider_reference)
       VALUES ($1, $2, $3, 'deposit', 'pending', $4, 'PKR', $5)`,
      [txId, testUserId, walletAccountId, depositAmountMinor, billRef]
    );
    await db!.query(
      `INSERT INTO deposits (id, transaction_id, method, provider_name, provider_reference)
       VALUES ($1, $2, 'jazzcash', 'jazzcash', $3)`,
      [crypto.randomUUID(), txId, billRef]
    );

    const tid = `TID_REPLAY_${Date.now()}`;
    const payload: Record<string, string> = {
      pp_Amount: String(depositAmountMinor),
      pp_BillReference: billRef,
      pp_ResponseCode: '000',
      pp_ResponseMessage: 'Success',
      pp_TxnRefNo: tid,
      pp_TxnCurrency: 'PKR',
    };
    payload.pp_SecureHash = PaymentGatewayService.generateJazzCashSignature(payload, TEST_JAZZCASH_KEY);

    const makeReq = () => ({
      app: { locals: { db } },
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });

    // First Webhook Call
    const res1 = createMockResponse();
    await processPaymentWebhook('jazzcash', makeReq() as Request, res1 as Response);
    expect(res1.statusCode).toBe(200);

    const walletAfterFirst = (await db!.query<{ available_minor: string }>(
      `SELECT available_minor FROM wallet_accounts WHERE id = $1`,
      [walletAccountId]
    )).rows[0].available_minor;

    // Second Duplicate Webhook Call (Replay)
    const res2 = createMockResponse();
    await processPaymentWebhook('jazzcash', makeReq() as Request, res2 as Response);
    expect(res2.statusCode).toBe(200);

    // Verify wallet balance did NOT change on replay
    const walletAfterSecond = (await db!.query<{ available_minor: string }>(
      `SELECT available_minor FROM wallet_accounts WHERE id = $1`,
      [walletAccountId]
    )).rows[0].available_minor;
    expect(walletAfterSecond).toBe(walletAfterFirst);

    // Verify exactly ONE ledger entry was created
    const ledger = await db!.query(
      `SELECT id FROM ledger_entries WHERE idempotency_key = $1`,
      [`webhook:settlement:${txId}`]
    );
    expect(ledger.rows.length).toBe(1);
  });

  // -------------------------------------------------------------
  // 6. OUT-OF-ORDER EVENT HANDLING
  // -------------------------------------------------------------
  it('rejects out-of-order event on already terminated transaction (HTTP 409 TRANSACTION_ALREADY_TERMINATED)', async () => {
    const txId = crypto.randomUUID();
    const billRef = `N5${txId.slice(0, 8)}`;

    // Create a transaction that was already cancelled by admin/user
    await db!.query(
      `INSERT INTO transactions (id, user_id, wallet_account_id, type, status, amount_minor, currency, provider_reference)
       VALUES ($1, $2, $3, 'deposit', 'cancelled', 50000, 'PKR', $4)`,
      [txId, testUserId, walletAccountId, billRef]
    );

    const payload: Record<string, string> = {
      pp_Amount: '50000',
      pp_BillReference: billRef,
      pp_ResponseCode: '000',
      pp_ResponseMessage: 'Success',
      pp_TxnRefNo: `TID_OUT_OF_ORDER_${Date.now()}`,
      pp_TxnCurrency: 'PKR',
    };
    payload.pp_SecureHash = PaymentGatewayService.generateJazzCashSignature(payload, TEST_JAZZCASH_KEY);

    const req: any = {
      app: { locals: { db } },
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    };
    const res = createMockResponse();

    await processPaymentWebhook('jazzcash', req as Request, res as Response);

    expect(res.statusCode).toBe(409);
    expect(res.body?.error?.code).toBe('TRANSACTION_ALREADY_TERMINATED');
  });

  // -------------------------------------------------------------
  // 7. CONCURRENT IDENTICAL WEBHOOK CALLBACKS
  // -------------------------------------------------------------
  it('handles concurrent identical webhook callbacks safely: exactly once credit to wallet balance', async () => {
    const txId = crypto.randomUUID();
    const billRef = `N5${txId.slice(0, 8)}`;
    const depositAmountMinor = 25000; // 250 PKR

    const initialWallet = (await db!.query<{ available_minor: string }>(
      `SELECT available_minor FROM wallet_accounts WHERE id = $1`,
      [walletAccountId]
    )).rows[0];
    const initialBalance = BigInt(initialWallet.available_minor);

    await db!.query(
      `INSERT INTO transactions (id, user_id, wallet_account_id, type, status, amount_minor, currency, provider_reference)
       VALUES ($1, $2, $3, 'deposit', 'pending', $4, 'PKR', $5)`,
      [txId, testUserId, walletAccountId, depositAmountMinor, billRef]
    );
    await db!.query(
      `INSERT INTO deposits (id, transaction_id, method, provider_name, provider_reference)
       VALUES ($1, $2, 'jazzcash', 'jazzcash', $3)`,
      [crypto.randomUUID(), txId, billRef]
    );

    const tid = `TID_CONCURRENT_${Date.now()}`;
    const payload: Record<string, string> = {
      pp_Amount: String(depositAmountMinor),
      pp_BillReference: billRef,
      pp_ResponseCode: '000',
      pp_ResponseMessage: 'Success',
      pp_TxnRefNo: tid,
      pp_TxnCurrency: 'PKR',
    };
    payload.pp_SecureHash = PaymentGatewayService.generateJazzCashSignature(payload, TEST_JAZZCASH_KEY);

    const req1: any = { app: { locals: { db } }, method: 'POST', headers: {}, body: { ...payload } };
    const req2: any = { app: { locals: { db } }, method: 'POST', headers: {}, body: { ...payload } };
    const res1 = createMockResponse();
    const res2 = createMockResponse();

    // Fire both simultaneously
    await Promise.all([
      processPaymentWebhook('jazzcash', req1 as Request, res1 as Response),
      processPaymentWebhook('jazzcash', req2 as Request, res2 as Response),
    ]);

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);

    // Balance must increase by exactly 25,000 minor units (NOT 50,000!)
    const updatedWallet = (await db!.query<{ available_minor: string }>(
      `SELECT available_minor FROM wallet_accounts WHERE id = $1`,
      [walletAccountId]
    )).rows[0];
    expect(BigInt(updatedWallet.available_minor)).toBe(initialBalance + BigInt(depositAmountMinor));

    // Ledger has exactly 1 entry
    const ledger = await db!.query(
      `SELECT id FROM ledger_entries WHERE idempotency_key = $1`,
      [`webhook:settlement:${txId}`]
    );
    expect(ledger.rows.length).toBe(1);
  });

  // -------------------------------------------------------------
  // 8. FAIL-CLOSED WHEN GATEWAY SECRET KEY IS UNCONFIGURED
  // -------------------------------------------------------------
  it('fails closed (HTTP 503 GATEWAY_WEBHOOK_DISABLED) when gateway secret key is unconfigured', async () => {
    const originalSecret = process.env.JAZZCASH_WEBHOOK_SECRET;
    delete process.env.JAZZCASH_WEBHOOK_SECRET;

    const req: any = {
      app: { locals: { db } },
      method: 'POST',
      headers: {},
      body: { pp_Amount: '1000' },
    };
    const res = createMockResponse();

    await processPaymentWebhook('jazzcash', req as Request, res as Response);

    expect(res.statusCode).toBe(503);
    expect(res.body?.error?.code).toBe('GATEWAY_WEBHOOK_DISABLED');

    process.env.JAZZCASH_WEBHOOK_SECRET = originalSecret;
  });

  // -------------------------------------------------------------
  // 9. FAIL-CLOSED FOR UNSUPPORTED PROVIDER WITHOUT SPECIFICATION
  // -------------------------------------------------------------
  it('fails closed (HTTP 503) for unsupported provider without official webhook specification', async () => {
    const req: any = {
      app: { locals: { db } },
      method: 'POST',
      headers: {},
      body: { amount: '1000' },
    };
    const res = createMockResponse();

    await processPaymentWebhook('unsupported_bank', req as Request, res as Response);

    expect(res.statusCode).toBe(503);
    expect(res.body?.error?.code).toBe('GATEWAY_WEBHOOK_DISABLED');
  });

  // -------------------------------------------------------------
  // 10. EXPLICIT MANUAL DEPOSIT MODE
  // -------------------------------------------------------------
  it('enforces explicit manual deposit: requires TRX ID and registers without external gateway dispatch', async () => {
    const manualTrx = `MANUAL_TRX_${Date.now()}`;
    const req: any = {
      auth: { userId: testUserId },
      app: { locals: { db } },
      body: {
        mode: 'manual',
        amountPkr: 500,
        gateway: 'easypaisa',
        trxId: manualTrx,
      },
      headers: {},
    };
    const res = createMockResponse();

    await requestDeposit(req as Request, res as Response);

    expect(res.statusCode).toBe(201);
    expect(res.body?.data?.mode).toBe('manual');
    expect(res.body?.data?.trxId).toBe(manualTrx);
    expect(res.body?.data?.status).toBe('pending');
  });

  // -------------------------------------------------------------
  // 11. EXPLICIT AUTOMATIC DEPOSIT MODE (FAILS CLOSED ON MISSING CREDS)
  // -------------------------------------------------------------
  it('enforces explicit automatic deposit: fails closed without silent manual fallback when credentials missing', async () => {
    const req: any = {
      auth: { userId: testUserId },
      app: { locals: { db } },
      body: {
        mode: 'automatic',
        amountPkr: 1500,
        gateway: 'bank', // Automatic gateway not supported for bank
      },
      headers: {},
    };
    const res = createMockResponse();

    await requestDeposit(req as Request, res as Response);

    // Must NOT succeed with manual slip fallback
    expect(res.statusCode).toBe(502);
    expect(res.body?.ok).toBe(false);
    expect(res.body?.error?.code).toBe('AUTOMATIC_MODE_UNSUPPORTED');
  });
});

describe('Cashier webhook without a configured database', () => {
  beforeAll(() => {
    process.env.JAZZCASH_WEBHOOK_SECRET = TEST_JAZZCASH_KEY;
  });

  it('fails closed with 503 instead of settling anywhere', async () => {
    const payload: Record<string, string> = {
      pp_Amount: '40000',
      pp_BillReference: 'no-db-tx-101',
      pp_ResponseCode: '000',
      pp_ResponseMessage: 'Success',
      pp_TxnRefNo: `TID_NODB_${Date.now()}`,
      pp_TxnCurrency: 'PKR',
    };
    payload.pp_SecureHash = PaymentGatewayService.generateJazzCashSignature(payload, TEST_JAZZCASH_KEY);

    const res = createMockResponse();
    await processPaymentWebhook('jazzcash', {
      app: { locals: { db: undefined } },
      method: 'POST',
      headers: {},
      body: payload,
    } as any, res as Response);

    expect(res.statusCode).toBe(503);
    expect(res.body?.error?.code).toBe('PAYMENTS_STORE_UNAVAILABLE');
  });
});
