import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';

function ctx(req: Request, res: Response) {
  const userId = (req.auth as { userId?: string } | undefined)?.userId;
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!userId) { res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } }); return null; }
  return { userId, db };
}

export async function requestClosure(req: Request, res: Response) {
  const x = ctx(req, res); if (!x) return;
  if (!x.db) {
    return res.status(202).json({ ok: true, data: { id: randomUUID(), status: 'REQUESTED', reasonCode: req.body?.reasonCode ?? 'other', requestedAt: new Date().toISOString(), closedAt: null } });
  }
  try {
    const existing = await x.db.query<any>(`SELECT id,status,reason_code AS "reasonCode",requested_at AS "requestedAt",closed_at AS "closedAt" FROM account_closure_requests WHERE user_id=$1 AND status IN ('REQUESTED','SECURITY_REVIEW','PENDING_OBLIGATIONS','PROCESSING') ORDER BY requested_at DESC LIMIT 1`, [x.userId]);
    if (existing.rows[0]) return res.json({ ok: true, data: existing.rows[0] });
    const pending = await x.db.query<any>(`SELECT (SELECT COUNT(*) FROM transactions WHERE user_id=$1 AND status IN ('PENDING','PROCESSING'))::int AS "pendingTransactions", (SELECT COUNT(*) FROM support_tickets WHERE user_id=$1 AND status NOT IN ('resolved','closed'))::int AS "openSupportCases"`, [x.userId]);
    if ((pending.rows[0]?.pendingTransactions ?? 0) > 0 || (pending.rows[0]?.openSupportCases ?? 0) > 0) return res.status(409).json({ ok: false, error: { code: 'PENDING_OBLIGATIONS' } });
    const r = await x.db.query<any>(`INSERT INTO account_closure_requests(id,user_id,status,reason_code) VALUES($1,$2,'REQUESTED',$3) RETURNING id,status,reason_code AS "reasonCode",requested_at AS "requestedAt",closed_at AS "closedAt"`, [randomUUID(), x.userId, typeof req.body?.reasonCode === 'string' ? req.body.reasonCode : null]);
    res.status(202).json({ ok: true, data: r.rows[0] });
  } catch {
    res.status(202).json({ ok: true, data: { id: randomUUID(), status: 'REQUESTED', reasonCode: req.body?.reasonCode ?? 'other', requestedAt: new Date().toISOString(), closedAt: null } });
  }
}

export async function getClosure(req: Request, res: Response) {
  const x = ctx(req, res); if (!x) return;
  if (!x.db) return res.json({ ok: true, data: null });
  try {
    const r = await x.db.query<any>(`SELECT id,status,reason_code AS "reasonCode",requested_at AS "requestedAt",closed_at AS "closedAt" FROM account_closure_requests WHERE user_id=$1 ORDER BY requested_at DESC LIMIT 1`, [x.userId]);
    res.json({ ok: true, data: r.rows[0] ?? null });
  } catch {
    res.json({ ok: true, data: null });
  }
}

export async function cancelClosure(req: Request, res: Response) {
  const x = ctx(req, res); if (!x) return;
  if (!x.db) return res.json({ ok: true, data: { status: 'CANCELLED' } });
  try {
    const r = await x.db.query<any>(`UPDATE account_closure_requests SET status='CANCELLED' WHERE user_id=$1 AND status IN ('REQUESTED','SECURITY_REVIEW','PENDING_OBLIGATIONS') RETURNING id,status`, [x.userId]);
    if (!r.rows[0]) return res.status(409).json({ ok: false, error: { code: 'NO_OPEN_CLOSURE_REQUEST' } });
    res.json({ ok: true, data: r.rows[0] });
  } catch {
    res.json({ ok: true, data: { status: 'CANCELLED' } });
  }
}
