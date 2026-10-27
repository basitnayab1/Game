import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { getGameCatalog, DEFAULT_GAMES } from './catalog.service.js';

export async function getGameCatalogController(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  try {
    const data = await getGameCatalog(db, {
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      providerId: typeof req.query.providerId === 'string' ? req.query.providerId : undefined,
    });
    return res.json({ ok:true, data });
  } catch (_) {
    return res.json({ ok:true, data: DEFAULT_GAMES });
  }
}
