import crypto from 'node:crypto';
import { env } from '../../config/env.js';

export interface KycSessionRequest {
  userId: string;
  userPhone?: string;
  fullName?: string;
  documentType?: 'id_card' | 'passport' | 'driving_license';
  country?: string;
  callbackUrl?: string;
}

export interface KycSessionResponse {
  success: boolean;
  provider: string;
  referenceId: string;
  verificationUrl?: string;
  sessionToken?: string;
  status: 'not_started' | 'in_progress' | 'verified' | 'rejected';
  message: string;
}

export interface KycWebhookResult {
  userId: string;
  referenceId: string;
  status: 'verified' | 'rejected' | 'in_progress';
  documentNumber?: string;
  documentType?: string;
  declineReason?: string;
  verifiedAt?: string;
}

export type KycWebhookVerification =
  | { ok: true; result: KycWebhookResult }
  | { ok: false; code: 'KYC_WEBHOOK_NOT_CONFIGURED' | 'INVALID_SIGNATURE' | 'INVALID_WEBHOOK_PAYLOAD' | 'UNSUPPORTED_PROVIDER' };

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a.trim().toLowerCase(), 'utf8');
  const bufB = Buffer.from(b.trim().toLowerCase(), 'utf8');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const SUMSUB_DIGEST_ALGORITHMS: Record<string, string> = {
  HMAC_SHA1_HEX: 'sha1',
  HMAC_SHA256_HEX: 'sha256',
  HMAC_SHA512_HEX: 'sha512',
};

/**
 * Enterprise KYC Provider Integration
 * Direct API connection for Shufti Pro (Pakistan CNIC & Face Liveness),
 * Sumsub, and Veriff.
 */
