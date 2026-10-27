import type { DatabaseClient } from '../../core/database/database.types.js';
import type { GameRecord } from './game.types.js';

export async function getFavorites(db: DatabaseClient, userId: string): Promise<GameRecord[]> {
  const r = await db.query<GameRecord>(`SELECT g.id, g.provider_id AS "providerId", g.external_game_id AS "externalGameId", g.name,
    g.category, g.status, g.artwork_url AS "artworkUrl", g.is_hot AS "isHot", g.is_new AS "isNew"
    FROM favorites f JOIN games g ON g.id=f.game_id JOIN game_providers p ON p.id=g.provider_id
    WHERE f.user_id=$1 AND g.status='active' AND p.status='active'
    ORDER BY f.created_at DESC`, [userId]);
  return r.rows;
}

export async function setFavorite(db: DatabaseClient, userId: string, gameId: string, favorite: boolean): Promise<void> {
  if (favorite) {
    await db.query(`INSERT INTO favorites(user_id, game_id) SELECT $1,$2 WHERE EXISTS
      (SELECT 1 FROM games g JOIN game_providers p ON p.id=g.provider_id WHERE g.id=$2 AND g.status='active' AND p.status='active')
      ON CONFLICT (user_id,game_id) DO NOTHING`, [userId, gameId]);
  } else {
    await db.query(`DELETE FROM favorites WHERE user_id=$1 AND game_id=$2`, [userId, gameId]);
  }
}

export async function getRecentlyPlayed(db: DatabaseClient, userId: string): Promise<GameRecord[]> {
  const r = await db.query<GameRecord>(`SELECT g.id, g.provider_id AS "providerId", g.external_game_id AS "externalGameId", g.name,
    g.category, g.status, g.artwork_url AS "artworkUrl", g.is_hot AS "isHot", g.is_new AS "isNew"
    FROM recently_played_games r JOIN games g ON g.id=r.game_id JOIN game_providers p ON p.id=g.provider_id
    WHERE r.user_id=$1 AND g.status='active' AND p.status='active'
    ORDER BY r.last_played_at DESC LIMIT 50`, [userId]);
  return r.rows;
}
