import { Request, Response, NextFunction } from 'express';
import { requestId } from '../utils/request-id';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const id = req.header('x-request-id') || requestId();
  res.setHeader('x-request-id', id);
  res.locals.requestId = id;
  next();
}
