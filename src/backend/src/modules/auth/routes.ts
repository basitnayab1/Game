import {Router, type Request, type Response} from 'express';
import {z} from 'zod';
import * as svc from './service.js';
import {requireAuth, type AuthRequest} from '../../middleware/auth.js';
import {createSensitiveRateLimiter} from '../../middleware/sensitive-rate-limit.js';
import type {DatabaseClient} from '../../core/database/database.types.js';

export const authRouter = Router();
const authLimiter = createSensitiveRateLimiter(60_000, 10);
const register = z.object({phone: z.string().min(7).max(20), dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), password: z.string().min(8).max(128), referralCode: z.string().max(64).optional(), countryCode: z.string().length(2).optional()});
// `phone` also accepts an admin username.
const login = z.object({phone: z.string().trim().min(4).max(32), password: z.string().min(8)});

function database(req: Request, res: Response): DatabaseClient | null {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) {
    res.status(503).json({error: 'AUTH_STORE_UNAVAILABLE', message: 'Authentication requires the PostgreSQL database to be configured.'});
    return null;
  }
  return db;
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
    } else if (e.message === 'INVALID_REFERRAL_CODE') {
      res.status(400).json({error: 'INVALID_REFERRAL_CODE', message: 'This referral code does not exist.'});
    } else if (e.message === 'UNDERAGE' || e.message === 'INVALID_DOB') {
      res.status(400).json({error: e.message});
    } else if (e instanceof z.ZodError) {
      // Name the field that is wrong, so the app can say what to fix.
      const field = String(e.issues[0]?.path[0] ?? '');
      const code = ({phone: 'INVALID_PHONE', dob: 'INVALID_DOB', password: 'INVALID_PASSWORD'} as Record<string, string>)[field] ?? 'INVALID_REQUEST';
      res.status(400).json({error: code, message: e.issues[0]?.message});
    } else {
      console.error('[AUTH:REGISTRATION_FAILED]', e?.message);
      res.status(500).json({error: 'REGISTRATION_FAILED'});
    }
  }
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const db = database(req, res);
  if (!db) return;
  try {
    const x = login.parse(req.body);
    res.json(await svc.login(x.phone, x.password, db));
  } catch (e: any) {
    if (e instanceof svc.LoginLockedError) {
      res.setHeader('Retry-After', String(e.retryAfterSeconds));
      return res.status(429).json({
        error: 'LOGIN_LOCKED',
        retryAfterSeconds: e.retryAfterSeconds,
        message: `Too many wrong passwords. Try again in ${e.retryAfterSeconds} seconds.`,
      });
    }
    if (e instanceof svc.InvalidCredentialsError) {
      return res.status(401).json({error: 'LOGIN_FAILED', attemptsLeft: e.attemptsLeft});
    }
    if (!(e instanceof z.ZodError)) console.error('[AUTH:LOGIN]', e?.message);
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

authRouter.post('/change-password', requireAuth, authLimiter, async (req: AuthRequest, res) => {
  const db = database(req, res);
  if (!db) return;
  try {
    const x = z.object({currentPassword: z.string().min(1).max(128), newPassword: z.string().min(8).max(128)}).parse(req.body);
    await svc.changePassword(req.auth!.userId, req.auth!.sessionId, x.currentPassword, x.newPassword, db);
    res.status(204).send();
  } catch (e: any) {
    if (e instanceof svc.InvalidCredentialsError) return res.status(400).json({error: 'CURRENT_PASSWORD_WRONG'});
    if (e instanceof z.ZodError) return res.status(400).json({error: 'INVALID_REQUEST'});
    console.error('[AUTH:CHANGE_PASSWORD]', e?.message);
    res.status(500).json({error: 'CHANGE_PASSWORD_FAILED'});
  }
});

authRouter.post('/logout', requireAuth, async (req: AuthRequest, res) => {
  const db = database(req, res);
  if (!db) return;
  await svc.logout(req.auth!.sessionId, db);
  res.status(204).send();
});
