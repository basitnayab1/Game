import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import * as svc from './admin-operations.service.js';

const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

function ctx(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const admin = (req as Request & { admin?: { userId: string; role: string } }).admin ?? { userId: 'admin', role: 'super_admin' };
  return { db, admin };
}

function storeUnavailable(res: Response) {
  return res.status(503).json({ ok: false, error: { code: 'ADMIN_STORE_UNAVAILABLE', message: 'Admin operations require the PostgreSQL database to be configured.' } });
}

function fail(res: Response, e: unknown) {
  const code = e instanceof Error ? e.message : 'ADMIN_OPERATION_FAILED';
  const known = new Set(['USER_NOT_FOUND', 'KYC_PROFILE_NOT_FOUND', 'INVALID_KYC_STATUS', 'RISK_FLAG_NOT_FOUND', 'INVALID_RISK_STATUS', 'SUPPORT_TICKET_NOT_FOUND', 'INVALID_SUPPORT_STATUS']);
  return res.status(known.has(code) ? 400 : 500).json({ ok: false, error: { code, message: known.has(code) ? code : 'Admin operation failed' } });
}

export async function adminOverview(req: Request, res: Response) {
  const c = ctx(req, res);
  if (!c.db) return storeUnavailable(res);
  try {
    return res.json({ ok: true, data: await svc.getAdminOverview(c.db) });
  } catch (e) {
    return fail(res, e);
  }
}

export async function adminUsers(req: Request, res: Response) {
  const c = ctx(req, res);
  if (!c.db) return storeUnavailable(res);
  try {
    return res.json({ ok: true, data: await svc.listAdminUsers(c.db, String(req.query.q ?? ''), req.query.status ? String(req.query.status) : undefined) });
  } catch (e) {
    return fail(res, e);
  }
}

export async function adminUserDetail(req: Request, res: Response) {
  const c = ctx(req, res);
  if (!c.db) return storeUnavailable(res);
  try {
    return res.json({ ok: true, data: await svc.getAdminUser(c.db, String(req.params.userId)) });
  } catch (e) {
    return fail(res, e);
  }
}

export async function adminKycReview(req: Request, res: Response) {
  const c = ctx(req, res);
  const targetUserId = String(req.params.userId);
  const targetStatus = String(req.body?.status ?? 'verified');

  if (!c.db) return storeUnavailable(res);
  try {
    return res.json({ ok: true, data: await svc.reviewKyc(c.db, c.admin.userId, targetUserId, targetStatus, typeof req.body?.note === 'string' ? req.body.note : undefined) });
  } catch (e) {
    return fail(res, e);
  }
}

export async function adminRiskUpdate(req: Request, res: Response) {
  const c = ctx(req, res);
  if (!c.db) return storeUnavailable(res);
  try {
    return res.json({ ok: true, data: await svc.updateRiskFlag(c.db, c.admin.userId, String(req.params.flagId), String(req.body?.status ?? '')) });
  } catch (e) {
    return fail(res, e);
  }
}

export async function adminSupport(req: Request, res: Response) {
  const c = ctx(req, res);
  if (!c.db) return storeUnavailable(res);
  try {
    return res.json({ ok: true, data: await svc.listSupportTicketsAdmin(c.db, req.query.status ? String(req.query.status) : undefined) });
  } catch (e) {
    return fail(res, e);
  }
}

export async function adminSupportDetail(req: Request, res: Response) {
  const c = ctx(req, res);
  if (!c.db) return storeUnavailable(res);
  try {
    return res.json({ ok: true, data: await svc.getSupportTicketAdmin(c.db, String(req.params.ticketId)) });
  } catch (e) {
    return fail(res, e);
  }
}

export async function adminSupportStatus(req: Request, res: Response) {
  const c = ctx(req, res);
  if (!c.db) return storeUnavailable(res);
  try {
    return res.json({ ok: true, data: await svc.updateSupportTicket(c.db, c.admin.userId, String(req.params.ticketId), String(req.body?.status ?? '')) });
  } catch (e) {
    return fail(res, e);
  }
}

export async function adminUserStatusUpdate(req: Request, res: Response) {
  const c = ctx(req, res);
  const userId = String(req.params.userId || '').trim();
  const status = String(req.body?.status || '').trim().toLowerCase();
  const reason = String(req.body?.reason || '').trim();

  if (!['active', 'suspended', 'banned'].includes(status)) {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_STATUS', message: 'Status must be active, suspended, or banned.' } });
  }

  if (!c.db) return storeUnavailable(res);

  try {
    const result = await c.db.query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status', [status, userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
    }
    await c.db.query(
      'INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
      [c.admin.userId, 'admin.user.status_update', 'user', userId, JSON.stringify({ newStatus: status, reason })]
    );
    return res.json({ ok: true, data: { userId, status, reason } });
  } catch (e) {
    return fail(res, e);
  }
}

