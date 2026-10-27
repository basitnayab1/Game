import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';

function financialStoreUnavailable(res: Response) {
  return res.status(503).json({ ok: false, error: { code: 'FINANCIAL_STORE_UNAVAILABLE', message: 'Admin financial operations require the PostgreSQL database to be configured.' } });
}

const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

export async function listAdminDeposits(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) return financialStoreUnavailable(res);

  try {
    const result = await db.query<{
      transactionId: string;
      depositId: string;
      userId: string;
      userPhone: string;
      amountMinor: string;
      currency: string;
      status: string;
      method: string;
      trxId: string;
      verifiedAt: string | null;
      createdAt: string;
      metadata: any;
    }>(
      `SELECT t.id AS "transactionId", d.id AS "depositId", t.user_id AS "userId",
              u.phone_e164 AS "userPhone", t.amount_minor AS "amountMinor", t.currency,
              t.status, d.method, d.provider_reference AS "trxId",
              d.verified_at AS "verifiedAt", t.created_at AS "createdAt", t.metadata
         FROM transactions t
         JOIN deposits d ON d.transaction_id = t.id
         JOIN users u ON u.id = t.user_id
        ORDER BY t.created_at DESC
        LIMIT 100`
    );

    const formatted = result.rows.map((r) => ({
      ...r,
      amountPkr: Number(r.amountMinor) / 100,
    }));

    return res.json({ ok: true, data: formatted });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'FETCH_DEPOSITS_FAILED', message: error?.message } });
  }
}

