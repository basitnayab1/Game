import { Request, Response, NextFunction } from 'express';

type Bucket = { count: number; resetAt: number };

/**
 * Small process-local guard for development/single-instance protection.
 * Production deployments must replace this with a shared Redis-backed limiter.
 */
export function createSensitiveRateLimiter(windowMs = 60_000, maxRequests = 10) {
  const buckets = new Map<string, Bucket>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip ?? 'unknown'}:${req.path}`;
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || now >= current.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (current.count >= maxRequests) {
      res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
        requestId: res.locals.requestId ?? 'unknown'
      });
    }
    current.count += 1;
    next();
  };
}
