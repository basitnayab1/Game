import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { ensureReferralCode, getReferralSummary, listReferralHistory } from './referral.service.js';

function uid(req: Request) { return (req.auth as { userId?: string } | undefined)?.userId; }
function db(req: Request) { return (req.app.locals as { db?: DatabaseClient }).db; }

export async function getReferral(req: Request, res: Response) {
  const u = uid(req), d = db(req);
  if (!u) return res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } });
  if (!d) {
    const code = `N5${u.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    return res.json({ ok: true, data: { code, summary: { code, total: 0, pending: 0, qualified: 0, rewarded: 0 } } });
  }
  try {
    const code = await ensureReferralCode(d, u);
    return res.json({ ok: true, data: { code, summary: await getReferralSummary(d, u) } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: { code: e instanceof Error ? e.message : 'REFERRAL_READ_FAILED' } });
  }
}

export async function getReferralHistory(req: Request, res: Response) {
  const u = uid(req), d = db(req);
  if (!u) return res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } });
  if (!d) return res.json({ ok: true, data: [] });
  try {
    return res.json({ ok: true, data: await listReferralHistory(d, u) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: { code: e instanceof Error ? e.message : 'REFERRAL_HISTORY_FAILED' } });
  }
}
