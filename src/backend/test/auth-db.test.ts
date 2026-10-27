import { describe, expect, it, beforeAll, afterAll, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createDatabaseClient, type ConnectedDatabaseClient } from '../src/core/database/postgres.client.js';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import * as auth from '../src/modules/auth/service.js';
import { WhatsappGatewayService } from '../src/modules/auth/whatsapp-gateway.service.js';
import { signAccessToken } from '../src/utils/tokens.js';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testSecret123@localhost:54328/n5_idempotency_test';
const INBOUND_SECRET = 'test-inbound-secret-0123456789';

const randomPhone = () => `+92300${crypto.randomInt(1000000, 9999999)}`;
const localPhone = (e164: string) => `0${e164.slice(3)}`;

/** Requests an OTP and captures the code and link token handed to the WhatsApp gateway. */
async function requestOtpCapturing(db: ConnectedDatabaseClient, phone: string) {
  const spy = vi.spyOn(WhatsappGatewayService, 'sendOtp');
  const otp = await auth.requestOtp(phone, db);
  const [, code, inboundToken] = spy.mock.calls[spy.mock.calls.length - 1] as [string, string, string];
  spy.mockRestore();
  return { ...otp, code, inboundToken };
}

describe('Auth persistence (PostgreSQL only, no in-memory fallback)', () => {
  let db: ConnectedDatabaseClient | undefined;
  let server: Server;
  let baseUrl = '';
  const saved = { channel: env.OTP_CHANNEL, inbound: env.WHATSAPP_INBOUND_SECRET };

  beforeAll(async () => {
    const candidate = createDatabaseClient(TEST_DB_URL);
    try {
      await candidate.query('SELECT 1 FROM auth_otp_challenges LIMIT 0');
      db = candidate;
    } catch {
      await candidate.close().catch(() => {});
      console.info(`[INFO] Migrated PostgreSQL test database not available at ${TEST_DB_URL}. Skipping auth DB tests.`);
      return;
    }
    env.OTP_CHANNEL = 'whatsapp';
    env.WHATSAPP_INBOUND_SECRET = INBOUND_SECRET;
    server = createApp(db).listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  });

  afterAll(async () => {
    env.OTP_CHANNEL = saved.channel;
    env.WHATSAPP_INBOUND_SECRET = saved.inbound;
    if (server) await new Promise((resolve) => server.close(resolve));
    await db?.close();
  });

  afterEach(() => vi.restoreAllMocks());

  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const getMe = (token: string) => fetch(`${baseUrl}/users/me`, { headers: { authorization: `Bearer ${token}` } });

  it('registers user, profile and wallet atomically and rejects a duplicate number', async (ctx) => {
    if (!db) return ctx.skip();
    const phone = randomPhone();
    const reg = await auth.register({ phone: localPhone(phone), dob: '1995-05-05', password: 'Password-123' }, db);

    const row = (await db.query<{ phone_e164: string; profiles: string; wallets: string; verified: string | null }>(
      `SELECT u.phone_e164, (SELECT count(*) FROM user_profiles WHERE user_id = u.id)::text AS profiles,
              (SELECT count(*) FROM wallet_accounts WHERE user_id = u.id)::text AS wallets, u.phone_verified_at AS verified
         FROM users u WHERE u.id = $1`, [reg.userId])).rows[0];
    expect(row).toMatchObject({ phone_e164: phone, profiles: '1', wallets: '1', verified: null });

    await expect(auth.register({ phone, dob: '1995-05-05', password: 'Password-123' }, db)).rejects.toThrow('PHONE_ALREADY_REGISTERED');
  });

  it('never exposes the typed OTP code in the WhatsApp link', async (ctx) => {
    if (!db) return ctx.skip();
    const otp = await requestOtpCapturing(db, randomPhone());
    expect(otp.antiBanLink).toContain(`VERIFY_N5_${otp.inboundToken}`);
    expect(otp.antiBanLink).not.toContain(otp.code);
    // The link token is not accepted as the typed code.
    await expect(auth.verifyOtp(otp.challengeId, otp.inboundToken, db)).rejects.toThrow('OTP_INVALID');
  });

  it('verifies the typed code once, counts failed attempts and locks after five', async (ctx) => {
    if (!db) return ctx.skip();
    const phone = randomPhone();
    await auth.register({ phone, dob: '1990-01-01', password: 'Password-123' }, db);

    const locked = await requestOtpCapturing(db, phone);
    for (let i = 0; i < 5; i++) {
      await expect(auth.verifyOtp(locked.challengeId, '000000' === locked.code ? '111111' : '000000', db)).rejects.toThrow('OTP_INVALID');
    }
    await expect(auth.verifyOtp(locked.challengeId, locked.code, db)).rejects.toThrow('OTP_ATTEMPTS_EXCEEDED');

    const otp = await requestOtpCapturing(db, phone);
    const session = await auth.verifyOtp(otp.challengeId, otp.code, db);
    expect(session.accessToken).toBeTruthy();
    expect((await getMe(session.accessToken)).status).toBe(200);
    await expect(auth.verifyOtp(otp.challengeId, otp.code, db)).rejects.toThrow('OTP_ALREADY_USED');
  });

  it('rate-limits OTP requests per phone number', async (ctx) => {
    if (!db) return ctx.skip();
    const phone = randomPhone();
    for (let i = 0; i < 3; i++) await requestOtpCapturing(db, phone);
    await expect(auth.requestOtp(phone, db)).rejects.toThrow('OTP_RATE_LIMITED');
  });

  it('does not create an account when verifying an OTP for an unregistered number', async (ctx) => {
    if (!db) return ctx.skip();
    const phone = randomPhone();
    const otp = await requestOtpCapturing(db, phone);
    await expect(auth.verifyOtp(otp.challengeId, otp.code, db)).rejects.toThrow('ACCOUNT_NOT_FOUND');
    expect((await db.query('SELECT id FROM users WHERE phone_e164 = $1', [phone])).rows.length).toBe(0);
  });

  it('WhatsApp inbound: requires the gateway secret and a message from the challenge phone', async (ctx) => {
    if (!db) return ctx.skip();
    const phone = randomPhone();
    await auth.register({ phone, dob: '1990-01-01', password: 'Password-123' }, db);
    const otp = await requestOtpCapturing(db, phone);
    const message = { from: phone.slice(1), message: `VERIFY_N5_${otp.inboundToken}` };

    expect((await post('/auth/whatsapp/inbound', message)).status).toBe(401);
    expect((await post('/auth/whatsapp/inbound', message, { 'x-webhook-secret': 'wrong-secret-0123456789xx' })).status).toBe(401);

    const spoofed = await post('/auth/whatsapp/inbound', { ...message, from: randomPhone() }, { 'x-webhook-secret': INBOUND_SECRET });
    expect(await spoofed.json()).toMatchObject({ success: false, error: 'SENDER_PHONE_MISMATCH' });
    expect(await auth.checkOtpStatus(otp.challengeId, db)).toEqual({ verified: false });

    const ok = await post('/auth/whatsapp/inbound', message, { 'x-webhook-secret': INBOUND_SECRET });
    expect(await ok.json()).toMatchObject({ success: true, verified: true });

    // The poll issues exactly one session.
    const status = await fetch(`${baseUrl}/auth/otp/status?challengeId=${otp.challengeId}`);
    const body = await status.json() as any;
    expect(body.verified).toBe(true);
    expect((await getMe(body.session.accessToken)).status).toBe(200);
    expect((await fetch(`${baseUrl}/auth/otp/status?challengeId=${otp.challengeId}`)).status).toBe(409);
  });

  it('removes the click-only WhatsApp verification endpoint', async (ctx) => {
    if (!db) return ctx.skip();
    const otp = await requestOtpCapturing(db, randomPhone());
    expect((await post('/auth/whatsapp/verify-click', { challengeId: otp.challengeId })).status).toBe(404);
  });

  it('login: no auto-created accounts, verified phone required, wrong password rejected', async (ctx) => {
    if (!db) return ctx.skip();
    const unknown = randomPhone();
    await expect(auth.login(unknown, 'Password-123', db)).rejects.toThrow('INVALID_CREDENTIALS');
    expect((await db.query('SELECT id FROM users WHERE phone_e164 = $1', [unknown])).rows.length).toBe(0);

    const phone = randomPhone();
    await auth.register({ phone, dob: '1990-01-01', password: 'Password-123' }, db);
    await expect(auth.login(phone, 'Password-123', db)).rejects.toThrow('PHONE_NOT_VERIFIED');

    await db.query('UPDATE users SET phone_verified_at = now() WHERE phone_e164 = $1', [phone]);
    await expect(auth.login(phone, 'Wrong-Password', db)).rejects.toThrow('INVALID_CREDENTIALS');
    const session = await auth.login(localPhone(phone), 'Password-123', db);
    expect((await getMe(session.accessToken)).status).toBe(200);

    await db.query(`UPDATE users SET status = 'suspended' WHERE phone_e164 = $1`, [phone]);
    await expect(auth.login(phone, 'Password-123', db)).rejects.toThrow('INVALID_CREDENTIALS');
    expect((await getMe(session.accessToken)).status).toBe(401);
  });

  it('requireAuth rejects unknown, revoked and expired sessions (no dev fallback)', async (ctx) => {
    if (!db) return ctx.skip();
    const phone = randomPhone();
    const reg = await auth.register({ phone, dob: '1990-01-01', password: 'Password-123' }, db);
    await db.query('UPDATE users SET phone_verified_at = now() WHERE id = $1', [reg.userId]);

    // Validly signed token whose session does not exist (previously auto-created outside production).
    expect((await getMe(signAccessToken(reg.userId, crypto.randomUUID()))).status).toBe(401);

    const loggedOut = await auth.login(phone, 'Password-123', db);
    expect((await post('/auth/logout', {}, { authorization: `Bearer ${loggedOut.accessToken}` })).status).toBe(204);
    expect((await getMe(loggedOut.accessToken)).status).toBe(401);

    const expired = await auth.login(phone, 'Password-123', db);
    await db.query(`UPDATE user_sessions SET expires_at = now() - interval '1 minute' WHERE user_id = $1 AND revoked_at IS NULL`, [reg.userId]);
    expect((await getMe(expired.accessToken)).status).toBe(401);
  });

  it('refresh rotates the session and rejects a reused refresh token', async (ctx) => {
    if (!db) return ctx.skip();
    const phone = randomPhone();
    const reg = await auth.register({ phone, dob: '1990-01-01', password: 'Password-123' }, db);
    await db.query('UPDATE users SET phone_verified_at = now() WHERE id = $1', [reg.userId]);
    const first = await auth.login(phone, 'Password-123', db);

    const rotated = await auth.refresh(first.refreshToken, db);
    expect((await getMe(rotated.accessToken)).status).toBe(200);
    expect((await getMe(first.accessToken)).status).toBe(401);
    await expect(auth.refresh(first.refreshToken, db)).rejects.toThrow('REFRESH_REVOKED');
  });

  it('survives a restart: sessions and challenges live only in PostgreSQL', async (ctx) => {
    if (!db) return ctx.skip();
    const phone = randomPhone();
    const reg = await auth.register({ phone, dob: '1990-01-01', password: 'Password-123' }, db);
    await db.query('UPDATE users SET phone_verified_at = now() WHERE id = $1', [reg.userId]);
    const session = await auth.login(phone, 'Password-123', db);
    const otp = await requestOtpCapturing(db, phone);

    // A brand-new app instance (fresh process state) accepts the same token and challenge.
    const fresh = createApp(db).listen(0);
    try {
      const url = `http://127.0.0.1:${(fresh.address() as AddressInfo).port}/api/v1`;
      expect((await fetch(`${url}/users/me`, { headers: { authorization: `Bearer ${session.accessToken}` } })).status).toBe(200);
      const verify = await fetch(`${url}/auth/otp/verify`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challengeId: otp.challengeId, code: otp.code }),
      });
      expect(verify.status).toBe(200);
    } finally {
      await new Promise((resolve) => fresh.close(resolve));
    }
  });
});

describe('Auth without a configured database', () => {
  it('fails closed with 503 instead of using memory', async () => {
    const server = createApp().listen(0);
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
      const res = await fetch(`${url}/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: '03001234567', password: 'Password-123' }),
      });
      expect(res.status).toBe(503);
      expect((await res.json() as any).error).toBe('AUTH_STORE_UNAVAILABLE');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
