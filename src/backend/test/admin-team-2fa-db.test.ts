import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createDatabaseClient, type ConnectedDatabaseClient } from '../src/core/database/postgres.client.js';
import { createApp } from '../src/app.js';
import * as auth from '../src/modules/auth/service.js';
import { codeAt, currentStep } from '../src/modules/admin/totp.js';
import { roleAllows } from '../src/modules/admin/admin-permissions.js';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testSecret123@localhost:54328/n5_idempotency_test';
const randomPhone = () => `+92300${crypto.randomInt(1000000, 9999999)}`;
const PASSWORD = 'Password-123';

describe('roleAllows', () => {
  it('gives each role only its own areas', () => {
    expect(roleAllows('super_admin', 'POST', '/team')).toBe(true);
    expect(roleAllows('admin', 'POST', '/team')).toBe(false);
    expect(roleAllows('admin', 'GET', '/audit')).toBe(false);
    expect(roleAllows('admin', 'POST', '/users/x/adjust-balance')).toBe(true);
    expect(roleAllows('finance', 'POST', '/withdrawals/x/approve')).toBe(true);
    expect(roleAllows('finance', 'POST', '/users/x/adjust-balance')).toBe(false);
    expect(roleAllows('finance', 'PUT', '/payment-methods/x')).toBe(false);
    expect(roleAllows('support', 'POST', '/users/x/reset-password')).toBe(true);
    expect(roleAllows('support', 'GET', '/withdrawals')).toBe(false);
    expect(roleAllows('unknown', 'GET', '/overview')).toBe(true);
    expect(roleAllows('unknown', 'GET', '/withdrawals')).toBe(false);
  });
});

