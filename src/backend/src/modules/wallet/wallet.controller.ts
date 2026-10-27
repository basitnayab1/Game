import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { requireWalletOwner } from './wallet-read.guard.js';

/**
 * Read-only authenticated wallet balance endpoint.
 * Returns the authenticated user's real wallet balance when DB is configured,
 * or fails closed with 503 WALLET_REPOSITORY_NOT_CONFIGURED when offline.
 */
export async function getMyWallet(req: Request, res: Response) {
  try {
    const auth = req.auth as { userId?: string; sessionId?: string } | undefined;
    const userId = auth?.userId;
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'AUTHENTICATION_REQUIRED' });
    }

    requireWalletOwner({ userId, sessionId: auth?.sessionId || '' });

    const db = (req.app.locals as { db?: DatabaseClient }).db;
    if (!db) {
      return res.status(503).json({
        ok: false,
        error: { code: 'WALLET_REPOSITORY_NOT_CONFIGURED', message: 'Wallet service is not configured' },
      });
    }

    const row = (await db.query<{
      id: string;
      available_minor: string;
      locked_minor: string;
      bonus_minor: string;
      currency: string;
    }>(
      `SELECT id, available_minor, locked_minor, bonus_minor, currency
         FROM wallet_accounts
        WHERE user_id = $1 AND currency = 'PKR'`,
      [userId],
    )).rows[0];

    if (!row) {
      return res.status(200).json({
        ok: true,
        data: {
          availableMinor: 0,
          lockedMinor: 0,
          bonusMinor: 0,
          currency: 'PKR',
          availablePkr: 0,
        },
      });
    }

    const availableMinor = Number(row.available_minor);
    const lockedMinor = Number(row.locked_minor);
    const bonusMinor = Number(row.bonus_minor);

    return res.status(200).json({
      ok: true,
      data: {
        id: row.id,
        availableMinor,
        lockedMinor,
        bonusMinor,
        currency: row.currency,
        availablePkr: availableMinor / 100,
      },
    });
  } catch (error) {
    return res.status(401).json({ ok: false, error: error instanceof Error ? error.message : 'AUTHENTICATION_REQUIRED' });
  }
}
