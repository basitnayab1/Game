import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { createDatabaseClient, type ConnectedDatabaseClient } from '../src/core/database/postgres.client.js';
import { requestKycSubmission, applyKycProviderDecision, getKycStatus } from '../src/modules/security_kyc/integration.service.js';
import { listAdminUsers, getAdminUser } from '../src/modules/admin/admin-operations.service.js';
import { AdminConfigService } from '../src/modules/admin/admin.service.js';
import { PostgresAdminConfigRepository } from '../src/modules/admin/admin.repository.js';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import type { AddressInfo } from 'node:net';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testSecret123@localhost:54328/n5_idempotency_test';

describe('KYC and admin config persistence (PostgreSQL)', () => {
  let db: ConnectedDatabaseClient | undefined;
  let userId = '';

  beforeAll(async () => {
    const candidate = createDatabaseClient(TEST_DB_URL);
    try {
      await candidate.query('SELECT 1 FROM kyc_profiles LIMIT 0');
      db = candidate;
    } catch {
      await candidate.close().catch(() => {});
      console.info(`[INFO] Migrated PostgreSQL test database not available at ${TEST_DB_URL}. Skipping KYC/admin config DB tests.`);
      return;
    }
    const phone = `+92300${crypto.randomInt(1000000, 9999999)}`;
    const u = await db.query<{ id: string }>(
      `INSERT INTO users(phone_e164,date_of_birth,password_hash) VALUES($1,'1990-01-01','x') RETURNING id`, [phone]);
    userId = u.rows[0].id;
  });

  afterAll(async () => {
    await db?.close();
  });

  it('stores submitted KYC details and exposes them to the admin review queue', async (ctx) => {
    if (!db) return ctx.skip();
    const ref = `N5_KYC_TEST_${Date.now()}`;
    await requestKycSubmission(db, userId, {
      provider: 'manual_admin',
      providerReference: ref,
      fullName: 'Test Player',
      documentType: 'id_card',
      documentNumber: '00000-0000000-0',
      documentFrontUrl: 'kyc/front.jpg',
      documentBackUrl: 'kyc/back.jpg',
    });

    expect((await getKycStatus(db, userId)).status).toBe('in_progress');

    const listed = (await listAdminUsers(db)).find((r: any) => r.id === userId) as any;
    expect(listed).toMatchObject({
      kyc_status: 'in_progress',
      cnic_number: '00000-0000000-0',
      full_name: 'Test Player',
      document_type: 'id_card',
      document_front: 'kyc/front.jpg',
      document_back: 'kyc/back.jpg',
    });
    expect(((await getAdminUser(db, userId)).user as any).cnic_number).toBe('00000-0000000-0');

    const applied = await applyKycProviderDecision(db, { userId: 'ignored', referenceId: ref, status: 'verified' });
    expect(applied).toEqual({ userId, status: 'verified' });
    const status = await getKycStatus(db, userId);
    expect(status.status).toBe('verified');
    expect(status.verified_at).not.toBeNull();
  });

  it('rejects provider decisions for unknown references and unknown users', async (ctx) => {
    if (!db) return ctx.skip();
    await expect(applyKycProviderDecision(db, { userId: crypto.randomUUID(), referenceId: 'UNKNOWN_REF', status: 'verified' }))
      .rejects.toThrow('KYC_PROFILE_NOT_FOUND');
    await expect(applyKycProviderDecision(db, { userId: '', referenceId: 'UNKNOWN_REF', status: 'verified' }))
      .rejects.toThrow('KYC_PROFILE_NOT_FOUND');
  });

  it('resolves a Sumsub decision by our user id when the applicant id is not stored', async (ctx) => {
    if (!db) return ctx.skip();
    const phone = `+92301${crypto.randomInt(1000000, 9999999)}`;
    const otherUser = (await db.query<{ id: string }>(
      `INSERT INTO users(phone_e164,date_of_birth,password_hash) VALUES($1,'1990-01-01','x') RETURNING id`, [phone])).rows[0].id;
    await requestKycSubmission(db, otherUser, { provider: 'sumsub', providerReference: `N5_KYC_SUMSUB_${Date.now()}` });

    const applied = await applyKycProviderDecision(db, { userId: otherUser, referenceId: 'sumsub-applicant-xyz', status: 'rejected' });
    expect(applied).toEqual({ userId: otherUser, status: 'rejected' });
    expect((await getKycStatus(db, otherUser)).status).toBe('rejected');
  });

  it('applies a signed Shufti Pro callback end to end through POST /api/v1/kyc/webhook/shuftipro', async (ctx) => {
    if (!db) return ctx.skip();
    const phone = `+92302${crypto.randomInt(1000000, 9999999)}`;
    const player = (await db.query<{ id: string }>(
      `INSERT INTO users(phone_e164,date_of_birth,password_hash) VALUES($1,'1990-01-01','x') RETURNING id`, [phone])).rows[0].id;
    const ref = `N5_KYC_E2E_${Date.now()}`;
    await requestKycSubmission(db, player, { provider: 'shuftipro', providerReference: ref });

    const savedSecret = env.KYC_SECRET_KEY;
    env.KYC_SECRET_KEY = 'e2e-shufti-secret';
    const server = createApp(db).listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      const raw = JSON.stringify({ event: 'verification.accepted', reference: ref });
      const signature = crypto.createHash('sha256').update(raw + env.KYC_SECRET_KEY).digest('hex');
      const send = (sig: string) => fetch(`http://127.0.0.1:${port}/api/v1/kyc/webhook/shuftipro`, {
        method: 'POST', headers: { 'content-type': 'application/json', signature: sig }, body: raw,
      });

      const forged = await send('0'.repeat(64));
      expect(forged.status).toBe(401);
      expect((await getKycStatus(db, player)).status).toBe('in_progress');

      const res = await send(signature);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true, status: 'verified', referenceId: ref });
      expect((await getKycStatus(db, player)).status).toBe('verified');
    } finally {
      env.KYC_SECRET_KEY = savedSecret;
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('persists admin config with version increments', async (ctx) => {
    if (!db) return ctx.skip();
    const service = new AdminConfigService(new PostgresAdminConfigRepository(db));
    const first = await service.set({ key: 'announcement_text', value: 'hello', valueType: 'string', updatedBy: userId });
    const second = await service.set({ key: 'announcement_text', value: 'world', valueType: 'string', updatedBy: userId });
    expect(second.version).toBe(first.version + 1);
    expect((await service.list()).find((e) => e.key === 'announcement_text')?.value).toBe('world');
    await expect(service.set({ key: 'easypaisa_account_number', value: 'x', valueType: 'string', updatedBy: userId }))
      .rejects.toThrow('Unsupported admin configuration key');
  });
});
