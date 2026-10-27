import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { getAccountStatement } from './account-statement.service.js';

/** Read-only statement endpoint. No wallet or ledger mutation occurs here. */
export async function getMyAccountStatement(req: Request, res: Response) {
  const userId = (req.auth as { userId?: string } | undefined)?.userId;
  if (!userId) return res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } });

  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) {
    return res.status(503).json({
      ok: false,
      error: { code: 'DATABASE_NOT_CONFIGURED', message: 'Account statement service is not configured' },
    });
  }

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const fromDate = String(req.query.fromDate || thirtyDaysAgo.toISOString().slice(0, 10));
    const toDate = String(req.query.toDate || now.toISOString().slice(0, 10));

    const data = await getAccountStatement(db, userId, {
      fromDate,
      toDate,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    console.error('[ACCOUNT STATEMENT ERROR]', error);
    const message = error instanceof Error ? error.message : 'STATEMENT_REQUEST_FAILED';
    const status = message === 'Invalid date range' ? 400 : 500;
    return res.status(status).json({ ok: false, error: { code: message } });
  }
}
