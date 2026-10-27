import { randomUUID } from 'node:crypto';
import type { DatabaseClient } from '../../core/database/database.types.js';

export type GameSessionStatus = 'created' | 'active' | 'expired' | 'closed' | 'failed';

export async function recordGameSession(db: DatabaseClient, input: {
  userId: string; gameId: string; providerId: string; providerSessionId?: string;
  launchUrl?: string; expiresAt: string; status?: GameSessionStatus;
}) {
  const id = randomUUID();
  await db.query(`INSERT INTO game_sessions
    (id,user_id,game_id,provider_id,provider_session_id,status,launch_url,expires_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id,input.userId,input.gameId,input.providerId,input.providerSessionId ?? null,input.status ?? 'active',input.launchUrl ?? null,input.expiresAt]);
  await db.query(`INSERT INTO recently_played_games(user_id,game_id,last_played_at)
    VALUES ($1,$2,now()) ON CONFLICT (user_id,game_id) DO UPDATE SET last_played_at=EXCLUDED.last_played_at`,
    [input.userId,input.gameId]);
  return id;
}

export async function expireGameSessions(db: DatabaseClient, now = new Date()): Promise<number> {
  const r = await db.query(`UPDATE game_sessions SET status='expired', updated_at=now()
    WHERE status IN ('created','active') AND expires_at <= $1 RETURNING id`, [now.toISOString()]);
  return r.rows.length;
}
