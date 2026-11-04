import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createDatabaseClient, type ConnectedDatabaseClient } from '../src/core/database/postgres.client.js';
import { createApp } from '../src/app.js';
import * as auth from '../src/modules/auth/service.js';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testSecret123@localhost:54328/n5_idempotency_test';
const randomPhone = () => `+92300${crypto.randomInt(1000000, 9999999)}`;

describe('Admin password reset (PostgreSQL)', () => {
  let db: ConnectedDatabaseClient | undefined;
  let server: Server;
  let baseUrl = '';

  beforeAll(async () => {
    const candidate = createDatabaseClient(TEST_DB_URL);
    try {
      await candidate.query('SELECT must_change_password FROM users LIMIT 0');
      db = candidate;
    } catch {
      await candidate.close().catch(() => {});
      console.info(`[INFO] Migrated PostgreSQL test database not available at ${TEST_DB_URL}. Skipping.`);
      return;
    }
    server = createApp(db).listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  });

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await db?.close();
  });

  const call = (token: string, method: string, path: string, body?: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it('issues a one-time password that only allows choosing a new one', async (ctx) => {
    if (!db) return ctx.skip();
    const actor = await auth.register({ phone: randomPhone(), dob: '1990-01-01', password: 'Password-123' }, db);
    const phone = randomPhone();
    await auth.register({ phone, dob: '1990-01-01', password: 'Password-123' }, db);
    const before = await auth.login(phone, 'Password-123', db);

    const { temporaryPassword } = await auth.adminResetPassword(actor.userId, before.user.id, db);
    expect(temporaryPassword).toMatch(/^N5-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);

    // Old sessions and the old password stop working.
    expect((await call(before.accessToken, 'GET', '/users/me')).status).toBe(401);
    await expect(auth.login(phone, 'Password-123', db)).rejects.toThrow('INVALID_CREDENTIALS');

    // The temporary password signs in, but only to set a new password.
    const temp = await auth.login(phone, temporaryPassword, db);
    expect(temp.user.mustChangePassword).toBe(true);
    expect((await call(temp.accessToken, 'GET', '/wallet')).status).toBe(403);
    const me = await call(temp.accessToken, 'GET', '/users/me');
    expect(me.status).toBe(200);
    expect(((await me.json()) as any).data.mustChangePassword).toBe(true);

    expect((await call(temp.accessToken, 'POST', '/auth/change-password', { currentPassword: temporaryPassword, newPassword: 'Brand-New-123' })).status).toBe(204);
    expect((await call(temp.accessToken, 'GET', '/wallet')).status).toBe(200);
    await expect(auth.login(phone, temporaryPassword, db)).rejects.toThrow('INVALID_CREDENTIALS');
    expect((await auth.login(phone, 'Brand-New-123', db)).user.mustChangePassword).toBe(false);

    const audit = (await db.query(`SELECT 1 FROM audit_events WHERE action = 'admin.user.password_reset' AND entity_id = $1`, [before.user.id])).rows;
    expect(audit).toHaveLength(1);
  });

  it('unlocks an account locked by wrong passwords', async (ctx) => {
    if (!db) return ctx.skip();
    const actor = await auth.register({ phone: randomPhone(), dob: '1990-01-01', password: 'Password-123' }, db);
    const phone = randomPhone();
    const player = await auth.register({ phone, dob: '1990-01-01', password: 'Password-123' }, db);
    for (let i = 0; i < 3; i++) await auth.login(phone, 'Wrong-Password', db).catch(() => {});
    await expect(auth.login(phone, 'Password-123', db)).rejects.toThrow('LOGIN_LOCKED');

    const { temporaryPassword } = await auth.adminResetPassword(actor.userId, player.userId, db);
    expect((await auth.login(phone, temporaryPassword, db)).accessToken).toBeTruthy();
  });

  it('refuses to reset an admin account', async (ctx) => {
    if (!db) return ctx.skip();
    const actor = await auth.register({ phone: randomPhone(), dob: '1990-01-01', password: 'Password-123' }, db);
    const admin = await auth.register({ phone: randomPhone(), dob: '1990-01-01', password: 'Password-123' }, db);
    await db.query(
      `INSERT INTO admin_users (user_id, role_id, status) SELECT $1, id, 'suspended' FROM admin_roles LIMIT 1`,
      [admin.userId],
    );
    await expect(auth.adminResetPassword(actor.userId, admin.userId, db)).rejects.toThrow('ADMIN_ACCOUNT');
  });
});
