import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types';
import { env } from '../../config/env.js';
import crypto from 'node:crypto';

const SYMBOLS_POOL = [
  { symbol: '🍒', weight: 35, payout: 2 },
  { symbol: '🍋', weight: 25, payout: 3 },
  { symbol: '🍇', weight: 18, payout: 5 },
  { symbol: '🔔', weight: 12, payout: 10 },
  { symbol: '💎', weight: 7, payout: 25 },
  { symbol: '7️⃣', weight: 3, payout: 50 },
];

function getRandomSymbol(): string {
  const totalWeight = SYMBOLS_POOL.reduce((sum, s) => sum + s.weight, 0);
  let random = crypto.randomInt(0, totalWeight);
  for (const s of SYMBOLS_POOL) {
    if (random < s.weight) return s.symbol;
    random -= s.weight;
  }
  return '🍒';
}

function calculatePayout(reels: [string, string, string]): { multiplier: number; isJackpot: boolean } {
  const [s1, s2, s3] = reels;
  if (s1 === s2 && s2 === s3) {
    const matched = SYMBOLS_POOL.find((s) => s.symbol === s1);
    return { multiplier: matched?.payout ?? 2, isJackpot: s1 === '7️⃣' };
  }
  if ((s1 === s2 && s1 === '🍒') || (s2 === s3 && s2 === '🍒') || (s1 === s3 && s1 === '🍒')) {
    return { multiplier: 1.2, isJackpot: false };
  }
  if (s1 === '7️⃣' || s2 === '7️⃣' || s3 === '7️⃣') {
    return { multiplier: 0.5, isJackpot: false };
  }
  return { multiplier: 0, isJackpot: false };
}

export async function spinGameController(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) {
    return res.status(503).json({ ok: false, error: { code: 'DATABASE_NOT_CONFIGURED', message: 'Database not available' } });
  }

  const userId = (req.auth as { userId?: string } | undefined)?.userId;
  if (!userId) {
    return res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } });
  }

  const betMinor = Number(req.body.betMinor ?? 1000);
  if (isNaN(betMinor) || betMinor < 100 || betMinor > 500000) {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_BET_AMOUNT', message: 'Bet must be between 100 and 500,000 minor units (1 to 5,000 PKR)' } });
  }

  const headerSessionId = typeof req.header === 'function' ? req.header('x-game-session-id') : (req.headers ? (req.headers['x-game-session-id'] as string) : undefined);
  const sessionId = String(headerSessionId || req.body?.sessionId || '').trim() || null;
  const gameId = String(req.body?.gameId ?? '').trim();

  try {
    const outcome = await db.transaction(async (tx) => {
      // 1. Account restriction
      const userRow = (await tx.query<{ status: string }>('SELECT status FROM users WHERE id = $1', [userId])).rows[0];
      if (userRow && userRow.status !== 'active') {
        throw { statusCode: 403, code: 'ACCOUNT_RESTRICTED', message: 'Account is restricted or suspended from playing games.' };
      }

      // 2. Session validity check
      if (sessionId) {
        const isSessionUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);
        if (!isSessionUuid) {
          throw { statusCode: 400, code: 'SESSION_INVALID', message: 'Session ID format is invalid.' };
        }
        const sessRes = await tx.query<{ id: string; user_id: string; game_id: string; status: string; expires_at: string }>(
          `SELECT id, user_id, game_id, status, expires_at FROM game_sessions WHERE id = $1`,
          [sessionId]
        );
        const sess = sessRes.rows[0];
        if (!sess || sess.user_id !== userId) {
          throw { statusCode: 403, code: 'SESSION_INVALID', message: 'Game session is invalid or belongs to another user.' };
        }
        if (sess.status !== 'active' || new Date(sess.expires_at).getTime() <= Date.now()) {
          throw { statusCode: 403, code: 'SESSION_EXPIRED', message: 'Game session has expired. Please launch the game again.' };
        }
        if (gameId && sess.game_id !== gameId) {
          throw { statusCode: 400, code: 'SESSION_GAME_MISMATCH', message: 'Session does not match requested game.' };
        }
      }

      // 3. Game availability check
      if (gameId) {
        const isGameUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gameId);
        if (isGameUuid) {
          const gameRes = await tx.query<{ id: string; status: string }>(
            `SELECT id, status FROM games WHERE id = $1`,
            [gameId]
          );
          const gameRow = gameRes.rows[0];
          if (gameRow && gameRow.status !== 'active') {
            throw { statusCode: 400, code: 'GAME_NOT_AVAILABLE', message: 'Game is currently inactive.' };
          }
        }
      }

      const walletRes = await tx.query<{
        id: string;
        available_minor: string | number;
        currency: string;
      }>(
        `SELECT id, available_minor, currency
           FROM wallet_accounts
          WHERE user_id = $1
          FOR UPDATE`,
        [userId],
      );

      let wallet = walletRes.rows[0];
      if (!wallet) {
        const created = await tx.query<{ id: string; available_minor: string | number; currency: string }>(
          `INSERT INTO wallet_accounts (user_id, currency, available_minor, bonus_minor, locked_minor)
           VALUES ($1, 'PKR', 0, 0, 0)
           ON CONFLICT (user_id, currency) DO UPDATE SET updated_at = now()
           RETURNING id, available_minor, currency`,
          [userId],
        );
        wallet = created.rows[0];
      }

      const available = BigInt(wallet.available_minor);
      const bet = BigInt(betMinor);

      if (available < bet) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      const reels: [string, string, string] = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
      const { multiplier, isJackpot } = calculatePayout(reels);
      const winMinor = Math.floor(betMinor * multiplier);
      const winBigInt = BigInt(winMinor);

      const nextAvailable = available - bet + winBigInt;

      await tx.query(
        `UPDATE wallet_accounts
            SET available_minor = $1,
                version = version + 1,
                updated_at = now()
          WHERE id = $2`,
        [nextAvailable.toString(), wallet.id],
      );

      const isValidUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      const roundRefId = isValidUuid(gameId) ? gameId : null;
      const idempotencyBet = `bet-${userId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      await tx.query(
        `INSERT INTO ledger_entries
           (wallet_account_id, entry_type, direction, amount_minor, currency, reference_type, reference_id, idempotency_key, metadata)
         VALUES ($1, 'game_bet', 'debit', $2, 'PKR', 'game', $3, $4, $5::jsonb)`,
        [wallet.id, bet.toString(), roundRefId, idempotencyBet, JSON.stringify({ reels, betMinor, gameId })],
      );

      if (winMinor > 0) {
        const idempotencyWin = `win-${userId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        await tx.query(
          `INSERT INTO ledger_entries
             (wallet_account_id, entry_type, direction, amount_minor, currency, reference_type, reference_id, idempotency_key, metadata)
           VALUES ($1, 'game_win', 'credit', $2, 'PKR', 'game', $3, $4, $5::jsonb)`,
          [wallet.id, winBigInt.toString(), roundRefId, idempotencyWin, JSON.stringify({ reels, winMinor, multiplier, isJackpot, gameId })],
        );
      }

      return {
        reels,
        betMinor,
        winMinor,
        multiplier,
        isWin: winMinor > 0,
        isJackpot,
        newBalanceMinor: Number(nextAvailable),
        currency: wallet.currency,
      };
    });

    return res.status(200).json({ ok: true, data: outcome });
  } catch (error: any) {
    if (error && typeof error === 'object' && error.code && error.statusCode) {
      return res.status(error.statusCode || 400).json({
        ok: false,
        error: { code: error.code, message: error.message || error.code },
      });
    }
    const msg = error instanceof Error ? error.message : 'SPIN_FAILED';
    if (msg === 'ACCOUNT_RESTRICTED') {
      return res.status(403).json({ ok: false, error: { code: 'ACCOUNT_RESTRICTED', message: 'Account is restricted or suspended from playing games.' } });
    }
    if (msg === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ ok: false, error: { code: 'INSUFFICIENT_BALANCE', message: 'Not enough balance to place this bet. Please add funds.' } });
    }
    return res.status(500).json({ ok: false, error: { code: 'SPIN_ERROR', message: msg } });
  }
}

