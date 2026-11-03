import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createDatabaseClient, type ConnectedDatabaseClient } from '../src/core/database/postgres.client.js';
import { createApp } from '../src/app.js';
import * as auth from '../src/modules/auth/service.js';
import { signAccessToken } from '../src/utils/tokens.js';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testSecret123@localhost:54328/n5_idempotency_test';

const randomPhone = () => `+92300${crypto.randomInt(1000000, 9999999)}`;
const localPhone = (e164: string) => `0${e164.slice(3)}`;

describe('Auth persistence (PostgreSQL only, no in-memory fallback)', () => {
  let db: ConnectedDatabaseClient | undefined;
  let server: Server;
  let baseUrl = '';

  beforeAll(async () => {
    const candidate = createDatabaseClient(TEST_DB_URL);
    try {
      await candidate.query('SELECT failed_login_count FROM users LIMIT 0');
      db = candidate;
    } catch {
      await candidate.close().catch(() => {});
      console.info(`[INFO] Migrated PostgreSQL test database not available at ${TEST_DB_URL}. Skipping auth DB tests.`);
      return;
    }
    server = createApp(db).listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  });

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await db?.close();
  });

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
    expect(row).toMatchObject({ phone_e164: phone, profiles: '1', wallets: '1' });
    // Signing up logs the player in without any verification step.
    expect((await getMe(reg.accessToken)).status).toBe(200);

    await expect(auth.register({ phone, dob: '1995-05-05', password: 'Password-123' }, db)).rejects.toThrow('PHONE_ALREADY_REGISTERED');
  });

  it('login: no auto-created accounts, wrong password and suspended accounts rejected', async (ctx) => {
    if (!db) return ctx.skip();
    const unknown = randomPhone();
    await expect(auth.login(unknown, 'Password-123', db)).rejects.toThrow('INVALID_CREDENTIALS');
    expect((await db.query('SELECT id FROM users WHERE phone_e164 = $1', [unknown])).rows.length).toBe(0);

    const phone = randomPhone();
    await auth.register({ phone, dob: '1990-01-01', password: 'Password-123' }, db);
    await expect(auth.login(phone, 'Wrong-Password', db)).rejects.toThrow('INVALID_CREDENTIALS');
    const session = await auth.login(localPhone(phone), 'Password-123', db);
    expect((await getMe(session.accessToken)).status).toBe(200);

    await db.query(`UPDATE users SET status = 'suspended' WHERE phone_e164 = $1`, [phone]);
    await expect(auth.login(phone, 'Password-123', db)).rejects.toThrow('INVALID_CREDENTIALS');
    expect((await getMe(session.accessToken)).status).toBe(401);
  });

  it('locks login for a minute after 3 wrong passwords, then after every further wrong password', async (ctx) => {
    if (!db) return ctx.skip();
    const phone = randomPhone();
    await auth.register({ phone, dob: '1990-01-01', password: 'Password-123' }, db);
    const unlock = () => db!.query(`UPDATE users SET login_locked_until = now() - interval '1 second' WHERE phone_e164 = $1`, [phone]);

    await expect(auth.login(phone, 'Wrong-Password', db)).rejects.toMatchObject({ message: 'INVALID_CREDENTIALS', attemptsLeft: 2 });
    await expect(auth.login(phone, 'Wrong-Password', db)).rejects.toMatchObject({ message: 'INVALID_CREDENTIALS', attemptsLeft: 1 });
    await expect(auth.login(phone, 'Wrong-Password', db)).rejects.toMatchObject({ message: 'LOGIN_LOCKED', retryAfterSeconds: 60 });
    // While locked even the right password is refused.
    await expect(auth.login(phone, 'Password-123', db)).rejects.toThrow('LOGIN_LOCKED');

    const res = await post('/auth/login', { phone, password: 'Password-123' });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await res.json()).toMatchObject({ error: 'LOGIN_LOCKED' });

    await unlock();
    await expect(auth.login(phone, 'Wrong-Password', db)).rejects.toThrow('LOGIN_LOCKED');

    await unlock();
    const session = await auth.login(phone, 'Password-123', db);
    expect((await getMe(session.accessToken)).status).toBe(200);
    // A successful login resets the counter.
    await expect(auth.login(phone, 'Wrong-Password', db)).rejects.toMatchObject({ message: 'INVALID_CREDENTIALS', attemptsLeft: 2 });
  });

  it('counts parallel wrong guesses without skipping the lock', async (ctx) => {
    if (!db) return ctx.skip();
    const phone = randomPhone();
    await auth.register({ phone, dob: '1990-01-01', password: 'Password-123' }, db);
    await Promise.allSettled(Array.from({ length: 6 }, () => auth.login(phone, 'Wrong-Password', db!)));
    const row = (await db.query<{ failed_login_count: number }>('SELECT failed_login_count FROM users WHERE phone_e164 = $1', [phone])).rows[0];
    expect(row.failed_login_count).toBe(3);
    await expect(auth.login(phone, 'Password-123', db)).rejects.toThrow('LOGIN_LOCKED');
  });

  it('requireAuth rejects unknown, revoked and expired sessions (no dev fallback)', async (ctx) => {
    if (!db) return ctx.skip();
    const phone = randomPhone();
    const reg = await auth.register({ phone, dob: '1990-01-01', password: 'Password-123' }, db);

    // Validly signed token whose session does not exist (previously auto-created outside production).
    expect((await getMe(signAccessToken(reg.userId, crypto.randomUUID()))).status).toBe(401);

    const loggedOut = await auth.login(phone, 'Password-123', db);
    expect((await post('/auth/logout', {}, { authorization: `Bearer ${loggedOut.accessToken}` })).status).toBe(204);
    expect((await getMe(loggedOut.accessToken)).status).toBe(401);

    const expired = await auth.login(phone, 'Password-123', db);
    await db.query(`UPDATE user_sessions SET expires_at = now() - interval '1 minute' WHERE user_id = $1 AND revoked_at IS NULL`, [reg.userId]);
    expect((await getMe(expired.accessToken)).status).toBe(401);
  });

  it('change-password checks the current password and signs out other sessions', async (ctx) => {
    if (!db) return ctx.skip();
    const phone = randomPhone();
    await auth.register({ phone, dob: '1990-01-01', password: 'Password-123' }, db);
    const other = await auth.login(phone, 'Password-123', db);
    const current = await auth.login(phone, 'Password-123', db);
    const change = (body: unknown) => post('/auth/change-password', body, { authorization: `Bearer ${current.accessToken}` });

    expect((await change({ currentPassword: 'Wrong-Password', newPassword: 'New-Password-1' })).status).toBe(400);
    expect((await change({ currentPassword: 'Password-123', newPassword: 'New-Password-1' })).status).toBe(204);

    expect((await getMe(current.accessToken)).status).toBe(200);
    expect((await getMe(other.accessToken)).status).toBe(401);
    await expect(auth.login(phone, 'Password-123', db)).rejects.toThrow('INVALID_CREDENTIALS');
    expect((await getMe((await auth.login(phone, 'New-Password-1', db)).accessToken)).status).toBe(200);
  });

  it('refresh rotates the session and rejects a reused refresh token', async (ctx) => {
    if (!db) return ctx.skip();
    const phone = randomPhone();
    const reg = await auth.register({ phone, dob: '1990-01-01', password: 'Password-123' }, db);
    const first = await auth.login(phone, 'Password-123', db);

    const rotated = await auth.refresh(first.refreshToken, db);
    expect((await getMe(rotated.accessToken)).status).toBe(200);
    expect((await getMe(first.accessToken)).status).toBe(401);
    await expect(auth.refresh(first.refreshToken, db)).rejects.toThrow('REFRESH_REVOKED');
  });

  it('survives a restart: sessions live only in PostgreSQL', async (ctx) => {
    if (!db) return ctx.skip();
    const phone = randomPhone();
    const reg = await auth.register({ phone, dob: '1990-01-01', password: 'Password-123' }, db);
    const session = await auth.login(phone, 'Password-123', db);

    // A brand-new app instance (fresh process state) accepts the same token.
    const fresh = createApp(db).listen(0);
    try {
      const url = `http://127.0.0.1:${(fresh.address() as AddressInfo).port}/api/v1`;
      expect((await fetch(`${url}/users/me`, { headers: { authorization: `Bearer ${session.accessToken}` } })).status).toBe(200);
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
