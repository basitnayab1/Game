import type { DatabaseClient } from '../../core/database/database.types.js';
import type { GameRecord } from './game.types.js';

export type GameCatalogQuery = { q?: string; category?: string; providerId?: string; favoritesOnly?: boolean };

export const DEFAULT_GAMES: GameRecord[] = [
  { id: 'game-1', providerId: 'prov-1', externalGameId: 'gates-olympus', name: 'Gates of Olympus', category: 'Slots', status: 'active', artworkUrl: undefined, isHot: true, isNew: false },
  { id: 'game-2', providerId: 'prov-2', externalGameId: 'aviator', name: 'Aviator', category: 'Crash', status: 'active', artworkUrl: undefined, isHot: true, isNew: false },
  { id: 'game-3', providerId: 'prov-1', externalGameId: 'sweet-bonanza', name: 'Sweet Bonanza', category: 'Slots', status: 'active', artworkUrl: undefined, isHot: true, isNew: false },
  { id: 'game-4', providerId: 'prov-3', externalGameId: 'crazy-time', name: 'Crazy Time', category: 'Live Casino', status: 'active', artworkUrl: undefined, isHot: true, isNew: false },
  { id: 'game-5', providerId: 'prov-1', externalGameId: 'mega-roulette', name: 'Mega Roulette', category: 'Live Casino', status: 'active', artworkUrl: undefined, isHot: false, isNew: true },
  { id: 'game-6', providerId: 'prov-4', externalGameId: 'blackjack', name: 'Blackjack Classic', category: 'Cards', status: 'active', artworkUrl: undefined, isHot: false, isNew: false },
  { id: 'game-7', providerId: 'prov-2', externalGameId: 'spaceman', name: 'Spaceman', category: 'Crash', status: 'active', artworkUrl: undefined, isHot: false, isNew: true },
  { id: 'game-8', providerId: 'prov-1', externalGameId: 'fortune-tiger', name: 'Fortune Tiger', category: 'Slots', status: 'active', artworkUrl: undefined, isHot: true, isNew: false },
];

export async function getGameCatalog(db: DatabaseClient | undefined, query: GameCatalogQuery): Promise<GameRecord[]> {
  if (!db) return DEFAULT_GAMES;
  try {
    const values: unknown[] = [];
    const where = ["g.status = 'active'", "p.status = 'active'"];
    if (query.q?.trim()) { values.push(`%${query.q.trim().slice(0, 80)}%`); where.push(`(g.name ILIKE $${values.length} OR p.name ILIKE $${values.length})`); }
    if (query.category?.trim() && query.category !== 'All') { values.push(query.category.trim()); where.push(`g.category = $${values.length}`); }
    if (query.providerId?.trim()) { values.push(query.providerId.trim()); where.push(`g.provider_id = $${values.length}`); }
    const result = await db.query<GameRecord>(
      `SELECT g.id, g.provider_id AS "providerId", g.external_game_id AS "externalGameId", g.name,
              g.category, g.status, g.artwork_url AS "artworkUrl", g.is_hot AS "isHot", g.is_new AS "isNew"
         FROM games g JOIN game_providers p ON p.id = g.provider_id
        WHERE ${where.join(' AND ')} ORDER BY g.is_hot DESC, g.is_new DESC, g.name ASC LIMIT 200`, values);
    return result.rows.length > 0 ? result.rows : DEFAULT_GAMES;
  } catch {
    return DEFAULT_GAMES;
  }
}
