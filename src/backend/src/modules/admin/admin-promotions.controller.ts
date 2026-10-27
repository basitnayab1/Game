import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import * as svc from './admin-promotions.service.js';

const devPromotions: any[] = [
  {
    id: 'promo-welcome-100',
    title: 'Welcome Bonus 100%',
    promotionType: 'deposit_match',
    status: 'active',
    startsAt: new Date(Date.now() - 86400000).toISOString(),
    endsAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    config: { matchPercent: 100, maxBonusMinor: 500000 },
  },
  {
    id: 'promo-cashback-10',
    title: 'Daily 10% Cashback',
    promotionType: 'cashback',
    status: 'active',
    startsAt: new Date(Date.now() - 86400000).toISOString(),
    endsAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    config: { cashbackPercent: 10 },
  },
];

const devRewardConfigs: any[] = [
  {
    id: 'reward-cfg-weekly',
    cycleType: 'weekly',
    title: 'Weekly Loyalty Reward',
    rewardConfig: { bonusMinor: 10000 },
    status: 'active',
  },
  {
    id: 'reward-cfg-monthly',
    cycleType: 'monthly',
    title: 'Monthly VIP Salary',
    rewardConfig: { bonusMinor: 50000 },
    status: 'active',
  },
];

function ctx(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const admin = (req as Request & { admin?: { userId: string } }).admin ?? { userId: 'admin' };
  return { db, admin };
}

function fail(res: Response, e: unknown) {
  const code = e instanceof Error ? e.message : 'ADMIN_PROMOTION_FAILED';
  const known = new Set(['INVALID_TITLE', 'INVALID_PROMOTION_TYPE', 'INVALID_PROMOTION_STATUS', 'INVALID_DATE_RANGE', 'INVALID_DATE', 'INVALID_CONFIG', 'PROMOTION_NOT_FOUND', 'INVALID_CYCLE_TYPE', 'INVALID_REWARD_STATUS']);
  return res.status(known.has(code) ? 400 : 500).json({ ok: false, error: { code } });
}

export async function adminPromotions(req: Request, res: Response) {
  const c = ctx(req, res);
  if (!c.db) return res.json({ ok: true, data: devPromotions });
  try {
    return res.json({ ok: true, data: await svc.listAdminPromotions(c.db) });
  } catch (e) {
    return fail(res, e);
  }
}

export async function adminPromotionUpsert(req: Request, res: Response) {
  const c = ctx(req, res);
  if (!c.db) {
    const promo = { id: req.body?.id || `promo-${Date.now()}`, ...req.body };
    const idx = devPromotions.findIndex((p) => p.id === promo.id);
    if (idx >= 0) devPromotions[idx] = promo;
    else devPromotions.push(promo);
    return res.json({ ok: true, data: promo });
  }
  try {
    return res.json({ ok: true, data: await svc.upsertAdminPromotion(c.db, c.admin.userId, req.body) });
  } catch (e) {
    return fail(res, e);
  }
}

export async function adminRewardConfigs(req: Request, res: Response) {
  const c = ctx(req, res);
  if (!c.db) return res.json({ ok: true, data: devRewardConfigs });
  try {
    return res.json({ ok: true, data: await svc.listRewardConfigs(c.db) });
  } catch (e) {
    return fail(res, e);
  }
}

export async function adminRewardConfigUpsert(req: Request, res: Response) {
  const c = ctx(req, res);
  if (!c.db) {
    const cfg = { id: req.body?.id || `reward-${Date.now()}`, ...req.body };
    const idx = devRewardConfigs.findIndex((r) => r.id === cfg.id);
    if (idx >= 0) devRewardConfigs[idx] = cfg;
    else devRewardConfigs.push(cfg);
    return res.json({ ok: true, data: cfg });
  }
  try {
    return res.json({ ok: true, data: await svc.upsertRewardConfig(c.db, c.admin.userId, req.body) });
  } catch (e) {
    return fail(res, e);
  }
}
