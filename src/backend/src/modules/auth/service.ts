import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { signAccessToken, signRefreshToken, verifyRefresh } from '../../utils/tokens.js';
import type { DatabaseClient } from '../../core/database/database.types.js';

// Wrong passwords allowed before the account is locked; once reached, every
// further wrong password locks it again until a successful login resets the count.
const LOGIN_FREE_ATTEMPTS = 3;
const LOGIN_LOCK_SECONDS = 60;

// Compared against when no account matches, so login timing does not reveal registered numbers.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('n5-dummy-password-for-timing', 10);

export class LoginLockedError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('LOGIN_LOCKED');
  }
}

export class InvalidCredentialsError extends Error {
  constructor(public readonly attemptsLeft?: number) {
    super('INVALID_CREDENTIALS');
  }
}

export function normalizePhone(p: string): string {
  let clean = p.replace(/[^\d]/g, '');
  if (clean.startsWith('03')) {
    clean = '92' + clean.slice(1);
  } else if (clean.startsWith('3') && clean.length === 10) {
    clean = '92' + clean;
  }
  return clean ? `+${clean}` : p.trim();
}

export function hashToken(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export async function register(input: { phone: string; dob: string; password: string; referralCode?: string }, db: DatabaseClient) {
  const phone = normalizePhone(input.phone);
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  try {
    return await db.transaction(async (tx) => {
      const existing = await tx.query<{ id: string }>('SELECT id FROM users WHERE phone_e164 = $1', [phone]);
      if (existing.rows[0]) throw new Error('PHONE_ALREADY_REGISTERED');

      const created = await tx.query<{ id: string }>(
        `INSERT INTO users (phone_e164, date_of_birth, password_hash, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING id`,
        [phone, input.dob, passwordHash],
      );
      const userId = created.rows[0].id;
      const referralCode = input.referralCode?.trim().toUpperCase();
      if (referralCode) {
        const inviter = (await tx.query<{ user_id: string }>(
          `SELECT user_id FROM referral_codes WHERE upper(code) = $1 AND status = 'active'`,
          [referralCode],
        )).rows[0];
        if (!inviter) throw new Error('INVALID_REFERRAL_CODE');
        await tx.query(
          `INSERT INTO referrals (inviter_user_id, invited_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [inviter.user_id, userId],
        );
      }
      await tx.query(
        `INSERT INTO user_profiles (user_id, display_name, language_code)
         VALUES ($1, $2, 'en')
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, phone],
      );
      await tx.query(
        `INSERT INTO wallet_accounts (user_id, currency, available_minor, bonus_minor, locked_minor)
         VALUES ($1, 'PKR', 0, 0, 0)
         ON CONFLICT (user_id, currency) DO NOTHING`,
        [userId],
      );
      // Signing up logs the player straight in.
      return { userId, ...(await createSession(userId, tx)) };
    });
  } catch (err: any) {
    // A concurrent registration of the same number loses on the users.phone_e164 unique constraint.
    if (err?.code === '23505') throw new Error('PHONE_ALREADY_REGISTERED');
    throw err;
  }
}

type LoginRow = { id: string; password_hash: string; status: string; failed_login_count: number; lock_seconds: number };

export async function login(phone: string, password: string, db: DatabaseClient) {
  const outcome = await db.transaction(async (tx) => {
    // The row lock serialises attempts on one account, so parallel guesses cannot skip the counter.
    const user = (await tx.query<LoginRow>(
      `SELECT id, password_hash, status, failed_login_count,
              GREATEST(0, CEIL(EXTRACT(EPOCH FROM (login_locked_until - now()))))::int AS lock_seconds
         FROM users WHERE phone_e164 = $1 FOR UPDATE`,
      [normalizePhone(phone)],
    )).rows[0];

    if (!user) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return { error: new InvalidCredentialsError() };
    }
    if (user.lock_seconds > 0) return { error: new LoginLockedError(user.lock_seconds) };

    if (!(await bcrypt.compare(password, user.password_hash))) {
      const failures = user.failed_login_count + 1;
      const lock = failures >= LOGIN_FREE_ATTEMPTS;
      await tx.query(
        `UPDATE users
            SET failed_login_count = $2,
                login_locked_until = CASE WHEN $3 THEN now() + ($4::text || ' seconds')::interval ELSE login_locked_until END
          WHERE id = $1`,
        [user.id, failures, lock, String(LOGIN_LOCK_SECONDS)],
      );
      return { error: lock ? new LoginLockedError(LOGIN_LOCK_SECONDS) : new InvalidCredentialsError(LOGIN_FREE_ATTEMPTS - failures) };
    }

    if (user.status !== 'active') return { error: new InvalidCredentialsError() };
    await tx.query('UPDATE users SET failed_login_count = 0, login_locked_until = NULL WHERE id = $1', [user.id]);
    return { session: await createSession(user.id, tx) };
  });
  // Thrown after the transaction so the failure counter is committed.
  if ('error' in outcome) throw outcome.error;
  return outcome.session;
}

