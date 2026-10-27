import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { signAccessToken, signRefreshToken, verifyRefresh } from '../../utils/tokens.js';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { sendOtpSms } from './sms-provider.service.js';
import { WhatsappGatewayService } from './whatsapp-gateway.service.js';

const OTP_TTL_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_PHONE_WINDOW = 3;
const OTP_RATE_WINDOW_MINUTES = 10;
const INBOUND_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INBOUND_TOKEN_LENGTH = 10;

// Compared against when no account matches, so login timing does not reveal registered numbers.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('n5-dummy-password-for-timing', 10);

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

function hashOtpCode(challengeId: string, code: string): string {
  return hashToken(`${challengeId}:${code}`);
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function generateInboundToken(): string {
  let token = '';
  for (let i = 0; i < INBOUND_TOKEN_LENGTH; i++) {
    token += INBOUND_TOKEN_ALPHABET[crypto.randomInt(INBOUND_TOKEN_ALPHABET.length)];
  }
  return token;
}

type UserRow = { id: string; phone_e164: string; password_hash: string; phone_verified_at: string | null; status: string };

async function findUserByPhone(db: DatabaseClient, phone: string): Promise<UserRow | undefined> {
  const r = await db.query<UserRow>(
    'SELECT id, phone_e164, password_hash, phone_verified_at, status FROM users WHERE phone_e164 = $1',
    [phone],
  );
  return r.rows[0];
}

export async function register(input: { phone: string; dob: string; password: string }, db: DatabaseClient) {
  const phone = normalizePhone(input.phone);
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  try {
    await db.transaction(async (tx) => {
      const existing = await tx.query<{ id: string }>('SELECT id FROM users WHERE phone_e164 = $1', [phone]);
      if (existing.rows[0]) throw new Error('PHONE_ALREADY_REGISTERED');

      const created = await tx.query<{ id: string }>(
        `INSERT INTO users (phone_e164, date_of_birth, password_hash, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING id`,
        [phone, input.dob, passwordHash],
      );
      const userId = created.rows[0].id;
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
    });
  } catch (err: any) {
    // A concurrent registration of the same number loses on the users.phone_e164 unique constraint.
    if (err?.code === '23505') throw new Error('PHONE_ALREADY_REGISTERED');
    throw err;
  }

  const user = await findUserByPhone(db, phone);
  const otp = await requestOtp(phone, db);
  return { userId: user!.id, challengeId: otp.challengeId, antiBanLink: otp.antiBanLink };
}

export async function requestOtp(phone: string, db: DatabaseClient) {
  const normalizedPhone = normalizePhone(phone);

  const recent = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM auth_otp_challenges
      WHERE phone_e164 = $1 AND created_at > now() - ($2::text || ' minutes')::interval`,
    [normalizedPhone, String(OTP_RATE_WINDOW_MINUTES)],
  );
  if (Number(recent.rows[0]?.count ?? 0) >= OTP_MAX_PER_PHONE_WINDOW) throw new Error('OTP_RATE_LIMITED');

  const challengeId = crypto.randomUUID();
  const code = String(crypto.randomInt(100000, 1000000));
  const inboundToken = generateInboundToken();
  await db.query(
    `INSERT INTO auth_otp_challenges (id, phone_e164, code_hash, inbound_token_hash, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5::text || ' minutes')::interval)`,
    [challengeId, normalizedPhone, hashOtpCode(challengeId, code), hashToken(inboundToken), String(OTP_TTL_MINUTES)],
  );

  const channel = (env.OTP_CHANNEL || 'both').toLowerCase();
  let dispatchSuccess = true;
  let activeProvider = 'hybrid_whatsapp_sms';
  let antiBanLink: string | undefined;

  if (channel === 'whatsapp' || channel === 'both') {
    const waResult = await WhatsappGatewayService.sendOtp(normalizedPhone, code, inboundToken);
    dispatchSuccess = waResult.success;
    antiBanLink = waResult.antiBanLink;
  }

  if (channel === 'sms' || channel === 'both') {
    const smsResult = await sendOtpSms(normalizedPhone, code);
    if (channel === 'sms') {
      dispatchSuccess = smsResult.success;
      activeProvider = smsResult.provider;
    }
  }

  return {
    challengeId,
    channel,
    antiBanLink,
    smsSent: dispatchSuccess,
    provider: activeProvider,
    cost: channel === 'whatsapp' ? 'Rs 0.00 PKR (100% Free)' : (channel === 'sms' ? '~Rs 0.80 PKR / SMS' : 'Hybrid (Free WhatsApp + SMS fallback)'),
  };
}

type ChallengeRow = {
  id: string;
  phone_e164: string;
  code_hash: string;
  attempts: number;
  verified_at: string | null;
  verified_via: string | null;
  consumed_at: string | null;
  expired: boolean;
};

const CHALLENGE_COLUMNS = 'id, phone_e164, code_hash, attempts, verified_at, verified_via, consumed_at, (expires_at <= now()) AS expired';

/**
 * Marks the player's phone verified and opens a session. The challenge is
 * consumed in the same transaction, so one verification yields one session.
 */
async function completeVerification(tx: DatabaseClient, challenge: ChallengeRow) {
  const user = await findUserByPhone(tx, challenge.phone_e164);
  if (!user) throw new Error('ACCOUNT_NOT_FOUND');
  if (user.status !== 'active') throw new Error('ACCOUNT_RESTRICTED');
  await tx.query('UPDATE auth_otp_challenges SET consumed_at = now() WHERE id = $1', [challenge.id]);
  await tx.query('UPDATE users SET phone_verified_at = COALESCE(phone_verified_at, now()), updated_at = now() WHERE id = $1', [user.id]);
  return createSession(user.id, tx);
}

export async function verifyOtp(challengeId: string, code: string, db: DatabaseClient) {
  const outcome = await db.transaction(async (tx) => {
    const c = (await tx.query<ChallengeRow>(
      `SELECT ${CHALLENGE_COLUMNS} FROM auth_otp_challenges WHERE id = $1 FOR UPDATE`,
      [challengeId],
    )).rows[0];
    if (!c || c.expired) return { error: 'OTP_EXPIRED' };
    if (c.consumed_at) return { error: 'OTP_ALREADY_USED' };
    if (c.attempts >= OTP_MAX_ATTEMPTS) return { error: 'OTP_ATTEMPTS_EXCEEDED' };

    // The attempt is counted (and committed) before the code is compared.
    await tx.query('UPDATE auth_otp_challenges SET attempts = attempts + 1 WHERE id = $1', [c.id]);
    if (!safeEqualHex(hashOtpCode(c.id, code), c.code_hash)) return { error: 'OTP_INVALID' };

    await tx.query(
      `UPDATE auth_otp_challenges SET verified_at = COALESCE(verified_at, now()), verified_via = COALESCE(verified_via, 'code') WHERE id = $1`,
      [c.id],
    );
    return { session: await completeVerification(tx, c) };
  });
  if ('error' in outcome) throw new Error(outcome.error);
  return outcome.session;
}

/**
 * Polled by the app while the player completes the WhatsApp deep-link flow.
 * Issues the session once, after an authenticated inbound message from the
 * challenge phone has verified the challenge.
 */
export async function checkOtpStatus(challengeId: string, db: DatabaseClient) {
  return db.transaction(async (tx) => {
    const c = (await tx.query<ChallengeRow>(
      `SELECT ${CHALLENGE_COLUMNS} FROM auth_otp_challenges WHERE id = $1 FOR UPDATE`,
      [challengeId],
    )).rows[0];
    if (!c) throw new Error('OTP_EXPIRED');
    if (c.consumed_at) throw new Error('OTP_ALREADY_USED');
    if (!c.verified_at) {
      if (c.expired) throw new Error('OTP_EXPIRED');
      return { verified: false };
    }
    return { verified: true, session: await completeVerification(tx, c) };
  });
}

/**
 * Handles a WhatsApp message the player sent from their own number via the deep link.
 * The caller must already have authenticated the gateway (shared webhook secret).
 */
export async function handleInboundWhatsAppVerification(fromPhone: string, text: string, db: DatabaseClient) {
  const match = text.toUpperCase().match(/VERIFY_N5_([A-Z0-9]{10})\b/);
  if (!match) return { success: false, error: 'NO_VERIFICATION_TOKEN_FOUND' };

  const result = await db.transaction(async (tx) => {
    const c = (await tx.query<ChallengeRow>(
      `SELECT ${CHALLENGE_COLUMNS} FROM auth_otp_challenges WHERE inbound_token_hash = $1 FOR UPDATE`,
      [hashToken(match[1])],
    )).rows[0];
    if (!c) return { success: false, error: 'CHALLENGE_NOT_FOUND' };
    if (c.expired || c.consumed_at) return { success: false, error: 'OTP_EXPIRED' };
    // Possession of the token is not enough: it must arrive from the phone being verified.
    if (normalizePhone(fromPhone) !== c.phone_e164) return { success: false, error: 'SENDER_PHONE_MISMATCH' };
    if (!c.verified_at) {
      await tx.query(
        `UPDATE auth_otp_challenges SET verified_at = now(), verified_via = 'whatsapp_inbound' WHERE id = $1`,
        [c.id],
      );
    }
    return { success: true, challengeId: c.id, phone: c.phone_e164, verified: true };
  });

  WhatsappGatewayService.recordInbound(fromPhone, result.success);
  return result;
}

export async function login(phone: string, password: string, db: DatabaseClient) {
  const user = await findUserByPhone(db, normalizePhone(phone));
  const passwordOk = await bcrypt.compare(password, user?.password_hash || DUMMY_PASSWORD_HASH);
  if (!user || !passwordOk || user.status !== 'active') throw new Error('INVALID_CREDENTIALS');
  if (!user.phone_verified_at) throw new Error('PHONE_NOT_VERIFIED');
  return createSession(user.id, db);
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
