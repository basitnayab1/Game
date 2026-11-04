import type { DatabaseClient } from '../../core/database/database.types.js';

export type NotificationCategory = 'TRANSACTION' | 'PROMOTION' | 'SECURITY' | 'SYSTEM';

/** "1,000" or "1,000.50" from paisa. */
export function rupees(minor: bigint | number | string): string {
  const n = Number(minor) / 100;
  return n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
}

/**
 * Adds a message to the player's in-app notifications. Call it inside the same
 * transaction as the change it describes, so the two commit (or fail) together.
 */
export async function notifyUser(db: DatabaseClient, userId: string, category: NotificationCategory, title: string, body: string) {
  await db.query(
    `INSERT INTO notifications (user_id, category, title, body) VALUES ($1, $2, $3, $4)`,
    [userId, category, title.slice(0, 180), body],
  );
}

/** What the player receives for a withdrawal (after the platform fee). */
export async function withdrawalNetMinor(db: DatabaseClient, transactionId: string, fallbackMinor: bigint): Promise<bigint> {
  const r = await db.query<{ net_minor: string }>('SELECT net_minor FROM withdrawals WHERE transaction_id = $1', [transactionId]);
  return r.rows[0] ? BigInt(r.rows[0].net_minor) : fallbackMinor;
}