/**
 * Changes the password after checking the current one, and signs out every
 * other session so a stolen session cannot outlive the change.
 */
export async function changePassword(userId: string, sessionId: string, currentPassword: string, newPassword: string, db: DatabaseClient) {
  const user = (await db.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [userId])).rows[0];
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) throw new InvalidCredentialsError();
  const hash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await db.transaction(async (tx) => {
    await tx.query('UPDATE users SET password_hash = $2, failed_login_count = 0, login_locked_until = NULL, updated_at = now() WHERE id = $1', [userId, hash]);
    await tx.query('UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL', [userId, sessionId]);
  });
}

export async function refresh(refreshToken: string, db: DatabaseClient) {
  const claims = verifyRefresh(refreshToken);
  return db.transaction(async (tx) => {
    const s = (await tx.query<{ user_id: string; refresh_token_hash: string; revoked_at: string | null; expired: boolean }>(
      `SELECT user_id, refresh_token_hash, revoked_at, (expires_at <= now()) AS expired
         FROM user_sessions WHERE id = $1 FOR UPDATE`,
      [claims.sid],
    )).rows[0];
    if (!s || s.user_id !== claims.sub || s.revoked_at || s.expired || !safeEqualHex(hashToken(refreshToken), s.refresh_token_hash)) {
      throw new Error('REFRESH_REVOKED');
    }
    const user = (await tx.query<{ status: string }>('SELECT status FROM users WHERE id = $1', [claims.sub])).rows[0];
    if (!user || user.status !== 'active') throw new Error('REFRESH_REVOKED');

    // Rotation: the old refresh token is revoked in the same transaction that issues the new one.
    await tx.query('UPDATE user_sessions SET revoked_at = now() WHERE id = $1', [claims.sid]);
    return createSession(claims.sub, tx);
  });
}

export async function logout(sessionId: string, db: DatabaseClient) {
  await db.query('UPDATE user_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [sessionId]);
}

export async function createSession(userId: string, db: DatabaseClient) {
  const sid = crypto.randomUUID();
  const access = signAccessToken(userId, sid);
  const refreshToken = signRefreshToken(userId, sid);

  await db.query(
    `INSERT INTO user_sessions (id, user_id, refresh_token_hash, expires_at, created_at)
     VALUES ($1, $2, $3, now() + ($4::text || ' days')::interval, now())`,
    [sid, userId, hashToken(refreshToken), String(env.REFRESH_TOKEN_DAYS)],
  );
  const user = (await db.query<{ status: string }>('SELECT status FROM users WHERE id = $1', [userId])).rows[0];

  return {
    accessToken: access,
    refreshToken,
    expiresIn: env.ACCESS_TOKEN_MINUTES * 60,
    user: { id: userId, status: user?.status ?? 'active' },
  };
}
