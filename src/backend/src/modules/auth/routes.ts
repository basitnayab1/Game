import {Router, type Request, type Response} from 'express';
import crypto from 'node:crypto';
import {z} from 'zod';
import * as svc from './service.js';
import {requireAuth, type AuthRequest} from '../../middleware/auth.js';
import {createSensitiveRateLimiter} from '../../middleware/sensitive-rate-limit.js';
import type {DatabaseClient} from '../../core/database/database.types.js';
import {env} from '../../config/env.js';

export const authRouter = Router();
const authLimiter = createSensitiveRateLimiter(60_000, 10);
const otpLimiter = createSensitiveRateLimiter(60_000, 5);
const statusLimiter = createSensitiveRateLimiter(60_000, 60);
const register = z.object({phone: z.string().min(7).max(20), dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), password: z.string().min(8).max(128)});
const login = z.object({phone: z.string().min(7), password: z.string().min(8)});

const OTP_ERROR_STATUS: Record<string, number> = {
  OTP_INVALID: 400,
  OTP_EXPIRED: 400,
  OTP_ALREADY_USED: 409,
  OTP_ATTEMPTS_EXCEEDED: 429,
  OTP_RATE_LIMITED: 429,
  ACCOUNT_NOT_FOUND: 404,
  ACCOUNT_RESTRICTED: 403,
};

function database(req: Request, res: Response): DatabaseClient | null {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) {
    res.status(503).json({error: 'AUTH_STORE_UNAVAILABLE', message: 'Authentication requires the PostgreSQL database to be configured.'});
    return null;
  }
  return db;
}

function sendOtpError(res: Response, e: any, fallback: string) {
  const code = e?.message && OTP_ERROR_STATUS[e.message] ? e.message : null;
  if (code) return res.status(OTP_ERROR_STATUS[code]).json({error: code});
  if (e instanceof z.ZodError) return res.status(400).json({error: 'INVALID_REQUEST'});
  console.error(`[AUTH:${fallback}]`, e?.message);
  return res.status(500).json({error: fallback});
}

authRouter.post('/register', authLimiter, async (req, res) => {
  const db = database(req, res);
  if (!db) return;
  try {
    const x = register.parse(req.body);
    res.status(201).json(await svc.register(x, db));
  } catch (e: any) {
    if (e.message === 'PHONE_ALREADY_REGISTERED') {
      res.status(409).json({
        error: 'PHONE_ALREADY_REGISTERED',
        message: 'This mobile number is already registered. Only 1 account is allowed per phone number.',
      });
    } else if (e instanceof z.ZodError) {
      res.status(400).json({error: 'INVALID_REQUEST', message: e.message});
    } else {
      sendOtpError(res, e, 'REGISTRATION_FAILED');
    }
  }
});

authRouter.post('/otp/request', otpLimiter, async (req, res) => {
  const db = database(req, res);
  if (!db) return;
  try {
    const p = z.object({phone: z.string().min(7)}).parse(req.body);
    res.json(await svc.requestOtp(p.phone, db));
  } catch (e) {
    sendOtpError(res, e, 'OTP_REQUEST_FAILED');
  }
});

authRouter.post('/otp/verify', otpLimiter, async (req, res) => {
  const db = database(req, res);
  if (!db) return;
  try {
    const p = z.object({challengeId: z.string().uuid(), code: z.string().length(6)}).parse(req.body);
    res.json(await svc.verifyOtp(p.challengeId, p.code, db));
  } catch (e) {
    sendOtpError(res, e, 'OTP_FAILED');
  }
});

authRouter.get('/otp/status', statusLimiter, async (req, res) => {
  const db = database(req, res);
  if (!db) return;
  try {
    const challengeId = z.string().uuid().parse(String(req.query.challengeId || ''));
    res.json(await svc.checkOtpStatus(challengeId, db));
  } catch (e) {
    sendOtpError(res, e, 'OTP_STATUS_FAILED');
  }
});

/**
 * Inbound WhatsApp messages forwarded by the WhatsApp gateway. Only the gateway
 * may call this: it must send the shared WHATSAPP_INBOUND_SECRET in x-webhook-secret.
 */
authRouter.post('/whatsapp/inbound', async (req, res) => {
  const secret = env.WHATSAPP_INBOUND_SECRET;
  if (!secret || secret.length < 16) {
    return res.status(503).json({error: 'WHATSAPP_INBOUND_NOT_CONFIGURED'});
  }
  const provided = Buffer.from(String(req.header('x-webhook-secret') || ''), 'utf8');
  const expected = Buffer.from(secret, 'utf8');
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return res.status(401).json({error: 'INVALID_WEBHOOK_SECRET'});
  }

  const db = database(req, res);
  if (!db) return;
  try {
    const from = String(req.body?.from || req.body?.sender || req.body?.phone || '');
    const text = String(req.body?.message || req.body?.text || req.body?.body || '');
    res.json(await svc.handleInboundWhatsAppVerification(from, text, db));
  } catch (e: any) {
    console.error('[AUTH:WHATSAPP_INBOUND]', e?.message);
    res.status(500).json({error: 'INBOUND_FAILED'});
  }
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const db = database(req, res);
  if (!db) return;
  try {
    const x = login.parse(req.body);
    res.json(await svc.login(x.phone, x.password, db));
  } catch (e: any) {
    if (e?.message === 'PHONE_NOT_VERIFIED') return res.status(403).json({error: 'PHONE_NOT_VERIFIED'});
    if (e?.message !== 'INVALID_CREDENTIALS' && !(e instanceof z.ZodError)) console.error('[AUTH:LOGIN]', e?.message);
    res.status(401).json({error: 'LOGIN_FAILED'});
  }
});

authRouter.post('/refresh', authLimiter, async (req, res) => {
  const db = database(req, res);
  if (!db) return;
  try {
    res.json(await svc.refresh(z.object({refreshToken: z.string()}).parse(req.body).refreshToken, db));
  } catch (e) {
    res.status(401).json({error: 'REFRESH_FAILED'});
  }
});

authRouter.post('/logout', requireAuth, async (req: AuthRequest, res) => {
  const db = database(req, res);
  if (!db) return;
  await svc.logout(req.auth!.sessionId, db);
  res.status(204).send();
});
