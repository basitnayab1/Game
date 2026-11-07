import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { normalizePhone } from '../auth/service.js';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { adminTwoFactorRequired, requireAdmin } from './admin-access.middleware.js';
import { ROLE_LABELS } from './admin-permissions.js';
import { alertAdminEvent } from '../notifications/admin-alerts.js';
import { decryptSecret, encryptSecret, generateSecret, matchStep, otpauthUri } from './totp.js';

/**
 * The signed-in admin (/me), authenticator 2FA (/2fa/*), and the Owner's
 * team management (/team) and activity log (/audit).
 * requireAdmin decides who may call what (see admin-permissions.ts).
 */

const MAX_FAILED_CODES = 5;
const LOCK_MINUTES = 15;
const TEAM_ROLES = ['admin', 'finance', 'support'] as const;

type AdminRequest = Request & { admin?: { userId: string; role: string }; auth?: { userId: string; sessionId: string } };

const dbOf = (req: Request) => (req.app.locals as { db: DatabaseClient }).db;
const fail = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ ok: false, error: { code, message } });

async function audit(db: DatabaseClient, actorId: string, action: string, entityId: string | null, metadata: object) {
  await db.query(
    `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES ($1, $2, 'admin_user', $3, $4, now())`,
    [actorId, action, entityId, JSON.stringify(metadata)],
  );
}

