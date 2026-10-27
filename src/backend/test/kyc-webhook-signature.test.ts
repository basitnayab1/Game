import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from '../src/config/env.js';
import { KycProviderService } from '../src/modules/security_kyc/kyc-provider.service.js';
import { handleKycWebhook } from '../src/modules/security_kyc/integration.controller.js';
import { createApp } from '../src/app.js';
import type { AddressInfo } from 'node:net';

const SHUFTI_SECRET = 'test-shufti-secret';
const SUMSUB_SECRET = 'test-sumsub-webhook-secret';

const shuftiBody = { event: 'verification.accepted', reference: 'N5_KYC_TEST_1' };
const shuftiRaw = JSON.stringify(shuftiBody);
const shuftiSignature = (raw: string, secret = SHUFTI_SECRET) =>
  crypto.createHash('sha256').update(raw + secret).digest('hex');

const sumsubBody = { applicantId: 'app-123', externalUserId: crypto.randomUUID(), reviewResult: { reviewAnswer: 'GREEN' } };
const sumsubRaw = JSON.stringify(sumsubBody);
const sumsubDigest = (raw: string, alg = 'sha256') => crypto.createHmac(alg, SUMSUB_SECRET).update(raw).digest('hex');

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) { res.statusCode = code; return res; },
    json(data: any) { res.body = data; return res; },
  };
  return res;
}