describe('Admin team and 2FA (PostgreSQL)', () => {
  let db: ConnectedDatabaseClient | undefined;
  let server: Server;
  let baseUrl = '';
  const created: string[] = [];
  const previousFlag = process.env.ADMIN_2FA_REQUIRED;

  beforeAll(async () => {
    const candidate = createDatabaseClient(TEST_DB_URL);
    try {
      await candidate.query('SELECT totp_enabled_at FROM admin_users LIMIT 0');
      db = candidate;
    } catch {
      await candidate.close().catch(() => {});
      console.info(`[INFO] Migrated PostgreSQL test database not available at ${TEST_DB_URL}. Skipping.`);
      return;
    }
    process.env.ADMIN_2FA_REQUIRED = 'true';
    server = createApp(db).listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  });

  afterAll(async () => {
    if (previousFlag === undefined) delete process.env.ADMIN_2FA_REQUIRED; else process.env.ADMIN_2FA_REQUIRED = previousFlag;
    if (db && created.length) await db.query(`DELETE FROM admin_users WHERE user_id = ANY($1::uuid[])`, [created]);
    if (server) await new Promise((resolve) => server.close(resolve));
    await db?.close();
  });

  const call = async (token: string, method: string, path: string, body?: unknown) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as any;
    return { status: res.status, code: json?.error?.code, data: json?.data, json };
  };

  async function newAccount() {
    const phone = randomPhone();
    const { userId } = await auth.register({ phone, dob: '1990-01-01', password: PASSWORD }, db!);
    return { phone, userId };
  }

  async function makeOwner() {
    const owner = await newAccount();
    await db!.query(
      `INSERT INTO admin_users (user_id, role_id, status) SELECT $1, id, 'active' FROM admin_roles WHERE code = 'super_admin'`,
      [owner.userId],
    );
    created.push(owner.userId);
    return owner;
  }

  /** Signs in and completes 2FA setup; returns the session and the secret. */
  async function signInWithNewTotp(phone: string) {
    const session = await auth.login(phone, PASSWORD, db!);
    const setup = await call(session.accessToken, 'POST', '/admin/2fa/setup');
    expect(setup.status).toBe(200);
    const secret = setup.data.secret as string;
    expect((await call(session.accessToken, 'POST', '/admin/2fa/enable', { code: codeAt(secret, currentStep()) })).status).toBe(200);
    return { session, secret };
  }

  it('requires authenticator setup, then a code on every new sign-in', async (ctx) => {
    if (!db) return ctx.skip();
    const owner = await makeOwner();
    const first = await auth.login(owner.phone, PASSWORD, db);

    expect((await call(first.accessToken, 'GET', '/admin/overview')).code).toBe('ADMIN_2FA_SETUP_REQUIRED');
    const me = await call(first.accessToken, 'GET', '/admin/me');
    expect(me.status).toBe(200);
    expect(me.data).toMatchObject({ role: 'super_admin', roleLabel: 'Owner', totpEnabled: false, sessionVerified: false, twoFactorRequired: true });

    const setup = await call(first.accessToken, 'POST', '/admin/2fa/setup');
    const secret = setup.data.secret as string;
    expect(setup.data.otpauthUri).toContain(`secret=${secret}`);
    // Reloading the page shows the same key until it is confirmed.
    expect((await call(first.accessToken, 'POST', '/admin/2fa/setup')).data.secret).toBe(secret);
    // The key is not stored in plain text.
    const stored = (await db.query<{ totp_secret_enc: string }>(`SELECT totp_secret_enc FROM admin_users WHERE user_id = $1`, [owner.userId])).rows[0];
    expect(stored.totp_secret_enc).not.toContain(secret);

    expect((await call(first.accessToken, 'POST', '/admin/2fa/enable', { code: '000000' })).code).toBe('ADMIN_2FA_INVALID_CODE');
    const usedCode = codeAt(secret, currentStep());
    expect((await call(first.accessToken, 'POST', '/admin/2fa/enable', { code: usedCode })).status).toBe(200);
    expect((await call(first.accessToken, 'GET', '/admin/overview')).status).toBe(200);
    expect((await call(first.accessToken, 'POST', '/admin/2fa/setup')).code).toBe('ADMIN_2FA_ALREADY_ENABLED');

    // A new sign-in needs a code again; a code already used is refused.
    const second = await auth.login(owner.phone, PASSWORD, db);
    expect((await call(second.accessToken, 'GET', '/admin/overview')).code).toBe('ADMIN_2FA_REQUIRED');
    expect((await call(second.accessToken, 'POST', '/admin/2fa/verify', { code: usedCode })).code).toBe('ADMIN_2FA_INVALID_CODE');
    expect((await call(second.accessToken, 'POST', '/admin/2fa/verify', { code: codeAt(secret, currentStep() + 1) })).status).toBe(200);
    expect((await call(second.accessToken, 'GET', '/admin/overview')).status).toBe(200);

    // Refreshing the token keeps the session verified.
    const refreshed = await auth.refresh(second.refreshToken, db);
    expect((await call(refreshed.accessToken, 'GET', '/admin/overview')).status).toBe(200);

    const log = await call(refreshed.accessToken, 'GET', '/admin/audit');
    expect(log.data.some((e: any) => e.action === 'admin.login' && e.actorUserId === owner.userId)).toBe(true);
  });

  it('locks 2FA after five wrong codes', async (ctx) => {
    if (!db) return ctx.skip();
    const owner = await makeOwner();
    const { secret } = await signInWithNewTotp(owner.phone);
    const s = await auth.login(owner.phone, PASSWORD, db);
    for (let i = 0; i < 5; i++) {
      expect((await call(s.accessToken, 'POST', '/admin/2fa/verify', { code: '111111' })).code).toBe('ADMIN_2FA_INVALID_CODE');
    }
    const locked = await call(s.accessToken, 'POST', '/admin/2fa/verify', { code: codeAt(secret, currentStep() + 1) });
    expect(locked.status).toBe(429);
    expect(locked.code).toBe('ADMIN_2FA_LOCKED');
  });

  it('lets the Owner add team members with limited roles, change and suspend them', async (ctx) => {
    if (!db) return ctx.skip();
    const owner = await makeOwner();
    const { session: ownerSession } = await signInWithNewTotp(owner.phone);
    const o = ownerSession.accessToken;

    const member = await newAccount();
    expect((await call(o, 'POST', '/admin/team', { phone: '0300-0000000', role: 'finance' })).code).toBe('USER_NOT_FOUND');
    expect((await call(o, 'POST', '/admin/team', { phone: owner.phone, role: 'finance' })).code).toBe('CANNOT_CHANGE_SELF');
    expect((await call(o, 'POST', '/admin/team', { phone: member.phone, role: 'super_admin' })).code).toBe('INVALID_INPUT');
    expect((await call(o, 'POST', '/admin/team', { phone: member.phone, role: 'finance' })).status).toBe(201);
    created.push(member.userId);

    const team = await call(o, 'GET', '/admin/team');
    expect(team.data.find((m: any) => m.userId === member.userId)).toMatchObject({ role: 'finance', roleLabel: 'Finance', status: 'active', totpEnabled: false });

    // Finance: withdrawals yes; balances, VIP and the team no.
    const { session: memberSession } = await signInWithNewTotp(member.phone);
    const m = memberSession.accessToken;
    expect((await call(m, 'GET', '/admin/withdrawals')).status).toBe(200);
    expect((await call(m, 'GET', '/admin/vip/levels')).code).toBe('ADMIN_PERMISSION_DENIED');
    expect((await call(m, 'POST', `/admin/users/${owner.userId}/adjust-balance`, { amount: 1000, reason: 'x' })).code).toBe('ADMIN_PERMISSION_DENIED');
    expect((await call(m, 'GET', '/admin/team')).code).toBe('ADMIN_PERMISSION_DENIED');
    expect((await call(m, 'PATCH', `/admin/team/${owner.userId}`, { status: 'suspended' })).code).toBe('ADMIN_PERMISSION_DENIED');

    // Change role: takes effect on the next request.
    expect((await call(o, 'PATCH', `/admin/team/${member.userId}`, { role: 'support' })).status).toBe(200);
    expect((await call(m, 'GET', '/admin/withdrawals')).code).toBe('ADMIN_PERMISSION_DENIED');
    expect((await call(m, 'GET', '/admin/users')).status).toBe(200);

    // The Owner cannot change themself.
    expect((await call(o, 'PATCH', `/admin/team/${owner.userId}`, { status: 'suspended' })).code).toBe('CANNOT_CHANGE_SELF');

    // Reset 2FA: they must set it up again.
    expect((await call(o, 'POST', `/admin/team/${member.userId}/reset-2fa`)).status).toBe(200);
    expect((await call(m, 'GET', '/admin/users')).code).toBe('ADMIN_2FA_SETUP_REQUIRED');

    // Suspend: no admin access at all.
    expect((await call(o, 'PATCH', `/admin/team/${member.userId}`, { status: 'suspended' })).status).toBe(200);
    expect((await call(m, 'GET', '/admin/me')).code).toBe('ADMIN_ACCESS_REQUIRED');

    const log = await call(o, 'GET', '/admin/audit');
    const actions = log.data.filter((e: any) => e.actorUserId === owner.userId).map((e: any) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['admin.team.add', 'admin.team.update', 'admin.team.reset_2fa']));
  });

  it('lets an admin set a username and sign in with it', async (ctx) => {
    if (!db) return ctx.skip();
    const owner = await makeOwner();
    const { session } = await signInWithNewTotp(owner.phone);
    const t = session.accessToken;
    const username = `owner${crypto.randomInt(100000, 999999)}`;

    expect((await call(t, 'PATCH', '/admin/me/username', { username: '1bad name' })).code).toBe('INVALID_USERNAME');
    expect((await call(t, 'PATCH', '/admin/me/username', { username: username.toUpperCase() })).data.username).toBe(username);
    expect((await call(t, 'GET', '/admin/me')).data.username).toBe(username);

    // Signing in with the username (any case) works; a wrong password still counts.
    const viaName = await auth.login(username.toUpperCase(), PASSWORD, db);
    expect(viaName.user.id).toBe(owner.userId);
    await expect(auth.login(username, 'Wrong-Password-1', db)).rejects.toThrow();
    await expect(auth.login('nosuchadmin', PASSWORD, db)).rejects.toThrow();

    // Usernames are unique.
    const other = await makeOwner();
    const { session: s2 } = await signInWithNewTotp(other.phone);
    expect((await call(s2.accessToken, 'PATCH', '/admin/me/username', { username })).code).toBe('USERNAME_TAKEN');

    const team = await call(t, 'GET', '/admin/team');
    expect(team.data.find((m: any) => m.userId === owner.userId).username).toBe(username);

    // An admin's phone number is never shown in the admin panel.
    const ownerRow = team.data.find((m: any) => m.userId === owner.userId);
    expect(ownerRow.phone).toBe(`@${username}`);
    const players = await call(t, 'GET', '/admin/users');
    const shown = JSON.stringify(players.json);
    expect(shown).not.toContain(owner.phone);
    expect((await call(t, 'GET', `/admin/users/${owner.userId}`)).json && JSON.stringify((await call(t, 'GET', `/admin/users/${owner.userId}`)).json)).not.toContain(owner.phone);
    expect(JSON.stringify((await call(t, 'GET', '/admin/audit')).json)).not.toContain(owner.phone);
    expect(JSON.stringify((await call(t, 'GET', '/admin/me')).json)).not.toContain(owner.phone);
  });
});
