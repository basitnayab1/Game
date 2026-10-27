import type { Request, Response, NextFunction } from 'express';
import { verifyAccess } from '../utils/tokens.js';
import type { AuthContext } from '../core/security/auth.types.js';
import type { DatabaseClient } from '../core/database/database.types.js';

export type AuthRequest = Request & {
  auth?: AuthContext & { userId: string; sessionId: string };
};

/**
 * Validates the access token and the server-side session it names. The session
 * must exist in PostgreSQL, belong to the token's user, be neither revoked nor
 * expired, and the user must be active. There is no in-memory or development fallback.
 */
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  let claims: ReturnType<typeof verifyAccess>;
  try {
    claims = verifyAccess(header.slice(7));
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
  if (claims.type !== 'access') {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }

  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) {
    return res.status(503).json({ error: 'AUTH_STORE_UNAVAILABLE' });
  }

  let valid = false;
  try {
    const r = await db.query<{ ok: boolean }>(
      `SELECT (s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'active') AS ok
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = $1 AND s.user_id = $2`,
      [claims.sid, claims.sub],
    );
    valid = r.rows[0]?.ok === true;
  } catch (err) {
    console.error('[AUTH:SESSION_LOOKUP_FAILED]', (err as Error).message);
    return res.status(503).json({ error: 'AUTH_STORE_UNAVAILABLE' });
  }

  if (!valid) {
    return res.status(401).json({ error: 'SESSION_INVALID' });
  }
  const authUser = { id: claims.sub, sessionId: claims.sid, roles: [] as string[] };
  req.auth = { user: authUser, userId: claims.sub, sessionId: claims.sid };
  next();
}
