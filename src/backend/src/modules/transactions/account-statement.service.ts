import type { DatabaseClient } from '../../core/database/database.types.js';
import { validateDateRange, type AccountStatementRequest, type AccountStatementSummary, type DepositHistoryItem, type WithdrawalHistoryItem, type AccountStatementResponse } from './account-statement-api.contract.js';

type SummaryRow = {
  total_deposit_minor: string | number;
  total_play_minor: string | number;
  total_withdrawal_minor: string | number;
  total_withdrawal_fee_minor: string | number;
  total_bonus_received_minor: string | number;
};

type DepositRow = {
  id: string;
  date: Date;
  amount_minor: string | number;
  method: string;
  status: string;
};

type WithdrawalRow = {
  id: string;
  date: Date;
  amount_minor: string | number;
  fee_minor: string | number;
  net_minor: string | number;
  method: string;
  status: string;
};

function asSafeNumber(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('STATEMENT_AMOUNT_OUT_OF_RANGE');
  return parsed;
}

/**
 * Read-only account statement. It derives totals from authoritative transaction
 * and withdrawal records; it never mutates wallet balances or ledger rows.
 * Date range is inclusive for both calendar dates (UTC day boundaries).
 */
export async function getAccountStatement(
  db: DatabaseClient,
  userId: string,
  request: AccountStatementRequest,
): Promise<AccountStatementResponse> {
  if (!userId?.trim()) throw new Error('USER_ID_REQUIRED');
  validateDateRange(request);

  const summary = await db.query<SummaryRow>(
    `WITH bounds AS (
       SELECT $2::date AS from_date, ($3::date + INTERVAL '1 day') AS to_exclusive
     ),
     tx AS (
       SELECT
         COALESCE(SUM(amount_minor) FILTER (WHERE type = 'deposit' AND status = 'confirmed'), 0) AS total_deposit_minor,
         COALESCE(SUM(amount_minor) FILTER (WHERE type = 'game' AND status = 'confirmed'), 0) AS total_play_minor,
         COALESCE(SUM(amount_minor) FILTER (WHERE type = 'bonus' AND status = 'confirmed'), 0) AS total_bonus_received_minor
       FROM transactions, bounds b
       WHERE user_id = $1
         AND currency = 'PKR'
         AND created_at >= b.from_date
         AND created_at < b.to_exclusive
     ),
     wd AS (
       SELECT
         COALESCE(SUM(w.amount_minor) FILTER (WHERE w.status = 'completed'), 0) AS total_withdrawal_minor,
         COALESCE(SUM(w.fee_minor) FILTER (WHERE w.status = 'completed'), 0) AS total_withdrawal_fee_minor
       FROM withdrawals w
       JOIN transactions t ON t.id = w.transaction_id
       CROSS JOIN bounds b
       WHERE t.user_id = $1
         AND t.currency = 'PKR'
         AND w.created_at >= b.from_date
         AND w.created_at < b.to_exclusive
     )
     SELECT tx.total_deposit_minor, tx.total_play_minor, wd.total_withdrawal_minor,
            wd.total_withdrawal_fee_minor, tx.total_bonus_received_minor
       FROM tx CROSS JOIN wd`,
    [userId, request.fromDate, request.toDate],
  );

  const deposits = await db.query<DepositRow>(
    `SELECT t.id, t.created_at AS date, t.amount_minor, d.method, t.status
       FROM transactions t
       JOIN deposits d ON d.transaction_id = t.id
      WHERE t.user_id = $1
        AND t.type = 'deposit'
        AND t.currency = 'PKR'
        AND t.created_at >= $2::date
        AND t.created_at < ($3::date + INTERVAL '1 day')
      ORDER BY t.created_at DESC`,
    [userId, request.fromDate, request.toDate],
  );

  const withdrawals = await db.query<WithdrawalRow>(
    `SELECT t.id, w.created_at AS date, w.amount_minor, w.fee_minor, w.net_minor,
            COALESCE(pm.method_type, 'unknown') AS method, w.status
       FROM transactions t
       JOIN withdrawals w ON w.transaction_id = t.id
       LEFT JOIN payment_methods pm ON pm.id = w.payment_method_id
      WHERE t.user_id = $1
        AND t.type = 'withdrawal'
        AND t.currency = 'PKR'
        AND w.status IN ('completed', 'reversed')
        AND w.created_at >= $2::date
        AND w.created_at < ($3::date + INTERVAL '1 day')
      ORDER BY w.created_at DESC`,
    [userId, request.fromDate, request.toDate],
  );

  const row = summary.rows[0] ?? {
    total_deposit_minor: 0,
    total_play_minor: 0,
    total_withdrawal_minor: 0,
    total_withdrawal_fee_minor: 0,
    total_bonus_received_minor: 0,
  };

  const summaryValue: AccountStatementSummary = {
    currency: 'PKR',
    totalDepositMinor: asSafeNumber(row.total_deposit_minor),
    totalPlayMinor: asSafeNumber(row.total_play_minor),
    totalWithdrawalMinor: asSafeNumber(row.total_withdrawal_minor),
    totalWithdrawalFeeMinor: asSafeNumber(row.total_withdrawal_fee_minor),
    totalBonusReceivedMinor: asSafeNumber(row.total_bonus_received_minor),
  };

  const depositItems: DepositHistoryItem[] = deposits.rows.map((item) => ({
    id: item.id,
    date: item.date.toISOString(),
    amountMinor: asSafeNumber(item.amount_minor),
    method: item.method,
    status: item.status,
  }));

  const withdrawalItems: WithdrawalHistoryItem[] = withdrawals.rows.map((item) => ({
    id: item.id,
    date: item.date.toISOString(),
    amountMinor: asSafeNumber(item.amount_minor),
    feeMinor: asSafeNumber(item.fee_minor),
    netMinor: asSafeNumber(item.net_minor),
    method: item.method,
    status: item.status,
  }));

  return { summary: summaryValue, deposits: depositItems, withdrawals: withdrawalItems };
}
