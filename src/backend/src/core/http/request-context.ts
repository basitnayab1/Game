import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = req.header('x-request-id') || randomUUID();
  res.setHeader('x-request-id', requestId);
  (req as Request & { requestId?: string }).requestId = requestId;
  next();
}