export async function adminUserBalanceAdjust(req: Request, res: Response) {
  const c = ctx(req, res);
  const userId = String(req.params.userId || '').trim();
  const amountMinor = Number(req.body?.amountMinor || 0);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

  // 1. Explicit permission check: only super_admin is authorized
  if (c.admin.role !== 'super_admin') {
    return res.status(403).json({
      ok: false,
      error: { code: 'SUPER_ADMIN_REQUIRED', message: 'Only super_admin role is permitted to perform manual balance adjustments.' },
    });
  }

  // 2. Explicit reason required (at least 5 characters)
  if (!reason || reason.length < 5) {
    return res.status(400).json({
      ok: false,
      error: { code: 'REASON_REQUIRED', message: 'Explicit non-empty reason (at least 5 characters) is required for balance adjustment.' },
    });
  }

  // 3. Amount validation
  if (!amountMinor || isNaN(amountMinor) || !Number.isSafeInteger(amountMinor) || amountMinor === 0) {
    return res.status(400).json({
      ok: false,
      error: { code: 'INVALID_AMOUNT', message: 'Valid non-zero amountMinor integer is required.' },
    });
  }

  const direction: 'credit' | 'debit' = amountMinor > 0 ? 'credit' : 'debit';
  const absAmount = Math.abs(amountMinor);

  if (!c.db) return storeUnavailable(res);

  try {
    const result = await c.db.transaction(async (tx) => {
      // 1. Lock wallet row
      const w = await tx.query<{ id: string; available_minor: string }>(
        'SELECT id, available_minor FROM wallet_accounts WHERE user_id = $1 FOR UPDATE',
        [userId]
      );
      if (w.rows.length === 0) throw { statusCode: 404, code: 'WALLET_NOT_FOUND', message: 'Wallet account not found.' };

      const current = BigInt(w.rows[0].available_minor);
      const diff = BigInt(amountMinor);
      const next = current + diff;
      if (next < 0n) {
        throw { statusCode: 400, code: 'INSUFFICIENT_FUNDS', message: 'Adjustment would result in negative available balance.' };
      }

      // 2. Update wallet balance
      await tx.query(
        `UPDATE wallet_accounts
            SET available_minor = $1,
                version = version + 1,
                updated_at = NOW()
          WHERE id = $2`,
        [next.toString(), w.rows[0].id]
      );

      // 3. Insert transaction record with correct column name (wallet_account_id)
      const txId = (await tx.query<{ id: string }>(
        `INSERT INTO transactions (user_id, wallet_account_id, type, amount_minor, currency, status, idempotency_key, metadata, created_at, updated_at)
         VALUES ($1, $2, 'adjustment', $3, 'PKR', 'completed', $4, $5, NOW(), NOW()) RETURNING id`,
        [
          userId,
          w.rows[0].id,
          absAmount.toString(),
          `admin_adj:${w.rows[0].id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          JSON.stringify({ amountMinor, direction, reason, actor: c.admin.userId }),
        ]
      )).rows[0].id;

      // 4. Double-entry immutable ledger entry
      const ledgerIdempKey = `admin_adj_ledger:${txId}`;
      await tx.query(
        `INSERT INTO ledger_entries (
           wallet_account_id, entry_type, direction, amount_minor, currency, reference_type, reference_id, idempotency_key, metadata
         ) VALUES ($1, 'manual_adjustment', $2, $3, 'PKR', 'adjustment', $4, $5, $6)
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
        [
          w.rows[0].id,
          direction,
          absAmount.toString(),
          txId,
          ledgerIdempKey,
          JSON.stringify({ actor: c.admin.userId, reason, previous: current.toString(), new: next.toString() }),
        ]
      );

      // 5. Durable audit record in audit_events
      await tx.query(
        `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, 'admin.wallet.adjustment', 'wallet_account', $2, $3, NOW())`,
        [
          isUuid(c.admin.userId) ? c.admin.userId : null,
          isUuid(w.rows[0].id) ? w.rows[0].id : null,
          JSON.stringify({ txId, amountMinor, direction, previous: current.toString(), new: next.toString(), reason, actor: c.admin.userId }),
        ]
      );

      return {
        userId,
        previousBalanceMinor: Number(current),
        newBalanceMinor: Number(next),
        adjustedMinor: amountMinor,
        reason,
      };
    });

    return res.json({ ok: true, data: result });
  } catch (e: any) {
    if (e.statusCode) {
      return res.status(e.statusCode).json({ ok: false, error: { code: e.code, message: e.message } });
    }
    return fail(res, e);
  }
}

