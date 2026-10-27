import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import crypto from 'node:crypto';

// Weighted prize pool for Lucky Wheel
const WHEEL_PRIZES = [
  { prizePkr: 20, weight: 45, label: 'PKR 20' },
  { prizePkr: 50, weight: 30, label: 'PKR 50' },
  { prizePkr: 100, weight: 15, label: 'PKR 100' },
  { prizePkr: 250, weight: 7, label: 'PKR 250' },
  { prizePkr: 500, weight: 2.5, label: 'PKR 500' },
  { prizePkr: 1000, weight: 0.5, label: 'PKR 1,000' },
];

function rewardsStoreUnavailable(res: Response) {
  return res.status(503).json({ ok: false, error: { code: 'REWARDS_STORE_UNAVAILABLE', message: 'Rewards require the PostgreSQL database to be configured.' } });
}

function selectWheelPrize(): { prizePkr: number; label: string; sliceIndex: number } {
  const totalWeight = WHEEL_PRIZES.reduce((sum, p) => sum + p.weight, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < WHEEL_PRIZES.length; i++) {
    if (random < WHEEL_PRIZES[i].weight) {
      return { prizePkr: WHEEL_PRIZES[i].prizePkr, label: WHEEL_PRIZES[i].label, sliceIndex: i };
    }
    random -= WHEEL_PRIZES[i].weight;
  }
  return { prizePkr: 20, label: 'PKR 20', sliceIndex: 0 };
}

export async function getWheelStatus(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) return rewardsStoreUnavailable(res);

  const userId = String((req as any).auth?.userId || (req as any).user?.id || '').trim();
  if (!userId) return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED' } });

  try {
    const lastClaim = (await db.query<{ claimed_at: string }>(
      `SELECT claimed_at
         FROM reward_events
        WHERE user_id = $1 AND reward_type = 'daily_wheel'
        ORDER BY claimed_at DESC
        LIMIT 1`,
      [userId]
    )).rows[0];

    const now = Date.now();
    const cooldownMs = 24 * 3600 * 1000; // 24 hours

    if (!lastClaim) {
      return res.json({
        ok: true,
        data: {
          canSpin: true,
          remainingSeconds: 0,
          prizes: WHEEL_PRIZES.map((p) => p.label),
        },
      });
    }

    const lastTime = new Date(lastClaim.claimed_at).getTime();
    const elapsed = now - lastTime;

    if (elapsed >= cooldownMs) {
      return res.json({
        ok: true,
        data: {
          canSpin: true,
          remainingSeconds: 0,
          prizes: WHEEL_PRIZES.map((p) => p.label),
        },
      });
    }

    const remainingSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
    return res.json({
      ok: true,
      data: {
        canSpin: false,
        remainingSeconds,
        nextAvailableAt: new Date(lastTime + cooldownMs).toISOString(),
        prizes: WHEEL_PRIZES.map((p) => p.label),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'WHEEL_STATUS_FAILED', message: error?.message } });
  }
}

export async function spinLuckyWheel(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const userId = String((req as any).auth?.userId || (req as any).user?.id || '').trim();
  if (!userId) return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED' } });

  if (!db) return rewardsStoreUnavailable(res);

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Check 24h eligibility
      const lastClaim = (await tx.query<{ claimed_at: string }>(
        `SELECT claimed_at
           FROM reward_events
          WHERE user_id = $1 AND reward_type = 'daily_wheel'
          ORDER BY claimed_at DESC
          LIMIT 1 FOR UPDATE`,
        [userId]
      )).rows[0];

      const now = Date.now();
      const cooldownMs = 24 * 3600 * 1000;

      if (lastClaim) {
        const lastTime = new Date(lastClaim.claimed_at).getTime();
        if (now - lastTime < cooldownMs) {
          const remainingSec = Math.ceil((cooldownMs - (now - lastTime)) / 1000);
          throw new Error(`DAILY_SPIN_ALREADY_CLAIMED:${remainingSec}`);
        }
      }

      // 2. Select prize
      const prize = selectWheelPrize();
      const amountMinor = prize.prizePkr * 100;
      const eventId = crypto.randomUUID();

      // 3. Lock and credit wallet
      let wallet = (await tx.query<{ id: string; available_minor: string }>(
        `SELECT id, available_minor FROM wallet_accounts WHERE user_id = $1 AND currency = 'PKR' FOR UPDATE`,
        [userId]
      )).rows[0];

      if (!wallet) {
        wallet = (await tx.query<{ id: string; available_minor: string }>(
          `INSERT INTO wallet_accounts (user_id, currency, available_minor)
           VALUES ($1, 'PKR', 0)
           ON CONFLICT (user_id, currency) DO UPDATE SET updated_at = now()
           RETURNING id, available_minor`,
          [userId]
        )).rows[0];
      }

      await tx.query(
        `UPDATE wallet_accounts
            SET available_minor = available_minor + $1,
                version = version + 1,
                updated_at = now()
          WHERE id = $2`,
        [amountMinor, wallet.id]
      );

      // 4. Record in ledger_entries
      await tx.query(
        `INSERT INTO ledger_entries (
           wallet_account_id, entry_type, direction, amount_minor, currency, reference_type, reference_id, metadata
         ) VALUES ($1, 'daily_bonus', 'credit', $2, 'PKR', 'reward', $3, $4)`,
        [
          wallet.id,
          amountMinor,
          eventId,
          JSON.stringify({ rewardType: 'daily_wheel', prizePkr: prize.prizePkr }),
        ]
      );

      // 5. Record reward event
      await tx.query(
        `INSERT INTO reward_events (id, user_id, reward_type, source_id, status, claimed_at, metadata)
         VALUES ($1, $2, 'daily_wheel', $1, 'claimed', now(), $3)`,
        [eventId, userId, JSON.stringify({ prizePkr: prize.prizePkr, label: prize.label })]
      );

      return {
        prizePkr: prize.prizePkr,
        sliceIndex: prize.sliceIndex,
        label: prize.label,
        newBalancePkr: (Number(wallet.available_minor) + amountMinor) / 100,
      };
    });

    return res.json({ ok: true, data: result });
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.startsWith('DAILY_SPIN_ALREADY_CLAIMED:')) {
      const sec = msg.split(':')[1];
      return res.status(429).json({
        ok: false,
        error: { code: 'ALREADY_CLAIMED', message: `Daily spin already claimed! Next spin in ${Math.ceil(Number(sec) / 60)} minutes.` },
      });
    }
    return res.status(500).json({ ok: false, error: { code: 'SPIN_FAILED', message: msg } });
  }
}