export async function claimTestBalanceController(req: Request, res: Response) {
  if (process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production') {
    return res.status(403).json({
      ok: false,
      error: { code: 'DEMO_FAUCET_DISABLED', message: 'Demo faucet is strictly disabled in production mode.' },
    });
  }

  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!db) {
    return res.status(503).json({ ok: false, error: { code: 'DATABASE_NOT_CONFIGURED' } });
  }

  const userId = (req.auth as { userId?: string } | undefined)?.userId;
  if (!userId) {
    return res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } });
  }

  const addAmount = 100000; // 1,000 PKR

  try {
    const updated = await db.transaction(async (tx) => {
      const walletRes = await tx.query<{ id: string; available_minor: string | number }>(
        `SELECT id, available_minor FROM wallet_accounts WHERE user_id = $1 FOR UPDATE`,
        [userId],
      );
      let wallet = walletRes.rows[0];
      if (!wallet) {
        const created = await tx.query<{ id: string; available_minor: string | number }>(
          `INSERT INTO wallet_accounts (user_id, currency, available_minor, bonus_minor, locked_minor)
           VALUES ($1, 'PKR', 0, 0, 0)
           RETURNING id, available_minor`,
          [userId],
        );
        wallet = created.rows[0];
      }

      const next = BigInt(wallet.available_minor) + BigInt(addAmount);
      await tx.query(
        `UPDATE wallet_accounts SET available_minor = $1, version = version + 1, updated_at = now() WHERE id = $2`,
        [next.toString(), wallet.id],
      );

      const idempotencyKey = `faucet-${userId}-${Date.now()}`;
      await tx.query(
        `INSERT INTO ledger_entries (wallet_account_id, entry_type, direction, amount_minor, currency, reference_type, idempotency_key, metadata)
         VALUES ($1, 'demo_faucet', 'credit', $2, 'PKR', 'promotion', $3, '{"reason":"demo_test_credits"}'::jsonb)`,
        [wallet.id, addAmount.toString(), idempotencyKey],
      );

      return Number(next);
    });

    return res.status(200).json({
      ok: true,
      data: {
        addedMinor: addAmount,
        addedPkr: addAmount / 100,
        newBalanceMinor: updated,
        newBalancePkr: updated / 100,
        currency: 'PKR',
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: { code: 'FAUCET_ERROR' } });
  }
}

