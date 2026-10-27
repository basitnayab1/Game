import { createHash } from 'node:crypto';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { getProvider } from './provider.registry.js';

type GameEventType = 'SESSION_ACTIVE' | 'SESSION_CLOSED' | 'SESSION_EXPIRED' | 'SESSION_FAILED';

function mapStatus(type: GameEventType): 'active' | 'closed' | 'expired' | 'failed' {
  const statuses: Record<GameEventType, 'active' | 'closed' | 'expired' | 'failed'> = {
    SESSION_ACTIVE: 'active',
    SESSION_CLOSED: 'closed',
    SESSION_EXPIRED: 'expired',
    SESSION_FAILED: 'failed',
  };
  return statuses[type];
}

export async function handleGameProviderEvent(
  db: DatabaseClient,
  input: { provider: string; eventId: string; eventType: GameEventType; signature: string; rawBody: string; providerSessionId?: string },
) {
  const adapter = getProvider(input.provider);
  if (!adapter.verifyWebhook(input.signature, input.rawBody)) {
    throw new Error('provider webhook signature invalid');
  }
  const payloadHash = createHash('sha256').update(input.rawBody).digest('hex');
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO provider_webhook_events(provider,event_id,event_type,signature_verified,payload_hash,state)
     VALUES ($1,$2,$3,true,$4,'RECEIVED')
     ON CONFLICT (provider,event_id) DO NOTHING RETURNING id`,
    [input.provider, input.eventId, input.eventType, payloadHash],
  );
  if (!inserted.rows[0]) return { duplicate: true, sessionUpdated: false };

  let sessionUpdated = false;
  if (input.providerSessionId) {
    const updated = await db.query(
      `UPDATE game_sessions SET status=$1, updated_at=now()
       WHERE provider_id=(SELECT id FROM game_providers WHERE external_provider_id=$2 OR id::text=$2 LIMIT 1)
         AND provider_session_id=$3
         AND status IN ('created','active')`,
      [mapStatus(input.eventType), input.provider, input.providerSessionId],
    );
    sessionUpdated = updated.rows.length > 0;
  }
  await db.query(`UPDATE provider_webhook_events SET state='PROCESSED', processed_at=now() WHERE id=$1`, [inserted.rows[0].id]);
  return { duplicate: false, sessionUpdated };
}
