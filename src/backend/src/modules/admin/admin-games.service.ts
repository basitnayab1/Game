import type { DatabaseClient } from '../../core/database/database.types.js';

const PROVIDER_STATUSES = new Set(['active','inactive']);
const GAME_STATUSES = new Set(['active','inactive']);

export async function listAdminProviders(db: DatabaseClient) {
  const r = await db.query(`
    SELECT p.id,p.name,p.external_provider_id AS "externalProviderId",p.status,
           p.is_authorized AS "isAuthorized",p.is_featured AS "isFeatured",
           COUNT(g.id)::int AS game_count
    FROM game_providers p
    LEFT JOIN games g ON g.provider_id=p.id
    GROUP BY p.id
    ORDER BY p.name ASC`);
  return r.rows;
}

export async function listAdminGames(db: DatabaseClient, query?: string, providerId?: string, status?: string) {
  const values: unknown[] = [];
  const where: string[] = [];
  if (query?.trim()) { values.push(`%${query.trim()}%`); where.push(`(g.name ILIKE $${values.length} OR g.external_game_id ILIKE $${values.length})`); }
  if (providerId?.trim()) { values.push(providerId.trim()); where.push(`g.provider_id=$${values.length}`); }
  if (status && GAME_STATUSES.has(status)) { values.push(status); where.push(`g.status=$${values.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const r = await db.query(`
    SELECT g.id,g.provider_id AS "providerId",g.external_game_id AS "externalGameId",g.name,g.category,
           g.status,g.artwork_url AS "artworkUrl",g.is_hot AS "isHot",g.is_new AS "isNew",
           g.is_featured AS "isFeatured",g.display_order AS "displayOrder",
           p.name AS "providerName",p.status AS "providerStatus",p.is_authorized AS "providerAuthorized"
    FROM games g JOIN game_providers p ON p.id=g.provider_id
    ${clause}
    ORDER BY g.display_order ASC,g.name ASC LIMIT 500`, values);
  return r.rows;
}

export async function updateProvider(db: DatabaseClient, actorId: string, providerId: string, input: {status?: string; isAuthorized?: boolean; isFeatured?: boolean}) {
  if (input.status !== undefined && !PROVIDER_STATUSES.has(input.status)) throw new Error('INVALID_PROVIDER_STATUS');
  if (input.isAuthorized !== undefined && typeof input.isAuthorized !== 'boolean') throw new Error('INVALID_PROVIDER_AUTHORIZATION');
  if (input.isFeatured !== undefined && typeof input.isFeatured !== 'boolean') throw new Error('INVALID_PROVIDER_FEATURED');
  return db.transaction(async tx => {
    const r = await tx.query(`UPDATE game_providers SET status=COALESCE($2,status),is_authorized=COALESCE($3,is_authorized),is_featured=COALESCE($4,is_featured),updated_at=now() WHERE id=$1 RETURNING id,name,status,is_authorized AS "isAuthorized",is_featured AS "isFeatured"`, [providerId,input.status ?? null,input.isAuthorized ?? null,input.isFeatured ?? null]);
    if (!r.rows[0]) throw new Error('PROVIDER_NOT_FOUND');
    await tx.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'admin.provider.update','game_provider',$2,$3::jsonb)`, [actorId,providerId,JSON.stringify(input)]);
    return r.rows[0];
  });
}

export async function updateGame(db: DatabaseClient, actorId: string, gameId: string, input: {status?: string; isHot?: boolean; isNew?: boolean; isFeatured?: boolean; displayOrder?: number}) {
  if (input.status !== undefined && !GAME_STATUSES.has(input.status)) throw new Error('INVALID_GAME_STATUS');
  for (const [k,v] of Object.entries(input)) if (['isHot','isNew','isFeatured'].includes(k) && typeof v !== 'boolean') throw new Error('INVALID_GAME_FLAG');
  if (input.displayOrder !== undefined && (!Number.isInteger(input.displayOrder) || input.displayOrder < 0 || input.displayOrder > 100000)) throw new Error('INVALID_DISPLAY_ORDER');
  return db.transaction(async tx => {
    const r = await tx.query(`UPDATE games SET status=COALESCE($2,status),is_hot=COALESCE($3,is_hot),is_new=COALESCE($4,is_new),is_featured=COALESCE($5,is_featured),display_order=COALESCE($6,display_order),updated_at=now() WHERE id=$1 RETURNING id,name,status,is_hot AS "isHot",is_new AS "isNew",is_featured AS "isFeatured",display_order AS "displayOrder"`, [gameId,input.status ?? null,input.isHot ?? null,input.isNew ?? null,input.isFeatured ?? null,input.displayOrder ?? null]);
    if (!r.rows[0]) throw new Error('GAME_NOT_FOUND');
    await tx.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'admin.game.update','game',$2,$3::jsonb)`, [actorId,gameId,JSON.stringify(input)]);
    return r.rows[0];
  });
}
