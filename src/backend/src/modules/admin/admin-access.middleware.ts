import type { Request, Response, NextFunction } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = (req.auth as { userId?: string } | undefined)?.userId;
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!userId) return res.status(401).json({ ok:false, error:{ code:'AUTHENTICATION_REQUIRED' } });
  if (!db) {
    return res.status(503).json({
      ok: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Admin authorization database is unavailable' },
    });
  }
  try {
    const result = await db.query<{ role: string; status: string }>(
      `SELECT ar.code AS role, au.status
       FROM admin_users au JOIN admin_roles ar ON ar.id=au.role_id
       WHERE au.user_id=$1`, [userId]);
    const row = result.rows[0];
    if (!row || row.status !== 'active') return res.status(403).json({ ok:false, error:{ code:'ADMIN_ACCESS_REQUIRED' } });
    (req as Request & { admin?: { userId: string; role: string } }).admin = { userId, role: row.role };
    next();
  } catch {
    return res.status(503).json({ ok: false, error: { code: 'ADMIN_AUTH_CHECK_FAILED', message: 'Failed to verify admin authorization' } });
  }
}