export async function approveDeposit(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const transactionId = String(req.params.id || '').trim();
  const adminId = String((req as any).auth?.userId || (req as any).admin?.userId || (req as any).user?.id || 'admin').trim();

  if (!db) return financialStoreUnavailable(res);

  try {
    const output = await db.transaction(async (tx) => {
      // 1. Lock transaction row (matching either transactions.id or deposits.id)
      const txRows = (await tx.query<{
        id: string;
        user_id: string;
        wallet_account_id: string;
        type: string;
        amount_minor: string;
        status: string;
        provider_reference: string;
        metadata: any;
      }>(
        `SELECT t.id, t.user_id, t.wallet_account_id, t.type, t.amount_minor, t.status, t.provider_reference, t.metadata
           FROM transactions t
           LEFT JOIN deposits d ON d.transaction_id = t.id
          WHERE (t.id = $1 OR d.id = $1)
          FOR UPDATE OF t`,
        [transactionId]
      )).rows;

      if (txRows.length === 0) {
        throw { statusCode: 404, code: 'NOT_FOUND', message: 'Deposit transaction not found.' };
      }

      const txRow = txRows[0];

      // Validate transaction type
      if (txRow.type !== 'deposit') {
        throw { statusCode: 400, code: 'INVALID_TRANSACTION_TYPE', message: `Cannot approve deposit: transaction type is ${txRow.type}.` };
      }

      // Validate state transition
      if (txRow.status !== 'pending') {
        throw { statusCode: 400, code: 'ALREADY_PROCESSED', message: `Transaction is already ${txRow.status}.` };
      }

      const amountMinor = BigInt(txRow.amount_minor);

      // 2. Lock wallet account
      const wallet = (await tx.query<{ id: string; available_minor: string }>(
        `SELECT id, available_minor FROM wallet_accounts
          WHERE id = $1 FOR UPDATE`,
        [txRow.wallet_account_id]
      )).rows[0];

      if (!wallet) throw { statusCode: 404, code: 'WALLET_NOT_FOUND', message: 'Wallet account not found.' };

      // 3. Update wallet balance
      await tx.query(
        `UPDATE wallet_accounts
            SET available_minor = available_minor + $1,
                version = version + 1,
                updated_at = now()
          WHERE id = $2`,
        [amountMinor.toString(), wallet.id]
      );

      // 4. Update transaction & deposit status
      await tx.query(
        `UPDATE transactions SET status = 'completed', updated_at = now() WHERE id = $1`,
        [txRow.id]
      );
      await tx.query(
        `UPDATE deposits SET verified_at = now() WHERE transaction_id = $1`,
        [txRow.id]
      );

      // 5. Create immutable audit entry in ledger with idempotency protection
      const ledgerIdempKey = `admin_dep_approve:${txRow.id}`;
      await tx.query(
        `INSERT INTO ledger_entries (
           wallet_account_id, entry_type, direction, amount_minor, currency, reference_type, reference_id, idempotency_key, metadata
         ) VALUES ($1, 'deposit', 'credit', $2, 'PKR', 'deposit', $3, $4, $5)
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
        [
          wallet.id,
          amountMinor.toString(),
          txRow.id,
          ledgerIdempKey,
          JSON.stringify({
            approvedBy: adminId,
            trxId: txRow.provider_reference,
            gateway: txRow.metadata?.gateway,
          }),
        ]
      );

      // 6. Record audit event
      await tx.query(
        `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, 'admin.deposit.approve', 'transaction', $2, $3, now())`,
        [
          isUuid(adminId) ? adminId : null,
          isUuid(txRow.id) ? txRow.id : null,
          JSON.stringify({ adminId, amountMinor: amountMinor.toString(), transactionId: txRow.id }),
        ]
      );

      return {
        transactionId: txRow.id,
        amountPkr: Number(amountMinor) / 100,
        status: 'completed',
        newBalancePkr: Number(BigInt(wallet.available_minor) + amountMinor) / 100,
      };
    });

    return res.json({ ok: true, data: output });
  } catch (error: any) {
    const status = error.statusCode || 400;
    return res.status(status).json({
      ok: false,
      error: { code: error.code || 'APPROVE_FAILED', message: error.message || 'Deposit approval failed.' },
    });
  }
}

export async function rejectDeposit(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const transactionId = String(req.params.id || '').trim();
  const adminId = String((req as any).auth?.userId || (req as any).admin?.userId || (req as any).user?.id || 'admin').trim();
  const reason = String(req.body?.reason || 'Rejected by operator').trim();

  if (!db) return financialStoreUnavailable(res);

  try {
    const output = await db.transaction(async (tx) => {
      const txRows = (await tx.query<{
        id: string;
        type: string;
        status: string;
      }>(
        `SELECT t.id, t.type, t.status
           FROM transactions t
           LEFT JOIN deposits d ON d.transaction_id = t.id
          WHERE (t.id = $1 OR d.id = $1)
          FOR UPDATE OF t`,
        [transactionId]
      )).rows;

      if (txRows.length === 0) {
        throw { statusCode: 404, code: 'NOT_FOUND', message: 'Deposit transaction not found.' };
      }

      const txRow = txRows[0];
      if (txRow.type !== 'deposit') {
        throw { statusCode: 400, code: 'INVALID_TRANSACTION_TYPE', message: `Cannot reject deposit: transaction type is ${txRow.type}.` };
      }
      if (txRow.status !== 'pending') {
        throw { statusCode: 400, code: 'ALREADY_PROCESSED', message: `Transaction is already ${txRow.status}.` };
      }

      await tx.query(
        `UPDATE transactions
            SET status = 'rejected',
                metadata = metadata || jsonb_build_object('rejectReason', $2::text, 'rejectedBy', $3::text),
                updated_at = now()
          WHERE id = $1`,
        [txRow.id, reason, adminId]
      );

      await tx.query(
        `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, 'admin.deposit.reject', 'transaction', $2, $3, now())`,
        [
          isUuid(adminId) ? adminId : null,
          isUuid(txRow.id) ? txRow.id : null,
          JSON.stringify({ adminId, reason, transactionId: txRow.id }),
        ]
      );

      return { transactionId: txRow.id, status: 'rejected', reason };
    });

    return res.json({ ok: true, data: output });
  } catch (error: any) {
    const status = error.statusCode || 400;
    return res.status(status).json({
      ok: false,
      error: { code: error.code || 'REJECT_FAILED', message: error.message || 'Deposit rejection failed.' },
    });
  }
}

export async function listAdminWithdrawals(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) return financialStoreUnavailable(res);

  try {
    const result = await db.query<{
      transactionId: string;
      withdrawalId: string;
      userId: string;
      userPhone: string;
      amountMinor: string;
      status: string;
      createdAt: string;
      metadata: any;
    }>(
      `SELECT t.id AS "transactionId", w.id AS "withdrawalId", t.user_id AS "userId",
              u.phone_e164 AS "userPhone", t.amount_minor AS "amountMinor",
              t.status, t.created_at AS "createdAt", t.metadata
         FROM transactions t
         JOIN withdrawals w ON w.transaction_id = t.id
         JOIN users u ON u.id = t.user_id
        ORDER BY t.created_at DESC
        LIMIT 100`
    );

    const formatted = result.rows.map((r) => ({
      ...r,
      amountPkr: Number(r.amountMinor) / 100,
      gateway: r.metadata?.gateway || 'easypaisa',
      accountPhone: r.metadata?.accountPhone || '',
      accountTitle: r.metadata?.accountTitle || '',
    }));

    return res.json({ ok: true, data: formatted });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'FETCH_WITHDRAWALS_FAILED', message: error?.message } });
  }
}

export async function approveWithdrawal(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const transactionId = String(req.params.id || '').trim();
  const adminId = String((req as any).auth?.userId || (req as any).admin?.userId || (req as any).user?.id || 'admin').trim();
  const executePayout = Boolean(req.body?.executePayout || req.body?.finalize);
  const payoutRef = String(req.body?.payoutRef || '').trim();

  if (!db) return financialStoreUnavailable(res);

  try {
    const output = await db.transaction(async (tx) => {
      // 1. Lock transaction row (matching either transactions.id or withdrawals.id)
      const txRows = (await tx.query<{
        id: string;
        user_id: string;
        wallet_account_id: string;
        type: string;
        amount_minor: string;
        status: string;
        metadata: any;
      }>(
        `SELECT t.id, t.user_id, t.wallet_account_id, t.type, t.amount_minor, t.status, t.metadata
           FROM transactions t
           LEFT JOIN withdrawals w ON w.transaction_id = t.id
          WHERE (t.id = $1 OR w.id = $1)
          FOR UPDATE OF t`,
        [transactionId]
      )).rows;

      if (txRows.length === 0) {
        throw { statusCode: 404, code: 'NOT_FOUND', message: 'Withdrawal transaction not found.' };
      }

      const txRow = txRows[0];
      if (txRow.type !== 'withdrawal') {
        throw { statusCode: 400, code: 'INVALID_TRANSACTION_TYPE', message: `Cannot approve withdrawal: transaction type is ${txRow.type}.` };
      }

      // Check account restriction
      const userRes = await tx.query<{ status: string }>('SELECT status FROM users WHERE id = $1', [txRow.user_id]);
      if (userRes.rows[0] && userRes.rows[0].status !== 'active') {
        throw { statusCode: 403, code: 'ACCOUNT_RESTRICTED', message: 'Cannot approve withdrawal for inactive or restricted user account.' };
      }

      // Check state transitions
      if (txRow.status === 'completed' || txRow.status === 'rejected' || txRow.status === 'failed') {
        throw { statusCode: 400, code: 'ALREADY_PROCESSED', message: `Transaction is already ${txRow.status}.` };
      }

      const amountMinor = BigInt(txRow.amount_minor);

      // Lock wallet account
      const wallet = (await tx.query<{ id: string; locked_minor: string }>(
        `SELECT id, locked_minor FROM wallet_accounts
          WHERE id = $1 FOR UPDATE`,
        [txRow.wallet_account_id]
      )).rows[0];

      if (!wallet) throw { statusCode: 404, code: 'WALLET_NOT_FOUND', message: 'Wallet account not found.' };

      // If caller explicitly requested immediate payout execution and provided payoutRef:
      if (executePayout && payoutRef) {
        await tx.query(
          `UPDATE wallet_accounts
              SET locked_minor = GREATEST(0, locked_minor - $1),
                  version = version + 1,
                  updated_at = now()
            WHERE id = $2`,
          [amountMinor.toString(), wallet.id]
        );

        await tx.query(
          `UPDATE transactions SET status = 'completed', provider_reference = $2, updated_at = now() WHERE id = $1`,
          [txRow.id, payoutRef]
        );
        await tx.query(
          `UPDATE withdrawals SET status = 'completed', provider_reference = $2, updated_at = now() WHERE transaction_id = $1`,
          [txRow.id, payoutRef]
        );

        const ledgerIdempKey = `admin_wd_payout:${txRow.id}`;
        await tx.query(
          `INSERT INTO ledger_entries (
             wallet_account_id, entry_type, direction, amount_minor, currency, reference_type, reference_id, idempotency_key, metadata
           ) VALUES ($1, 'withdrawal', 'debit', $2, 'PKR', 'withdrawal', $3, $4, $5)
           ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
          [
            wallet.id,
            amountMinor.toString(),
            txRow.id,
            ledgerIdempKey,
            JSON.stringify({
              approvedBy: adminId,
              payoutRef,
              gateway: txRow.metadata?.gateway,
              accountPhone: txRow.metadata?.accountPhone,
            }),
          ]
        );

        await tx.query(
          `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata, created_at)
           VALUES ($1, 'admin.withdrawal.payout_success', 'transaction', $2, $3, now())`,
          [
            isUuid(adminId) ? adminId : null,
            isUuid(txRow.id) ? txRow.id : null,
            JSON.stringify({ adminId, payoutRef, transactionId: txRow.id, amountMinor: amountMinor.toString() }),
          ]
        );

        return {
          transactionId: txRow.id,
          amountPkr: Number(amountMinor) / 100,
          status: 'completed',
          payoutRef,
          message: 'Withdrawal payout confirmed and completed.',
        };
      }

      // Default: Internal Approval ONLY. Funds remain held in locked_minor!
      await tx.query(
        `UPDATE transactions SET status = 'approved', updated_at = now() WHERE id = $1`,
        [txRow.id]
      );
      await tx.query(
        `UPDATE withdrawals SET status = 'approved', updated_at = now() WHERE transaction_id = $1`,
        [txRow.id]
      );

      await tx.query(
        `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, 'admin.withdrawal.internal_approve', 'transaction', $2, $3, now())`,
        [
          isUuid(adminId) ? adminId : null,
          isUuid(txRow.id) ? txRow.id : null,
          JSON.stringify({ adminId, transactionId: txRow.id, amountMinor: amountMinor.toString() }),
        ]
      );

      return {
        transactionId: txRow.id,
        amountPkr: Number(amountMinor) / 100,
        status: 'approved',
        message: 'Withdrawal approved internally. Funds remain held until provider payout is confirmed.',
      };
    });

    return res.json({ ok: true, data: output });
  } catch (error: any) {
    const status = error.statusCode || 400;
    return res.status(status).json({
      ok: false,
      error: { code: error.code || 'APPROVE_FAILED', message: error.message || 'Withdrawal approval failed.' },
    });
  }
}