export function createAdminTeamRouter(): Router {
  const router = Router();
  const guard = [requireAuth, requireAdmin];

  router.get('/me', ...guard, async (req: AdminRequest, res) => {
    const db = dbOf(req);
    const row = (await db.query<{ phone_e164: string | null; display_name: string | null; totp_enabled: boolean; session_verified: boolean }>(
      `SELECT u.phone_e164, p.display_name, (au.totp_enabled_at IS NOT NULL) AS totp_enabled,
              EXISTS (SELECT 1 FROM user_sessions s WHERE s.id = $2::uuid AND s.admin_2fa_at IS NOT NULL) AS session_verified
         FROM admin_users au JOIN users u ON u.id = au.user_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE au.user_id = $1`,
      [req.admin!.userId, req.auth!.sessionId],
    )).rows[0];
    res.json({ ok: true, data: {
      userId: req.admin!.userId,
      phone: row?.phone_e164 ?? null,
      displayName: row?.display_name ?? null,
      role: req.admin!.role,
      roleLabel: ROLE_LABELS[req.admin!.role] ?? req.admin!.role,
      totpEnabled: row?.totp_enabled === true,
      sessionVerified: row?.session_verified === true,
      twoFactorRequired: adminTwoFactorRequired(),
    } });
  });

  // ---- 2FA -------------------------------------------------------------

  router.post('/2fa/setup', ...guard, async (req: AdminRequest, res) => {
    const db = dbOf(req);
    const row = (await db.query<{ totp_enabled_at: string | null; totp_secret_enc: string | null; phone_e164: string | null }>(
      `SELECT au.totp_enabled_at, au.totp_secret_enc, u.phone_e164 FROM admin_users au JOIN users u ON u.id = au.user_id WHERE au.user_id = $1`,
      [req.admin!.userId],
    )).rows[0];
    if (row?.totp_enabled_at) return fail(res, 409, 'ADMIN_2FA_ALREADY_ENABLED', '2FA is already set up. Ask the Owner to reset it.');
    // A key not yet confirmed is shown again (the page may have been reloaded).
    if (row?.totp_secret_enc) {
      const pending = decryptSecret(row.totp_secret_enc);
      return res.json({ ok: true, data: { secret: pending, otpauthUri: otpauthUri(pending, row.phone_e164 ?? req.admin!.userId) } });
    }
    const secret = generateSecret();
    await db.query(
      `UPDATE admin_users SET totp_secret_enc = $2, totp_failed_count = 0, totp_locked_until = NULL, updated_at = now() WHERE user_id = $1`,
      [req.admin!.userId, encryptSecret(secret)],
    );
    res.json({ ok: true, data: { secret, otpauthUri: otpauthUri(secret, row?.phone_e164 ?? req.admin!.userId) } });
  });

  /** Checks a code for the signed-in admin; on success marks this session as verified. */
  async function checkCode(req: AdminRequest, res: Response, mode: 'enable' | 'verify') {
    const code = String(req.body?.code ?? '');
    const db = dbOf(req);
    const userId = req.admin!.userId;
    let lockedNow = false;
    const outcome = await db.transaction(async (tx) => {
      const row = (await tx.query<{ totp_secret_enc: string | null; totp_enabled_at: string | null; totp_last_step: string | null; totp_failed_count: number; locked: boolean }>(
        `SELECT totp_secret_enc, totp_enabled_at, totp_last_step, totp_failed_count,
                (totp_locked_until IS NOT NULL AND totp_locked_until > now()) AS locked
           FROM admin_users WHERE user_id = $1 FOR UPDATE`,
        [userId],
      )).rows[0];
      if (!row?.totp_secret_enc) return { status: 400, code: 'ADMIN_2FA_NOT_SET_UP', message: 'Set up the authenticator app first.' };
      if (mode === 'enable' && row.totp_enabled_at) return { status: 409, code: 'ADMIN_2FA_ALREADY_ENABLED', message: '2FA is already set up.' };
      if (mode === 'verify' && !row.totp_enabled_at) return { status: 400, code: 'ADMIN_2FA_NOT_SET_UP', message: 'Set up the authenticator app first.' };
      if (row.locked) return { status: 429, code: 'ADMIN_2FA_LOCKED', message: `Too many wrong codes. Try again in ${LOCK_MINUTES} minutes.` };

      const step = matchStep(decryptSecret(row.totp_secret_enc), code);
      // A code can be used once only.
      if (step === null || (row.totp_last_step !== null && step <= Number(row.totp_last_step))) {
        // Five wrong codes lock 2FA for LOCK_MINUTES, then the count starts over.
        const failed = row.totp_failed_count + 1;
        if (failed >= MAX_FAILED_CODES) {
          lockedNow = true;
          await tx.query(
            `UPDATE admin_users SET totp_failed_count = 0, totp_locked_until = now() + ($2::text || ' minutes')::interval WHERE user_id = $1`,
            [userId, String(LOCK_MINUTES)],
          );
        } else {
          await tx.query(`UPDATE admin_users SET totp_failed_count = $2 WHERE user_id = $1`, [userId, failed]);
        }
        return { status: 400, code: 'ADMIN_2FA_INVALID_CODE', message: 'Wrong code. Check the time on your phone and try again.' };
      }
      await tx.query(
        `UPDATE admin_users SET totp_last_step = $2, totp_failed_count = 0, totp_locked_until = NULL,
                totp_enabled_at = COALESCE(totp_enabled_at, now()), updated_at = now()
          WHERE user_id = $1`,
        [userId, step],
      );
      await tx.query(`UPDATE user_sessions SET admin_2fa_at = now() WHERE id = $1 AND user_id = $2`, [req.auth!.sessionId, userId]);
      return null;
    });
    if (outcome) {
      await audit(db, userId, mode === 'enable' ? 'admin.2fa.enable_failed' : 'admin.login.2fa_failed', userId, { code: outcome.code });
      if (lockedNow) {
        alertAdminEvent(db, userId, 'Admin 2FA locked after 5 wrong codes', [['IP', req.ip], ['Note', 'Someone may have this admin password.']]);
      }
      return fail(res, outcome.status, outcome.code, outcome.message);
    }
    await audit(db, userId, mode === 'enable' ? 'admin.2fa.enable' : 'admin.login', userId, {});
    alertAdminEvent(db, userId, mode === 'enable' ? 'Admin set up 2FA and signed in' : 'Admin signed in', [
      ['Role', req.admin!.role], ['IP', req.ip], ['Browser', String(req.headers['user-agent'] ?? '').slice(0, 120)],
    ]);
    res.json({ ok: true, data: { verified: true } });
  }

  router.post('/2fa/enable', ...guard, (req, res) => checkCode(req as AdminRequest, res, 'enable'));
  router.post('/2fa/verify', ...guard, (req, res) => checkCode(req as AdminRequest, res, 'verify'));

  // ---- Team (Owner only) ---------------------------------------------------

  router.get('/team', ...guard, async (req, res) => {
    const rows = (await dbOf(req).query(
      `SELECT au.user_id AS "userId", u.phone_e164 AS phone, p.display_name AS "displayName",
              ar.code AS role, au.status, (au.totp_enabled_at IS NOT NULL) AS "totpEnabled",
              au.created_at AS "addedAt",
              (SELECT max(created_at) FROM audit_events e WHERE e.actor_user_id = au.user_id) AS "lastActiveAt"
         FROM admin_users au
         JOIN admin_roles ar ON ar.id = au.role_id
         JOIN users u ON u.id = au.user_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
        ORDER BY (ar.code = 'super_admin') DESC, au.created_at`,
    )).rows;
    res.json({ ok: true, data: rows.map((r: any) => ({ ...r, roleLabel: ROLE_LABELS[r.role] ?? r.role })) });
  });

  const addSchema = z.object({ phone: z.string().min(10).max(20), role: z.enum(TEAM_ROLES) });

  router.post('/team', ...guard, async (req: AdminRequest, res) => {
    const parsed = addSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'INVALID_INPUT', 'Enter a phone number and choose a role.');
    const db = dbOf(req);
    const phone = normalizePhone(parsed.data.phone);
    const user = (await db.query<{ id: string }>(`SELECT id FROM users WHERE phone_e164 = $1`, [phone])).rows[0];
    if (!user) return fail(res, 404, 'USER_NOT_FOUND', 'No account with this number. Ask them to sign up in the app first.');
    if (user.id === req.admin!.userId) return fail(res, 400, 'CANNOT_CHANGE_SELF', 'You cannot change your own access.');
    const existing = (await db.query<{ role: string }>(
      `SELECT ar.code AS role FROM admin_users au JOIN admin_roles ar ON ar.id = au.role_id WHERE au.user_id = $1`, [user.id],
    )).rows[0];
    if (existing?.role === 'super_admin') return fail(res, 400, 'CANNOT_CHANGE_OWNER', 'Owner accounts cannot be changed here.');
    try {
      await db.query(
        `INSERT INTO admin_users (user_id, role_id, status, added_by)
         SELECT $1, id, 'active', $3 FROM admin_roles WHERE code = $2
         ON CONFLICT (user_id) DO UPDATE SET role_id = EXCLUDED.role_id, status = 'active', updated_at = now()`,
        [user.id, parsed.data.role, req.admin!.userId],
      );
    } catch (err) {
      if (String((err as Error).message).includes('N5_ADMIN_OPERATOR_LIMIT_REACHED')) {
        return fail(res, 409, 'TEAM_LIMIT_REACHED', 'The team already has 10 active members. Suspend someone first.');
      }
      throw err;
    }
    await audit(db, req.admin!.userId, 'admin.team.add', user.id, { phone, role: parsed.data.role });
    alertAdminEvent(db, req.admin!.userId, 'Team member added', [['New member', phone], ['Role', parsed.data.role]]);
    res.status(201).json({ ok: true, data: { userId: user.id, phone, role: parsed.data.role } });
  });

  const updateSchema = z.object({ role: z.enum(TEAM_ROLES).optional(), status: z.enum(['active', 'suspended']).optional() })
    .refine((v) => v.role || v.status);

  /** Loads a team member the Owner may change, or answers with the reason they can't. */
  async function changeableMember(req: AdminRequest, res: Response) {
    const userId = String(req.params.userId);
    if (!/^[0-9a-f-]{36}$/i.test(userId)) { fail(res, 400, 'INVALID_USER', 'Unknown team member.'); return null; }
    if (userId === req.admin!.userId) { fail(res, 400, 'CANNOT_CHANGE_SELF', 'You cannot change your own access.'); return null; }
    const row = (await dbOf(req).query<{ role: string }>(
      `SELECT ar.code AS role FROM admin_users au JOIN admin_roles ar ON ar.id = au.role_id WHERE au.user_id = $1`, [userId],
    )).rows[0];
    if (!row) { fail(res, 404, 'NOT_A_TEAM_MEMBER', 'Not a team member.'); return null; }
    if (row.role === 'super_admin') { fail(res, 400, 'CANNOT_CHANGE_OWNER', 'Owner accounts cannot be changed here.'); return null; }
    return userId;
  }

  router.patch('/team/:userId', ...guard, async (req: AdminRequest, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'INVALID_INPUT', 'Choose a role or status.');
    const userId = await changeableMember(req, res);
    if (!userId) return;
    const db = dbOf(req);
    try {
      if (parsed.data.role) {
        await db.query(
          `UPDATE admin_users SET role_id = (SELECT id FROM admin_roles WHERE code = $2), updated_at = now() WHERE user_id = $1`,
          [userId, parsed.data.role],
        );
      }
      if (parsed.data.status) {
        await db.query(`UPDATE admin_users SET status = $2, updated_at = now() WHERE user_id = $1`, [userId, parsed.data.status]);
      }
    } catch (err) {
      if (String((err as Error).message).includes('N5_ADMIN_OPERATOR_LIMIT_REACHED')) {
        return fail(res, 409, 'TEAM_LIMIT_REACHED', 'The team already has 10 active members. Suspend someone first.');
      }
      throw err;
    }
    // A suspended member's open admin sessions must pass 2FA again if restored.
    if (parsed.data.status === 'suspended') {
      await db.query(`UPDATE user_sessions SET admin_2fa_at = NULL WHERE user_id = $1`, [userId]);
    }
    await audit(db, req.admin!.userId, 'admin.team.update', userId, parsed.data);
    alertAdminEvent(db, req.admin!.userId, 'Team member changed', [['Member', userId], ['Change', JSON.stringify(parsed.data)]]);
    res.json({ ok: true, data: { userId, ...parsed.data } });
  });

  router.post('/team/:userId/reset-2fa', ...guard, async (req: AdminRequest, res) => {
    const userId = await changeableMember(req, res);
    if (!userId) return;
    const db = dbOf(req);
    await db.query(
      `UPDATE admin_users SET totp_secret_enc = NULL, totp_enabled_at = NULL, totp_last_step = NULL,
              totp_failed_count = 0, totp_locked_until = NULL, updated_at = now()
        WHERE user_id = $1`,
      [userId],
    );
    await db.query(`UPDATE user_sessions SET admin_2fa_at = NULL WHERE user_id = $1`, [userId]);
    await audit(db, req.admin!.userId, 'admin.team.reset_2fa', userId, {});
    alertAdminEvent(db, req.admin!.userId, 'Team member 2FA reset', [['Member', userId]]);
    res.json({ ok: true, data: { userId } });
  });

  // ---- Activity log (Owner only) --------------------------------------------

  router.get('/audit', ...guard, async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    const rows = (await dbOf(req).query(
      `SELECT e.created_at AS "createdAt", e.action, e.entity_type AS "entityType", e.entity_id AS "entityId",
              e.metadata, u.phone_e164 AS "actorPhone", p.display_name AS "actorName"
         FROM audit_events e
         LEFT JOIN users u ON u.id = e.actor_user_id
         LEFT JOIN user_profiles p ON p.user_id = e.actor_user_id
        WHERE e.action LIKE 'admin.%'
        ORDER BY e.created_at DESC
        LIMIT $1`,
      [limit],
    )).rows;
    res.json({ ok: true, data: rows });
  });

  // Express 4 does not catch rejected promises: send them to the error handler.
  for (const layer of router.stack as any[]) {
    for (const l of layer.route?.stack ?? []) {
      const fn = l.handle;
      l.handle = (req: Request, res: Response, next: (err?: unknown) => void) => {
        try {
          const out = fn(req, res, next);
          if (out && typeof out.catch === 'function') out.catch(next);
        } catch (err) {
          next(err);
        }
      };
    }
  }
  return router;
}
