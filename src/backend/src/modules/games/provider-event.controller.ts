import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { handleGameProviderEvent } from './provider-event.service.js';

export async function receiveGameProviderEvent(req: Request, res: Response) {
  const db = req.app.locals.db as DatabaseClient | undefined;
  if (!db) return res.status(503).json({ ok: false, error: { code: 'DATABASE_NOT_CONFIGURED' } });
  const provider = String(req.params.provider || '').trim();
  const signature = String(req.header('x-provider-signature') || '').trim();
  const eventId = String(req.header('x-provider-event-id') || '').trim();
  const rawBody = String((req as any).rawBody || '');
  const eventType = String((req.body as any)?.type || '').trim() as any;
  const providerSessionId = String((req.body as any)?.providerSessionId || '').trim() || undefined;
  if (!provider || !signature || !eventId || !rawBody || !eventType) return res.status(400).json({ ok: false, error: { code: 'INVALID_PROVIDER_EVENT' } });
  if (!['SESSION_ACTIVE','SESSION_CLOSED','SESSION_EXPIRED','SESSION_FAILED'].includes(eventType)) return res.status(400).json({ ok: false, error: { code: 'UNSUPPORTED_PROVIDER_EVENT' } });
  try {
    const result = await handleGameProviderEvent(db, { provider, eventId, eventType, signature, rawBody, providerSessionId });
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'provider event rejected';
    if (message.includes('signature')) return res.status(401).json({ ok: false, error: { code: 'INVALID_PROVIDER_SIGNATURE' } });
    if (message.includes('provider not configured')) return res.status(503).json({ ok: false, error: { code: 'PROVIDER_NOT_CONFIGURED' } });
    return res.status(400).json({ ok: false, error: { code: 'PROVIDER_EVENT_REJECTED' } });
  }
}