export async function recordWithdrawalPayoutSuccess(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const transactionId = String(req.params.id || '').trim();
  const adminId = String((req as any).auth?.userId || (req as any).admin?.userId || (req as any).user?.id || 'admin').trim();
  const payoutRef = String(req.body?.payoutRef || `PO-${Date.now()}`).trim();

  if (!db) return financialStoreUnavailable(res);

  try {
    const output = await db.transaction(async (tx) => {
      const txRows = (await tx.query<{
        id: string;
        user_id: string;
        wallet_account_id: string;
        type: string;
        amount_minor: string;
        status: string;
        metadata: any;
      }>(
        `SELECT t.id, t.user_id, t.wallet_account_id, t.type, t.amount_minor, t.status, t.metadata
           FROM transactions t
           LEFT JOIN withdrawals w ON w.transaction_id = t.id
          WHERE (t.id = $1 OR w.id = $1)
          FOR UPDATE OF t`,
        [transactionId]
      )).rows;

      if (txRows.length === 0) throw { statusCode: 404, code: 'NOT_FOUND', message: 'Withdrawal transaction not found.' };
      const txRow = txRows[0];
      if (txRow.type !== 'withdrawal') throw { statusCode: 400, code: 'INVALID_TRANSACTION_TYPE', message: `Transaction type is ${txRow.type}.` };

      // Idempotent return if already completed
      if (txRow.status === 'completed') {
        return { transactionId: txRow.id, status: 'completed', payoutRef, replayed: true };
      }
      if (txRow.status === 'rejected' || txRow.status === 'failed') {
        throw { statusCode: 400, code: 'INVALID_STATE_TRANSITION', message: `Cannot complete payout for a ${txRow.status} withdrawal.` };
      }

      const amountMinor = BigInt(txRow.amount_minor);

      // Lock wallet account
      const wallet = (await tx.query<{ id: string; locked_minor: string }>(
        `SELECT id, locked_minor FROM wallet_accounts WHERE id = $1 FOR UPDATE`,
        [txRow.wallet_account_id]
      )).rows[0];

      if (!wallet) throw { statusCode: 404, code: 'WALLET_NOT_FOUND', message: 'Wallet account not found.' };

      // Deduct locked amount
      await tx.query(
        `UPDATE wallet_accounts
            SET locked_minor = GREATEST(0, locked_minor - $1),
                version = version + 1,
                updated_at = now()
          WHERE id = $2`,
        [amountMinor.toString(), wallet.id]
      );

      // Update transactions & withdrawals
      await tx.query(
        `UPDATE transactions SET status = 'completed', provider_reference = $2, updated_at = now() WHERE id = $1`,
        [txRow.id, payoutRef]
      );
      await tx.query(
        `UPDATE withdrawals SET status = 'completed', provider_reference = $2, updated_at = now() WHERE transaction_id = $1`,
        [txRow.id, payoutRef]
      );

      // Immutable debit ledger entry with idempotency key
      const ledgerIdempKey = `admin_wd_payout:${txRow.id}`;
      await tx.query(
        `INSERT INTO ledger_entries (
           wallet_account_id, entry_type, direction, amount_minor, currency, reference_type, reference_id, idempotency_key, metadata
         ) VALUES ($1, 'withdrawal', 'debit', $2, 'PKR', 'withdrawal', $3, $4, $5)
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
        [
          wallet.id,
          amountMinor.toString(),
          txRow.id,
          ledgerIdempKey,
          JSON.stringify({
            approvedBy: adminId,
            payoutRef,
            gateway: txRow.metadata?.gateway,
            accountPhone: txRow.metadata?.accountPhone,
          }),
        ]
      );

      await tx.query(
        `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, 'admin.withdrawal.payout_success', 'transaction', $2, $3, now())`,
        [
          isUuid(adminId) ? adminId : null,
          isUuid(txRow.id) ? txRow.id : null,
          JSON.stringify({ adminId, payoutRef, transactionId: txRow.id, amountMinor: amountMinor.toString() }),
        ]
      );

      return {
        transactionId: txRow.id,
        amountPkr: Number(amountMinor) / 100,
        status: 'completed',
        payoutRef,
      };
    });

    return res.json({ ok: true, data: output });
  } catch (error: any) {
    const status = error.statusCode || 400;
    return res.status(status).json({
      ok: false,
      error: { code: error.code || 'PAYOUT_FAILED', message: error.message || 'Failed to record payout success.' },
    });
  }
}

export async function recordWithdrawalPayoutFailure(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const transactionId = String(req.params.id || '').trim();
  const adminId = String((req as any).auth?.userId || (req as any).admin?.userId || (req as any).user?.id || 'admin').trim();
  const reason = String(req.body?.reason || 'Provider payout failed').trim();

  if (!db) return financialStoreUnavailable(res);

  try {
    const output = await db.transaction(async (tx) => {
      const txRows = (await tx.query<{
        id: string;
        user_id: string;
        wallet_account_id: string;
        type: string;
        amount_minor: string;
        status: string;
      }>(
        `SELECT t.id, t.user_id, t.wallet_account_id, t.type, t.amount_minor, t.status
           FROM transactions t
           LEFT JOIN withdrawals w ON w.transaction_id = t.id
          WHERE (t.id = $1 OR w.id = $1)
          FOR UPDATE OF t`,
        [transactionId]
      )).rows;

      if (txRows.length === 0) throw { statusCode: 404, code: 'NOT_FOUND', message: 'Withdrawal transaction not found.' };
      const txRow = txRows[0];
      if (txRow.type !== 'withdrawal') throw { statusCode: 400, code: 'INVALID_TRANSACTION_TYPE', message: `Transaction type is ${txRow.type}.` };

      // Repeated fail/rejection: idempotent return, NEVER unlock twice
      if (txRow.status === 'failed' || txRow.status === 'rejected') {
        return { transactionId: txRow.id, status: txRow.status, reason, replayed: true };
      }
      if (txRow.status === 'completed') {
        throw { statusCode: 400, code: 'INVALID_STATE_TRANSITION', message: 'Cannot mark an already completed withdrawal as failed.' };
      }

      const amountMinor = BigInt(txRow.amount_minor);

      // Unlock funds: return from locked_minor back to available_minor
      await tx.query(
        `UPDATE wallet_accounts
            SET locked_minor = GREATEST(0, locked_minor - $1),
                available_minor = available_minor + $1,
                version = version + 1,
                updated_at = now()
          WHERE id = $2`,
        [amountMinor.toString(), txRow.wallet_account_id]
      );

      await tx.query(
        `UPDATE transactions
            SET status = 'failed',
                metadata = metadata || jsonb_build_object('failReason', $2::text, 'handledBy', $3::text),
                updated_at = now()
          WHERE id = $1`,
        [txRow.id, reason, adminId]
      );
      await tx.query(
        `UPDATE withdrawals
            SET status = 'failed',
                review_reason = $2,
                updated_at = now()
          WHERE transaction_id = $1`,
        [txRow.id, reason]
      );

      await tx.query(
        `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, 'admin.withdrawal.payout_failure', 'transaction', $2, $3, now())`,
        [
          isUuid(adminId) ? adminId : null,
          isUuid(txRow.id) ? txRow.id : null,
          JSON.stringify({ adminId, reason, transactionId: txRow.id, refundedMinor: amountMinor.toString() }),
        ]
      );

      return { transactionId: txRow.id, status: 'failed', refundedPkr: Number(amountMinor) / 100, reason };
    });

    return res.json({ ok: true, data: output });
  } catch (error: any) {
    const status = error.statusCode || 400;
    return res.status(status).json({
      ok: false,
      error: { code: error.code || 'PAYOUT_FAILURE_RECORD_FAILED', message: error.message || 'Failed to record payout failure.' },
    });
  }
}

export async function rejectWithdrawal(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const transactionId = String(req.params.id || '').trim();
  const adminId = String((req as any).auth?.userId || (req as any).admin?.userId || (req as any).user?.id || 'admin').trim();
  const reason = String(req.body?.reason || 'Rejected by operator').trim();

  if (!db) return financialStoreUnavailable(res);

  try {
    const output = await db.transaction(async (tx) => {
      // 1. Lock transaction row (matching either transactions.id or withdrawals.id)
      const txRows = (await tx.query<{
        id: string;
        user_id: string;
        wallet_account_id: string;
        type: string;
        amount_minor: string;
        status: string;
      }>(
        `SELECT t.id, t.user_id, t.wallet_account_id, t.type, t.amount_minor, t.status
           FROM transactions t
           LEFT JOIN withdrawals w ON w.transaction_id = t.id
          WHERE (t.id = $1 OR w.id = $1)
          FOR UPDATE OF t`,
        [transactionId]
      )).rows;

      if (txRows.length === 0) {
        throw { statusCode: 404, code: 'NOT_FOUND', message: 'Withdrawal transaction not found.' };
      }

      const txRow = txRows[0];
      if (txRow.type !== 'withdrawal') {
        throw { statusCode: 400, code: 'INVALID_TRANSACTION_TYPE', message: `Cannot reject withdrawal: transaction type is ${txRow.type}.` };
      }

      // Check state transition
      if (txRow.status === 'rejected' || txRow.status === 'failed') {
        return { transactionId: txRow.id, status: txRow.status, reason, replayed: true };
      }
      if (txRow.status === 'completed') {
        throw { statusCode: 400, code: 'INVALID_STATE_TRANSITION', message: 'Cannot reject an already completed withdrawal.' };
      }

      const amountMinor = BigInt(txRow.amount_minor);

      // 2. Unlock funds in wallet (return from locked back to available)
      await tx.query(
        `UPDATE wallet_accounts
            SET locked_minor = GREATEST(0, locked_minor - $1),
                available_minor = available_minor + $1,
                version = version + 1,
                updated_at = now()
          WHERE id = $2`,
        [amountMinor.toString(), txRow.wallet_account_id]
      );

      // 3. Update transaction & withdrawal
      await tx.query(
        `UPDATE transactions
            SET status = 'rejected',
                metadata = metadata || jsonb_build_object('rejectReason', $2::text, 'rejectedBy', $3::text),
                updated_at = now()
          WHERE id = $1`,
        [txRow.id, reason, adminId]
      );
      await tx.query(
        `UPDATE withdrawals
            SET status = 'rejected',
                review_reason = $2,
                updated_at = now()
          WHERE transaction_id = $1`,
        [txRow.id, reason]
      );

      await tx.query(
        `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, 'admin.withdrawal.reject', 'transaction', $2, $3, now())`,
        [
          isUuid(adminId) ? adminId : null,
          isUuid(txRow.id) ? txRow.id : null,
          JSON.stringify({ adminId, reason, transactionId: txRow.id, refundedMinor: amountMinor.toString() }),
        ]
      );

      return { transactionId: txRow.id, status: 'rejected', refundedPkr: Number(amountMinor) / 100, reason };
    });

    return res.json({ ok: true, data: output });
  } catch (error: any) {
    const status = error.statusCode || 400;
    return res.status(status).json({
      ok: false,
      error: { code: error.code || 'REJECT_FAILED', message: error.message || 'Withdrawal rejection failed.' },
    });
  }
}