describe('KYC webhook signature verification', () => {
  const saved = { secret: env.KYC_SECRET_KEY, webhook: env.KYC_WEBHOOK_SECRET };

  beforeEach(() => {
    env.KYC_SECRET_KEY = SHUFTI_SECRET;
    env.KYC_WEBHOOK_SECRET = SUMSUB_SECRET;
  });

  afterEach(() => {
    env.KYC_SECRET_KEY = saved.secret;
    env.KYC_WEBHOOK_SECRET = saved.webhook;
  });

  it('rejects a Shufti Pro callback without a signature header (former bypass)', () => {
    expect(KycProviderService.verifyAndParseWebhook('shuftipro', shuftiBody, {}, shuftiRaw))
      .toEqual({ ok: false, code: 'INVALID_SIGNATURE' });
  });

  it('rejects a Shufti Pro callback with a wrong signature', () => {
    const headers = { signature: shuftiSignature(shuftiRaw, 'wrong-secret') };
    expect(KycProviderService.verifyAndParseWebhook('shuftipro', shuftiBody, headers, shuftiRaw).ok).toBe(false);
  });

  it('rejects a Shufti Pro callback whose body was altered after signing', () => {
    const tampered = JSON.stringify({ ...shuftiBody, reference: 'N5_KYC_OTHER_USER' });
    const headers = { signature: shuftiSignature(shuftiRaw) };
    expect(KycProviderService.verifyAndParseWebhook('shuftipro', JSON.parse(tampered), headers, tampered).ok).toBe(false);
  });

  it('fails closed when the Shufti Pro secret is not configured', () => {
    env.KYC_SECRET_KEY = undefined;
    const headers = { signature: shuftiSignature(shuftiRaw) };
    expect(KycProviderService.verifyAndParseWebhook('shuftipro', shuftiBody, headers, shuftiRaw))
      .toEqual({ ok: false, code: 'KYC_WEBHOOK_NOT_CONFIGURED' });
  });

  it('rejects a callback without the raw request body', () => {
    const headers = { signature: shuftiSignature(shuftiRaw) };
    expect(KycProviderService.verifyAndParseWebhook('shuftipro', shuftiBody, headers, undefined))
      .toEqual({ ok: false, code: 'INVALID_WEBHOOK_PAYLOAD' });
  });

  it('accepts a correctly signed Shufti Pro callback (plain and hashed-secret schemes)', () => {
    const plain = KycProviderService.verifyAndParseWebhook('shuftipro', shuftiBody, { signature: shuftiSignature(shuftiRaw) }, shuftiRaw);
    expect(plain).toMatchObject({ ok: true, result: { referenceId: 'N5_KYC_TEST_1', status: 'verified' } });

    const hashedSecret = crypto.createHash('sha256').update(SHUFTI_SECRET).digest('hex');
    const hashed = KycProviderService.verifyAndParseWebhook('shuftipro', shuftiBody, { signature: shuftiSignature(shuftiRaw, hashedSecret) }, shuftiRaw);
    expect(hashed.ok).toBe(true);
  });

  it('rejects a Sumsub callback without a payload digest', () => {
    expect(KycProviderService.verifyAndParseWebhook('sumsub', sumsubBody, {}, sumsubRaw))
      .toEqual({ ok: false, code: 'INVALID_SIGNATURE' });
  });

  it('fails closed when the Sumsub webhook secret is not configured', () => {
    env.KYC_WEBHOOK_SECRET = undefined;
    const headers = { 'x-payload-digest': sumsubDigest(sumsubRaw) };
    expect(KycProviderService.verifyAndParseWebhook('sumsub', sumsubBody, headers, sumsubRaw))
      .toEqual({ ok: false, code: 'KYC_WEBHOOK_NOT_CONFIGURED' });
  });

  it('accepts a correctly signed Sumsub callback and honours the digest algorithm header', () => {
    const sha256 = KycProviderService.verifyAndParseWebhook('sumsub', sumsubBody, { 'x-payload-digest': sumsubDigest(sumsubRaw) }, sumsubRaw);
    expect(sha256).toMatchObject({ ok: true, result: { referenceId: 'app-123', userId: sumsubBody.externalUserId, status: 'verified' } });

    const sha512 = KycProviderService.verifyAndParseWebhook('sumsub', sumsubBody, {
      'x-payload-digest': sumsubDigest(sumsubRaw, 'sha512'),
      'x-payload-digest-alg': 'HMAC_SHA512_HEX',
    }, sumsubRaw);
    expect(sha512.ok).toBe(true);

    const unknownAlg = KycProviderService.verifyAndParseWebhook('sumsub', sumsubBody, {
      'x-payload-digest': sumsubDigest(sumsubRaw),
      'x-payload-digest-alg': 'NONE',
    }, sumsubRaw);
    expect(unknownAlg.ok).toBe(false);
  });

  it('rejects unsupported providers', () => {
    expect(KycProviderService.verifyAndParseWebhook('veriff', shuftiBody, {}, shuftiRaw))
      .toEqual({ ok: false, code: 'UNSUPPORTED_PROVIDER' });
  });

  it('returns 401 from the webhook handler for an unsigned callback, before touching the database', async () => {
    const res = createMockResponse();
    await handleKycWebhook({
      params: { provider: 'shuftipro' },
      headers: {},
      body: shuftiBody,
      rawBody: shuftiRaw,
      app: { locals: {} },
    } as any as Request, res as Response);
    expect(res.statusCode).toBe(401);
    expect(res.body?.error?.code).toBe('INVALID_SIGNATURE');
  });

  describe('mounted route POST /api/v1/kyc/webhook/:provider', () => {
    async function post(headers: Record<string, string>, body: string) {
      const server = createApp().listen(0);
      try {
        const { port } = server.address() as AddressInfo;
        const res = await fetch(`http://127.0.0.1:${port}/api/v1/kyc/webhook/shuftipro`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body,
        });
        return { status: res.status, body: await res.json() as any };
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    }

    it('is reachable without player auth and rejects an unsigned callback with 401', async () => {
      const res = await post({}, shuftiRaw);
      expect(res.status).toBe(401);
      expect(res.body?.error?.code).toBe('INVALID_SIGNATURE');
    });

    it('verifies the signature over the raw request body', async () => {
      // Signature matches the exact bytes sent; without a database the handler then fails closed.
      const signed = await post({ signature: shuftiSignature(shuftiRaw) }, shuftiRaw);
      expect(signed.status).toBe(503);
      expect(signed.body?.error?.code).toBe('KYC_STORE_UNAVAILABLE');

      // Same JSON with different whitespace no longer matches the signature.
      const reformatted = await post({ signature: shuftiSignature(shuftiRaw) }, JSON.stringify(shuftiBody, null, 2));
      expect(reformatted.status).toBe(401);
    });
  });
});
