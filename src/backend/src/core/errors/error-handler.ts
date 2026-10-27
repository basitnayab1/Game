import { Request, Response, NextFunction } from 'express';
import { AppError } from './app-error';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const e = err instanceof AppError ? err : new AppError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  if (e.status >= 500) console.error({ requestId: req.requestId, error: err });
  return res.status(e.status).json({ error: { code: e.code, message: e.message, details: e.details, requestId: req.requestId } });
}
