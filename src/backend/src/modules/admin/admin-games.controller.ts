import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import * as svc from './admin-games.service.js';
import { DEFAULT_GAMES } from '../games/catalog.service.js';

const DEFAULT_PROVIDERS = [
  { id: 'prov-1', name: 'Pragmatic Play', externalProviderId: 'pragmatic', status: 'active', isAuthorized: true, isFeatured: true, game_count: 4 },
  { id: 'prov-2', name: 'Spribe Gaming', externalProviderId: 'spribe', status: 'active', isAuthorized: true, isFeatured: true, game_count: 2 },
  { id: 'prov-3', name: 'Evolution Gaming', externalProviderId: 'evolution', status: 'active', isAuthorized: true, isFeatured: false, game_count: 1 },
  { id: 'prov-4', name: 'NetEnt Studios', externalProviderId: 'netent', status: 'active', isAuthorized: true, isFeatured: false, game_count: 1 },
];

function ctx(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const admin = (req as Request & { admin?: { userId: string } }).admin ?? { userId: 'admin' };
  return { db, admin };
}

function fail(res: Response, e: unknown) {
  const code = e instanceof Error ? e.message : 'ADMIN_GAME_PROVIDER_FAILED';
  const known = new Set(['PROVIDER_NOT_FOUND', 'GAME_NOT_FOUND', 'INVALID_PROVIDER_STATUS', 'INVALID_PROVIDER_AUTHORIZATION', 'INVALID_PROVIDER_FEATURED', 'INVALID_GAME_STATUS', 'INVALID_GAME_FLAG', 'INVALID_DISPLAY_ORDER']);
  return res.status(known.has(code) ? 400 : 500).json({ ok: false, error: { code, message: known.has(code) ? code : 'Admin game/provider operation failed' } });
}

export async function adminProviders(req: Request, res: Response) {
  const c = ctx(req, res);
  if (!c.db) return res.json({ ok: true, data: DEFAULT_PROVIDERS });
  try {
    return res.json({ ok: true, data: await svc.listAdminProviders(c.db) });
  } catch (e) {
    return fail(res, e);
  }
}

export async function adminGames(req: Request, res: Response) {
  const c = ctx(req, res);
  if (!c.db) {
    const games = DEFAULT_GAMES.map((g, idx) => ({
      ...g,
      displayOrder: idx + 1,
      providerName: g.providerId === 'prov-2' ? 'Spribe Gaming' : g.providerId === 'prov-3' ? 'Evolution Gaming' : g.providerId === 'prov-4' ? 'NetEnt Studios' : 'Pragmatic Play',
      providerStatus: 'active',
      providerAuthorized: true,
    }));
    return res.json({ ok: true, data: games });
  }
  try {
    return res.json({ ok: true, data: await svc.listAdminGames(c.db, req.query.q ? String(req.query.q) : undefined, req.query.providerId ? String(req.query.providerId) : undefined, req.query.status ? String(req.query.status) : undefined) });
  } catch (e) {
    return fail(res, e);
  }
}

export async function adminProviderUpdate(req: Request, res: Response) {
  const c = ctx(req, res);
  if (!c.db) {
    return res.json({ ok: true, data: { providerId: String(req.params.providerId), ...req.body } });
  }
  try {
    return res.json({ ok: true, data: await svc.updateProvider(c.db, c.admin.userId, String(req.params.providerId), { status: req.body?.status, isAuthorized: req.body?.isAuthorized, isFeatured: req.body?.isFeatured }) });
  } catch (e) {
    return fail(res, e);
  }
}

export async function adminGameUpdate(req: Request, res: Response) {
  const c = ctx(req, res);
  if (!c.db) {
    return res.json({ ok: true, data: { gameId: String(req.params.gameId), ...req.body } });
  }
  try {
    return res.json({ ok: true, data: await svc.updateGame(c.db, c.admin.userId, String(req.params.gameId), { status: req.body?.status, isHot: req.body?.isHot, isNew: req.body?.isNew, isFeatured: req.body?.isFeatured, displayOrder: req.body?.displayOrder }) });
  } catch (e) {
    return fail(res, e);
  }
}
