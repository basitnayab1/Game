import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { claimPromotion, listAvailablePromotions, openPromotionReward, listRewardCycles, openRewardCycle } from './rewards.service.js';

function user(req: Request) { return (req.auth as { userId?: string } | undefined)?.userId; }
function db(req: Request) { return (req.app.locals as { db?: DatabaseClient }).db; }
function fail(res: Response, e: unknown) {
  const code = e instanceof Error ? e.message : 'REWARDS_REQUEST_FAILED';
  const status = /NOT_AVAILABLE|EXPIRED|ALREADY|NOT_FOUND/.test(code) ? 409 : 500;
  return res.status(status).json({ ok: false, error: { code } });
}

function storeUnavailable(res: Response) {
  return res.status(503).json({ ok: false, error: { code: 'REWARDS_STORE_UNAVAILABLE', message: 'Rewards require the PostgreSQL database to be configured.' } });
}

export async function getPromotions(req: Request, res: Response) {
  const u = user(req), d = db(req);
  if (!u) return res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } });
  if (!d) return storeUnavailable(res);
  try { return res.json({ ok: true, data: await listAvailablePromotions(d, u) }); } catch (e) { return fail(res, e); }
}

export async function activatePromotion(req: Request, res: Response) {
  const u = user(req), d = db(req);
  if (!u) return res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } });
  if (!d) return storeUnavailable(res);
  try { return res.json({ ok: true, data: await claimPromotion(d, u, String(req.params.promotionId)) }); } catch (e) { return fail(res, e); }
}

export async function openPromotion(req: Request, res: Response) {
  const u = user(req), d = db(req);
  if (!u) return res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } });
  if (!d) return storeUnavailable(res);
  try { return res.json({ ok: true, data: await openPromotionReward(d, u, String(req.params.promotionId)) }); } catch (e) { return fail(res, e); }
}

export async function getCycles(req: Request, res: Response) {
  const u = user(req), d = db(req);
  if (!u) return res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } });
  if (!d) return storeUnavailable(res);
  try { return res.json({ ok: true, data: await listRewardCycles(d, u) }); } catch (e) { return fail(res, e); }
}

export async function openCycle(req: Request, res: Response) {
  const u = user(req), d = db(req);
  if (!u) return res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } });
  if (!d) return storeUnavailable(res);
  try { return res.json({ ok: true, data: await openRewardCycle(d, u, String(req.params.cycleId)) }); } catch (e) { return fail(res, e); }
}
