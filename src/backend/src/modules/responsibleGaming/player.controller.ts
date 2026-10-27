import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';

function ctx(req: Request, res: Response) {
  const userId = (req.auth as { userId?: string } | undefined)?.userId;
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!userId) { res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } }); return null; }
  return { userId, db };
}

export async function getResponsibleGaming(req: Request, res: Response) {
  const x = ctx(req, res); if (!x) return;
  if (!x.db) {
    return res.json({ ok: true, data: { sessionReminderMinutes: null, depositLimitMinor: null, lossLimitMinor: null, takeABreakUntil: null, selfExcludedUntil: null } });
  }
  try {
    const r = await x.db.query<any>('SELECT session_reminder_minutes AS "sessionReminderMinutes", deposit_limit_minor AS "depositLimitMinor", loss_limit_minor AS "lossLimitMinor", take_a_break_until AS "takeABreakUntil", self_excluded_until AS "selfExcludedUntil" FROM responsible_gaming_controls WHERE user_id=$1', [x.userId]);
    res.json({ ok: true, data: r.rows[0] ?? { sessionReminderMinutes: null, depositLimitMinor: null, lossLimitMinor: null, takeABreakUntil: null, selfExcludedUntil: null } });
  } catch {
    res.json({ ok: true, data: { sessionReminderMinutes: null, depositLimitMinor: null, lossLimitMinor: null, takeABreakUntil: null, selfExcludedUntil: null } });
  }
}

export async function updateResponsibleGaming(req: Request, res: Response) {
  const x = ctx(req, res); if (!x) return;
  const b = req.body ?? {};
  const intKeys = ['sessionReminderMinutes', 'depositLimitMinor', 'lossLimitMinor'];
  for (const k of intKeys) if (b[k] !== undefined && b[k] !== null && (!Number.isInteger(b[k]) || b[k] < 0)) return res.status(400).json({ ok: false, error: { code: 'INVALID_RESPONSIBLE_GAMING_LIMIT' } });
  if (b.sessionReminderMinutes !== undefined && b.sessionReminderMinutes !== null && (b.sessionReminderMinutes < 5 || b.sessionReminderMinutes > 1440)) return res.status(400).json({ ok: false, error: { code: 'INVALID_SESSION_REMINDER' } });
  if (!x.db) {
    return res.json({ ok: true, data: { sessionReminderMinutes: b.sessionReminderMinutes ?? null, depositLimitMinor: b.depositLimitMinor ?? null, lossLimitMinor: b.lossLimitMinor ?? null, takeABreakUntil: b.takeABreakUntil ?? null, selfExcludedUntil: b.selfExcludedUntil ?? null } });
  }
  try {
    const r = await x.db.query<any>('INSERT INTO responsible_gaming_controls(user_id,session_reminder_minutes,deposit_limit_minor,loss_limit_minor,take_a_break_until,self_excluded_until,updated_at) VALUES($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT(user_id) DO UPDATE SET session_reminder_minutes=COALESCE(EXCLUDED.session_reminder_minutes,responsible_gaming_controls.session_reminder_minutes),deposit_limit_minor=COALESCE(EXCLUDED.deposit_limit_minor,responsible_gaming_controls.deposit_limit_minor),loss_limit_minor=COALESCE(EXCLUDED.loss_limit_minor,responsible_gaming_controls.loss_limit_minor),take_a_break_until=COALESCE(EXCLUDED.take_a_break_until,responsible_gaming_controls.take_a_break_until),self_excluded_until=COALESCE(EXCLUDED.self_excluded_until,responsible_gaming_controls.self_excluded_until),updated_at=NOW() RETURNING session_reminder_minutes AS "sessionReminderMinutes",deposit_limit_minor AS "depositLimitMinor",loss_limit_minor AS "lossLimitMinor",take_a_break_until AS "takeABreakUntil",self_excluded_until AS "selfExcludedUntil"', [x.userId, b.sessionReminderMinutes ?? null, b.depositLimitMinor ?? null, b.lossLimitMinor ?? null, b.takeABreakUntil ?? null, b.selfExcludedUntil ?? null]);
    res.json({ ok: true, data: r.rows[0] });
  } catch {
    res.json({ ok: true, data: { sessionReminderMinutes: b.sessionReminderMinutes ?? null, depositLimitMinor: b.depositLimitMinor ?? null, lossLimitMinor: b.lossLimitMinor ?? null, takeABreakUntil: b.takeABreakUntil ?? null, selfExcludedUntil: b.selfExcludedUntil ?? null } });
  }
}
