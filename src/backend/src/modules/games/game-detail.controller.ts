import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';

export async function getGameDetail(req: Request, res: Response) {
  const db = req.app.locals.db as DatabaseClient | undefined;
  if (!db) return res.status(503).json({ ok: false, error: { code: 'DATABASE_NOT_CONFIGURED', message: 'Game service is temporarily unavailable.' } });
  const gameId = String(req.params.gameId || '').trim();
  if (!gameId) return res.status(400).json({ ok: false, error: { code: 'GAME_ID_REQUIRED', message: 'Game id is required.' } });
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gameId);
  const whereGame = isUuid ? `(g.id::text = $1 OR g.external_game_id = $1)` : `g.external_game_id = $1`;
  const result = await db.query(
    `SELECT g.id, g.provider_id AS "providerId", g.name, g.category, g.artwork_url AS "artworkUrl",
            g.is_hot AS "isHot", g.is_new AS "isNew", p.name AS "providerName"
       FROM games g
       JOIN game_providers p ON p.id = g.provider_id
      WHERE ${whereGame} AND g.status = 'active' AND p.status = 'active'`,
    [gameId],
  );
  if (!result.rows[0]) return res.status(404).json({ ok: false, error: { code: 'GAME_NOT_AVAILABLE', message: 'Game is unavailable.' } });
  return res.json({ ok: true, data: result.rows[0] });
}
