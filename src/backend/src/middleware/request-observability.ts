import { Request, Response, NextFunction } from 'express';

export function requestObservabilityMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const requestId = res.locals.requestId ?? 'unknown';
    // Structured, non-sensitive request telemetry. Never log bodies, tokens, passwords or payment data.
    process.stdout.write(JSON.stringify({
      event: 'http_request',
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Number(elapsedMs.toFixed(2))
    }) + '\n');
  });
  next();
}
