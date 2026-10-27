import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import type { AuthContext } from './auth.types.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext & { userId: string; sessionId: string };
      requestId?: string;
    }
  }
}

export function requestId(req: Request, _res: Response, next: NextFunction) {
  req.requestId = req.header('x-request-id') || crypto.randomUUID();
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.header('authorization');
  if (!token?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId: req.requestId } });
  }
  return next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const current = req.auth?.user.roles ?? [];
    if (!roles.some(role => current.includes(role))) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions', requestId: req.requestId } });
    }
    next();
  };
}
