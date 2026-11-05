import type { Request, Response, NextFunction } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { adminPath, roleAllows } from './admin-permissions.js';

/** 2FA is required everywhere except the unit-test runner (override with ADMIN_2FA_REQUIRED). */
export function adminTwoFactorRequired(): boolean {
  const flag = process.env.ADMIN_2FA_REQUIRED;
  if (flag === 'true') return true;
  if (flag === 'false') return process.env.NODE_ENV === 'test';
  return process.env.NODE_ENV !== 'test';
}

/** Reachable before 2FA is passed: who am I, and setting up / entering the code. */
const BEFORE_2FA = /^\/(me|2fa\/[a-z]+)$/;

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.auth as { userId?: string; sessionId?: string } | undefined;
  const userId = auth?.userId;
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!userId) return res.status(401).json({ ok:false, error:{ code:'AUTHENTICATION_REQUIRED' } });
  if (!db) {
    return res.status(503).json({
      ok: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Admin authorization database is unavailable' },
    });
  }
  let row: { role: string; status: string; totp_enabled?: boolean; session_verified?: boolean } | undefined;
  try {
    const result = await db.query<{ role: string; status: string; totp_enabled: boolean; session_verified: boolean }>(
      `SELECT ar.code AS role, au.status,
              (au.totp_enabled_at IS NOT NULL) AS totp_enabled,
              EXISTS (SELECT 1 FROM user_sessions s
                       WHERE s.id = $2::uuid AND s.user_id = au.user_id AND s.admin_2fa_at IS NOT NULL) AS session_verified
       FROM admin_users au JOIN admin_roles ar ON ar.id=au.role_id
       WHERE au.user_id=$1`, [userId, auth?.sessionId ?? null]);
    row = result.rows[0];
  } catch {
    return res.status(503).json({ ok: false, error: { code: 'ADMIN_AUTH_CHECK_FAILED', message: 'Failed to verify admin authorization' } });
  }
  if (!row || row.status !== 'active') return res.status(403).json({ ok:false, error:{ code:'ADMIN_ACCESS_REQUIRED' } });

  const path = adminPath(req.originalUrl);
  if (adminTwoFactorRequired() && !BEFORE_2FA.test(path)) {
    if (!row.totp_enabled) {
      return res.status(403).json({ ok: false, error: { code: 'ADMIN_2FA_SETUP_REQUIRED', message: 'Set up the authenticator app first.' } });
    }
    if (!row.session_verified) {
      return res.status(403).json({ ok: false, error: { code: 'ADMIN_2FA_REQUIRED', message: 'Enter the code from your authenticator app.' } });
    }
  }
  if (path && !roleAllows(row.role, req.method, path)) {
    return res.status(403).json({ ok: false, error: { code: 'ADMIN_PERMISSION_DENIED', message: 'Your role does not allow this.' } });
  }
  (req as Request & { admin?: { userId: string; role: string } }).admin = { userId, role: row.role };
  next();
}
