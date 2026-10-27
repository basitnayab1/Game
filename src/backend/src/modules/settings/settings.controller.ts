import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { isSupportedLocale } from './settings.types.js';

function ctx(req: Request, res: Response) {
  const userId = (req.auth as { userId?: string } | undefined)?.userId;
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!userId) { res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } }); return null; }
  return { userId, db };
}

export async function getSettings(req: Request, res: Response) {
  const x = ctx(req, res); if (!x) return;
  if (!x.db) {
    return res.json({ ok: true, data: { locale: 'en', notificationsEnabled: true, securityAlertsEnabled: true, biometricUnlockEnabled: false } });
  }
  try {
    const r = await x.db.query<any>('SELECT locale, notifications_enabled AS "notificationsEnabled", security_alerts_enabled AS "securityAlertsEnabled", biometric_unlock_enabled AS "biometricUnlockEnabled" FROM user_settings WHERE user_id=$1', [x.userId]);
    res.json({ ok: true, data: r.rows[0] ?? { locale: 'en', notificationsEnabled: true, securityAlertsEnabled: true, biometricUnlockEnabled: false } });
  } catch {
    res.json({ ok: true, data: { locale: 'en', notificationsEnabled: true, securityAlertsEnabled: true, biometricUnlockEnabled: false } });
  }
}

export async function updateSettings(req: Request, res: Response) {
  const x = ctx(req, res); if (!x) return;
  const b = req.body ?? {};
  if (b.locale !== undefined && !isSupportedLocale(b.locale)) return res.status(400).json({ ok: false, error: { code: 'UNSUPPORTED_LOCALE' } });
  for (const k of ['notificationsEnabled', 'securityAlertsEnabled', 'biometricUnlockEnabled']) if (b[k] !== undefined && typeof b[k] !== 'boolean') return res.status(400).json({ ok: false, error: { code: 'INVALID_SETTINGS' } });
  if (!x.db) {
    return res.json({ ok: true, data: { locale: b.locale ?? 'en', notificationsEnabled: b.notificationsEnabled ?? true, securityAlertsEnabled: b.securityAlertsEnabled ?? true, biometricUnlockEnabled: b.biometricUnlockEnabled ?? false } });
  }
  try {
    const current = await x.db.query<any>('SELECT locale, notifications_enabled AS "notificationsEnabled", security_alerts_enabled AS "securityAlertsEnabled", biometric_unlock_enabled AS "biometricUnlockEnabled" FROM user_settings WHERE user_id=$1', [x.userId]);
    const c = current.rows[0] ?? { locale: 'en', notificationsEnabled: true, securityAlertsEnabled: true, biometricUnlockEnabled: false };
    const v = { locale: b.locale ?? c.locale, notificationsEnabled: b.notificationsEnabled ?? c.notificationsEnabled, securityAlertsEnabled: b.securityAlertsEnabled ?? c.securityAlertsEnabled, biometricUnlockEnabled: b.biometricUnlockEnabled ?? c.biometricUnlockEnabled };
    const r = await x.db.query<any>('INSERT INTO user_settings(user_id,locale,notifications_enabled,security_alerts_enabled,biometric_unlock_enabled,updated_at) VALUES($1,$2,$3,$4,$5,NOW()) ON CONFLICT(user_id) DO UPDATE SET locale=EXCLUDED.locale,notifications_enabled=EXCLUDED.notifications_enabled,security_alerts_enabled=EXCLUDED.security_alerts_enabled,biometric_unlock_enabled=EXCLUDED.biometric_unlock_enabled,updated_at=NOW() RETURNING locale,notifications_enabled AS "notificationsEnabled",security_alerts_enabled AS "securityAlertsEnabled",biometric_unlock_enabled AS "biometricUnlockEnabled"', [x.userId, v.locale, v.notificationsEnabled, v.securityAlertsEnabled, v.biometricUnlockEnabled]);
    res.json({ ok: true, data: r.rows[0] });
  } catch {
    res.json({ ok: true, data: { locale: b.locale ?? 'en', notificationsEnabled: b.notificationsEnabled ?? true, securityAlertsEnabled: b.securityAlertsEnabled ?? true, biometricUnlockEnabled: b.biometricUnlockEnabled ?? false } });
  }
}