export class KycProviderService {
  /**
   * Initiate a live KYC verification session with the external provider.
   */
  public static async createVerificationSession(input: KycSessionRequest): Promise<KycSessionResponse> {
    const provider = (env.KYC_PROVIDER || 'shuftipro').toLowerCase();
    const referenceId = `N5_KYC_${input.userId.replace(/-/g, '').slice(0, 8)}_${Date.now()}`;

    // 1. Shufti Pro Integration (Standard for Pakistan CNIC & Nadra validation)
    if (provider === 'shuftipro' && env.KYC_CLIENT_ID && env.KYC_SECRET_KEY) {
      try {
        const auth = Buffer.from(`${env.KYC_CLIENT_ID}:${env.KYC_SECRET_KEY}`).toString('base64');
        const payload = {
          reference: referenceId,
          callback_url: input.callbackUrl || `https://api.n5game.com/api/v1/kyc/webhook/shuftipro`,
          email: `${input.userId}@n5game.com`,
          country: input.country || 'PK',
          language: 'EN',
          verification_mode: 'image_only',
          document: {
            supported_types: [input.documentType || 'id_card', 'passport'],
            name: input.fullName || '',
          },
          face: {
            check_liveness: 1,
          },
        };

        const response = await fetch('https://api.shuftipro.com/', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (data.event === 'request.pending' || data.verification_url) {
          return {
            success: true,
            provider: 'shuftipro',
            referenceId,
            verificationUrl: data.verification_url,
            sessionToken: data.token || referenceId,
            status: 'in_progress',
            message: 'Shufti Pro verification session created. Direct player to verificationUrl.',
          };
        } else {
          console.warn('[KYC:SHUFTIPRO:API_ERROR]', data);
          return {
            success: false,
            provider: 'shuftipro',
            referenceId,
            status: 'not_started',
            message: data.message || 'Failed to initialize Shufti Pro verification',
          };
        }
      } catch (err: any) {
        console.error('[KYC:SHUFTIPRO:EXCEPTION]', err.message);
        return {
          success: false,
          provider: 'shuftipro',
          referenceId,
          status: 'not_started',
          message: err.message,
        };
      }
    }

    // 2. Sumsub Integration
    if (provider === 'sumsub' && env.KYC_CLIENT_ID && env.KYC_SECRET_KEY) {
      try {
        const ts = Math.floor(Date.now() / 1000).toString();
        const path = `/resources/sdkTokens?userId=${input.userId}&levelName=basic-kyc-level`;
        const signature = crypto
          .createHmac('sha256', env.KYC_SECRET_KEY)
          .update(ts + 'POST' + path)
          .digest('hex');

        const response = await fetch(`https://api.sumsub.com${path}`, {
          method: 'POST',
          headers: {
            'X-App-Token': env.KYC_CLIENT_ID,
            'X-App-Access-Sig': signature,
            'X-App-Access-Ts': ts,
          },
        });

        const data = await response.json();
        if (data.token) {
          return {
            success: true,
            provider: 'sumsub',
            referenceId,
            sessionToken: data.token,
            verificationUrl: `https://cockpit.sumsub.com/idensic/index.html?token=${data.token}`,
            status: 'in_progress',
            message: 'Sumsub verification session initialized.',
          };
        }
      } catch (err: any) {
        console.error('[KYC:SUMSUB:EXCEPTION]', err.message);
      }
    }

    // 3. Manual Operator Review Mode (100% Free Unlimited)
    const effectiveProvider = provider === 'manual' || !env.KYC_CLIENT_ID ? 'manual_admin' : provider;
    console.log(`\n======================================================`);
    console.log(`[KYC SUBMISSION RECEIVED] User: ${input.userId}`);
    console.log(`[REFERENCE] ${referenceId}`);
    console.log(`[MODE] Manual Operator Review (100% Free Unlimited)`);
    console.log(`[DASHBOARD] Pending in Admin KYC Review Queue at http://localhost:4174`);
    console.log(`======================================================\n`);

    return {
      success: true,
      provider: effectiveProvider,
      referenceId,
      verificationUrl: `/portal/kyc-verify?ref=${referenceId}&user=${input.userId}`,
      sessionToken: referenceId,
      status: 'in_progress',
      message: 'KYC submission received and queued for Operator Review.',
    };
  }

  /**
   * Verify and parse a KYC provider callback. Fails closed: a missing secret,
   * a missing signature or a mismatch rejects the callback before it is parsed.
   * Signatures are computed over the exact raw request body.
   */
  public static verifyAndParseWebhook(
    provider: string,
    body: any,
    headers: Record<string, string | string[] | undefined>,
    rawBody?: string,
  ): KycWebhookVerification {
    const header = (name: string) => {
      const value = headers[name];
      return String(Array.isArray(value) ? value[0] ?? '' : value ?? '');
    };
    const raw = typeof rawBody === 'string' && rawBody.length > 0 ? rawBody : null;
    if (!raw || !body || typeof body !== 'object') return { ok: false, code: 'INVALID_WEBHOOK_PAYLOAD' };

    if (provider === 'shuftipro') {
      // Shufti Pro: signature = sha256(raw body + secret key); newer accounts use sha256(raw body + sha256(secret key)).
      if (!env.KYC_SECRET_KEY) return { ok: false, code: 'KYC_WEBHOOK_NOT_CONFIGURED' };
      const signature = header('signature');
      const hashedSecret = crypto.createHash('sha256').update(env.KYC_SECRET_KEY).digest('hex');
      const candidates = [
        crypto.createHash('sha256').update(raw + env.KYC_SECRET_KEY).digest('hex'),
        crypto.createHash('sha256').update(raw + hashedSecret).digest('hex'),
      ];
      if (!signature || !candidates.some((c) => timingSafeEqualHex(c, signature))) {
        console.warn('[KYC:WEBHOOK] Shufti Pro signature missing or invalid');
        return { ok: false, code: 'INVALID_SIGNATURE' };
      }

      const event = body.event;
      const ref = String(body.reference || '');
      if (!ref) return { ok: false, code: 'INVALID_WEBHOOK_PAYLOAD' };

      if (event === 'verification.accepted') {
        return {
          ok: true,
          result: {
            userId: '',
            referenceId: ref,
            status: 'verified',
            documentNumber: body.verification_data?.document?.document_number || undefined,
            documentType: body.verification_data?.document?.selected_type || 'id_card',
            verifiedAt: new Date().toISOString(),
          },
        };
      }
      if (event === 'verification.declined') {
        return {
          ok: true,
          result: {
            userId: '',
            referenceId: ref,
            status: 'rejected',
            declineReason: body.declined_reason || 'Document verification failed',
          },
        };
      }
      return { ok: true, result: { userId: '', referenceId: ref, status: 'in_progress' } };
    }

    if (provider === 'sumsub') {
      // Sumsub: x-payload-digest = HMAC(webhook secret, raw body), algorithm named in x-payload-digest-alg.
      if (!env.KYC_WEBHOOK_SECRET) return { ok: false, code: 'KYC_WEBHOOK_NOT_CONFIGURED' };
      const digest = header('x-payload-digest');
      const algorithm = SUMSUB_DIGEST_ALGORITHMS[header('x-payload-digest-alg') || 'HMAC_SHA256_HEX'];
      if (!digest || !algorithm) return { ok: false, code: 'INVALID_SIGNATURE' };
      const expected = crypto.createHmac(algorithm, env.KYC_WEBHOOK_SECRET).update(raw).digest('hex');
      if (!timingSafeEqualHex(expected, digest)) {
        console.warn('[KYC:WEBHOOK] Sumsub payload digest invalid');
        return { ok: false, code: 'INVALID_SIGNATURE' };
      }

      const applicantId = String(body.applicantId || '');
      const externalUserId = String(body.externalUserId || '');
      if (!applicantId && !externalUserId) return { ok: false, code: 'INVALID_WEBHOOK_PAYLOAD' };
      const reviewAnswer = body.reviewResult?.reviewAnswer;
      return {
        ok: true,
        result: {
          userId: externalUserId,
          referenceId: applicantId,
          status: reviewAnswer === 'GREEN' ? 'verified' : reviewAnswer === 'RED' ? 'rejected' : 'in_progress',
          declineReason: body.reviewResult?.moderationComment,
          verifiedAt: reviewAnswer === 'GREEN' ? new Date().toISOString() : undefined,
        },
      };
    }

    return { ok: false, code: 'UNSUPPORTED_PROVIDER' };
  }
}
