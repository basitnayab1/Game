import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { getKycStatus, requestKycSubmission, applyKycProviderDecision, getSecurityOverview, revokeOtherSessions } from './integration.service.js';
import { KycProviderService } from './kyc-provider.service.js';

function ready(req: Request, res: Response) {
  const userId = (req.auth as { userId?: string } | undefined)?.userId;
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!userId) {
    res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } });
    return null;
  }
  return { userId, db };
}

function kycStoreUnavailable(res: Response) {
  return res.status(503).json({ ok: false, error: { code: 'KYC_STORE_UNAVAILABLE', message: 'KYC requires the PostgreSQL database to be configured.' } });
}

function securityStoreUnavailable(res: Response) {
  return res.status(503).json({ ok: false, error: { code: 'SECURITY_STORE_UNAVAILABLE', message: 'Account security requires the PostgreSQL database to be configured.' } });
}

export async function getKyc(req: Request, res: Response) {
  const x = ready(req, res);
  if (!x) return;

  if (!x.db) return kycStoreUnavailable(res);

  try {
    return res.json({ ok: true, data: await getKycStatus(x.db, x.userId) });
  } catch {
    return res.status(500).json({ ok: false, error: { code: 'KYC_READ_FAILED' } });
  }
}

export async function submitKyc(req: Request, res: Response) {
  const x = ready(req, res);
  if (!x) return;

  if (!x.db) return kycStoreUnavailable(res);
  const db = x.db;

  if (req.body && ('status' in req.body || 'verified' in req.body || 'verificationResult' in req.body)) {
    return res.status(400).json({ ok: false, error: { code: 'KYC_STATUS_SERVER_AUTHORITATIVE', message: 'Client cannot dictate verification status' } });
  }

  try {
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : (typeof req.body?.name === 'string' ? req.body.name.trim() : undefined);
    const documentType = typeof req.body?.documentType === 'string' ? req.body.documentType : 'id_card';
    const documentNumber = typeof req.body?.documentNumber === 'string' ? req.body.documentNumber.trim() : (typeof req.body?.cnicNumber === 'string' ? req.body.cnicNumber.trim() : (typeof req.body?.cnic === 'string' ? req.body.cnic.trim() : undefined));
    const documentFrontUrl = typeof req.body?.documentFrontUrl === 'string' ? req.body.documentFrontUrl : (typeof req.body?.frontImage === 'string' ? req.body.frontImage : undefined);
    const documentBackUrl = typeof req.body?.documentBackUrl === 'string' ? req.body.documentBackUrl : (typeof req.body?.backImage === 'string' ? req.body.backImage : undefined);

    // 1. Create live verification session with approved KYC identity provider (Shufti Pro / Sumsub / Manual Admin)
    const session = await KycProviderService.createVerificationSession({
      userId: x.userId,
      fullName,
      documentType: documentType as any,
    });

    if (session.status === 'not_started') {
      return res.status(502).json({
        ok: false,
        error: { code: 'KYC_PROVIDER_UNAVAILABLE', message: session.message || 'KYC provider could not start a verification session' },
      });
    }

    await requestKycSubmission(db, x.userId, {
      provider: session.provider,
      providerReference: session.referenceId,
      fullName,
      documentType,
      documentNumber,
      documentFrontUrl,
      documentBackUrl,
    });

    return res.status(202).json({
      ok: true,
      data: {
        status: session.status,
        provider: session.provider,
        referenceId: session.referenceId,
        verificationUrl: session.verificationUrl,
        sessionToken: session.sessionToken,
        message: session.message,
      },
    });
  } catch (e: any) {
    if (e?.message === 'KYC_ALREADY_VERIFIED') {
      return res.status(409).json({ ok: false, error: { code: 'KYC_ALREADY_VERIFIED' } });
    }
    return res.status(500).json({
      ok: false,
      error: { code: 'KYC_SUBMISSION_FAILED', message: e?.message || 'Failed to dispatch KYC session' },
    });
  }
}

export async function handleKycWebhook(req: Request, res: Response) {
  const provider = String(req.params.provider || 'shuftipro').toLowerCase();

  const verification = KycProviderService.verifyAndParseWebhook(provider, req.body, req.headers, (req as any).rawBody);
  if (!verification.ok) {
    const status = verification.code === 'INVALID_SIGNATURE' ? 401
      : verification.code === 'KYC_WEBHOOK_NOT_CONFIGURED' ? 503
      : 400;
    return res.status(status).json({ ok: false, error: { code: verification.code } });
  }
  const result = verification.result;

  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) return kycStoreUnavailable(res);

  try {
    const applied = await applyKycProviderDecision(db, result);
    console.log(`[KYC:WEBHOOK:PROCESSED] User: ${applied.userId} -> Status: ${applied.status}`);
    return res.json({ ok: true, status: applied.status, referenceId: result.referenceId });
  } catch (err: any) {
    if (err?.message === 'KYC_PROFILE_NOT_FOUND') {
      return res.status(404).json({ ok: false, error: { code: 'KYC_PROFILE_NOT_FOUND' } });
    }
    console.error('[KYC:DB_WEBHOOK_UPDATE_FAILED]', err?.message);
    return res.status(500).json({ ok: false, error: { code: 'KYC_WEBHOOK_UPDATE_FAILED' } });
  }
}

export async function getSecurity(req: Request, res: Response) {
  const x = ready(req, res);
  if (!x) return;
  if (!x.db) return securityStoreUnavailable(res);
  try { return res.json({ ok: true, data: await getSecurityOverview(x.db, x.userId) }); } catch { return res.status(500).json({ ok: false, error: { code: 'SECURITY_READ_FAILED' } }); }
}

export async function revokeOthers(req: Request, res: Response) {
  const x = ready(req, res);
  if (!x) return;
  const sessionId = (req.auth as { sessionId?: string } | undefined)?.sessionId;
  if (!sessionId) return res.status(401).json({ ok: false, error: { code: 'SESSION_INVALID' } });
  if (!x.db) return securityStoreUnavailable(res);
  try { return res.json({ ok: true, data: await revokeOtherSessions(x.db, x.userId, sessionId) }); } catch { return res.status(500).json({ ok: false, error: { code: 'SESSION_REVOCATION_FAILED' } }); }
}
