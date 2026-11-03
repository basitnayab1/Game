import type { DatabaseClient } from '../../core/database/database.types.js';

/**
 * Server-side enforcement of the player's responsible-gaming controls.
 * Limits are daily (Pakistan time) and are checked before money moves.
 */

export type ResponsibleGamingBlock = { code: string; message: string; statusCode: 403 };

type Controls = {
  deposit_limit_minor: string | null;
  loss_limit_minor: string | null;
  break_until: string | null;
  excluded_until: string | null;
};

// Start of the current day in Pakistan time, where the players are.
const TODAY_START = `date_trunc('day', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi'`;

const block = (code: string, message: string): ResponsibleGamingBlock => ({ code, message, statusCode: 403 });

async function loadControls(db: DatabaseClient, userId: string): Promise<Controls | undefined> {
  return (await db.query<Controls>(
    `SELECT deposit_limit_minor, loss_limit_minor,
            CASE WHEN take_a_break_until > now() THEN take_a_break_until END AS break_until,
            CASE WHEN self_excluded_until > now() THEN self_excluded_until END AS excluded_until
       FROM responsible_gaming_controls WHERE user_id = $1`,
    [userId],
  )).rows[0];
}

function pauseBlock(c: Controls): ResponsibleGamingBlock | null {
  if (c.excluded_until) {
    return block('SELF_EXCLUDED', `You are self-excluded until ${new Date(c.excluded_until).toISOString().slice(0, 10)}.`);
  }
  if (c.break_until) {
    return block('TAKING_A_BREAK', `You are taking a break until ${new Date(c.break_until).toISOString().replace('T', ' ').slice(0, 16)} UTC.`);
  }
  return null;
}

/** Checks a bet (or a free reward) of [stakeMinor] against breaks, self-exclusion and the daily loss limit. */
export async function checkPlayAllowed(db: DatabaseClient, userId: string, stakeMinor = 0): Promise<ResponsibleGamingBlock | null> {
  const c = await loadControls(db, userId);
  if (!c) return null;
  const paused = pauseBlock(c);
  if (paused) return paused;
  if (c.loss_limit_minor !== null && stakeMinor > 0) {
    // Today's net loss: stakes minus winnings on this player's wallet.
    const lost = (await db.query<{ net: string }>(
      `SELECT COALESCE(SUM(CASE WHEN l.entry_type = 'game_bet' THEN l.amount_minor
                                WHEN l.entry_type = 'game_win' THEN -l.amount_minor ELSE 0 END), 0)::text AS net
         FROM ledger_entries l JOIN wallet_accounts w ON w.id = l.wallet_account_id
        WHERE w.user_id = $1 AND l.created_at >= ${TODAY_START}`,
      [userId],
    )).rows[0];
    if (BigInt(lost?.net ?? '0') + BigInt(stakeMinor) > BigInt(c.loss_limit_minor)) {
      return block('LOSS_LIMIT_REACHED', 'This bet would exceed your daily loss limit.');
    }
  }
  return null;
}

/** Checks a deposit of [amountMinor] against breaks, self-exclusion and the daily deposit limit. */
export async function checkDepositAllowed(db: DatabaseClient, userId: string, amountMinor: number): Promise<ResponsibleGamingBlock | null> {
  const c = await loadControls(db, userId);
  if (!c) return null;
  const paused = pauseBlock(c);
  if (paused) return paused;
  if (c.deposit_limit_minor !== null) {
    const today = (await db.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_minor), 0)::text AS total
         FROM transactions
        WHERE user_id = $1 AND type = 'deposit' AND status NOT IN ('failed', 'cancelled')
          AND created_at >= ${TODAY_START}`,
      [userId],
    )).rows[0];
    if (BigInt(today?.total ?? '0') + BigInt(amountMinor) > BigInt(c.deposit_limit_minor)) {
      return block('DEPOSIT_LIMIT_REACHED', 'This deposit would exceed your daily deposit limit.');
    }
  }
  return null;
}
