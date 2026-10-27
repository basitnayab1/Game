import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import * as svc from './admin-vip.service.js';

const devVipLevels = [
  { level: 1, name: 'Bronze', tier: 'bronze', progressTargetMinor: 100000, dailySalaryMinor: 1000, monthlySalaryMinor: 30000, nextLevelBonusMinor: 5000, benefits: ['Daily Check-in', '1% Cashback'], active: true },
  { level: 2, name: 'Silver', tier: 'silver', progressTargetMinor: 500000, dailySalaryMinor: 2500, monthlySalaryMinor: 75000, nextLevelBonusMinor: 15000, benefits: ['Fast Withdrawals', '2% Cashback'], active: true },
  { level: 3, name: 'Gold', tier: 'gold', progressTargetMinor: 2000000, dailySalaryMinor: 10000, monthlySalaryMinor: 300000, nextLevelBonusMinor: 50000, benefits: ['VIP Support', '3% Cashback'], active: true },
  { level: 4, name: 'Platinum', tier: 'platinum', progressTargetMinor: 10000000, dailySalaryMinor: 50000, monthlySalaryMinor: 1500000, nextLevelBonusMinor: 200000, benefits: ['Personal Account Manager', '5% Cashback'], active: true },
  { level: 5, name: 'Diamond', tier: 'diamond', progressTargetMinor: 50000000, dailySalaryMinor: 250000, monthlySalaryMinor: 7500000, nextLevelBonusMinor: 1000000, benefits: ['Zero Fee Instant Cashout', '10% Cashback'], active: true },
];

function ctx(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const admin = (req as Request & { admin?: { userId: string } }).admin ?? { userId: 'admin' };
  return { db, admin };
}

function fail(res: Response, e: unknown) {
  const code = e instanceof Error ? e.message : 'ADMIN_VIP_FAILED';
  const known = new Set(['INVALID_VIP_LEVEL', 'INVALID_VIP_NAME', 'INVALID_VIP_TIER', 'INVALID_VIP_ACTIVE', 'INVALID_VIP_AMOUNT', 'INVALID_VIP_BENEFITS', 'VIP_LEVEL_NOT_FOUND']);
  return res.status(known.has(code) ? 400 : 500).json({ ok: false, error: { code } });
}

export async function adminVipLevels(req: Request, res: Response) {
  const c = ctx(req, res);
  if (!c.db) return res.json({ ok: true, data: devVipLevels });
  try {
    return res.json({ ok: true, data: await svc.listAdminVipLevels(c.db) });
  } catch (e) {
    return fail(res, e);
  }
}

export async function adminVipLevelUpdate(req: Request, res: Response) {
  const c = ctx(req, res);
  const lvlNum = Number(String(req.params.level));
  if (!c.db) {
    const idx = devVipLevels.findIndex((l) => l.level === lvlNum);
    if (idx >= 0) {
      devVipLevels[idx] = { ...devVipLevels[idx], ...req.body };
      return res.json({ ok: true, data: devVipLevels[idx] });
    }
    return res.status(404).json({ ok: false, error: { code: 'VIP_LEVEL_NOT_FOUND' } });
  }
  try {
    return res.json({ ok: true, data: await svc.updateAdminVipLevel(c.db, c.admin.userId, lvlNum, req.body) });
  } catch (e) {
    return fail(res, e);
  }
}
