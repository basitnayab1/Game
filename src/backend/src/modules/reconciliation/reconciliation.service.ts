export type ReconciliationStatus = 'MATCHED' | 'UNMATCHED' | 'UNDER_REVIEW' | 'RESOLVED';

export interface ReconciliationItem {
  internalReference: string;
  providerReference?: string;
  internalAmountMinor: bigint;
  providerAmountMinor?: bigint;
  status: ReconciliationStatus;
  differenceMinor?: bigint;
}

export type ReconciliationAction =
  | 'NO_ACTION'
  | 'REVIEW'
  | 'RECORD_PROVIDER_RESULT'
  | 'RECORD_REVERSAL_PENDING'
  | 'RECORD_REVERSAL_APPLIED';

export interface ReconciliationDecision {
  status: ReconciliationStatus;
  action: ReconciliationAction;
  reason: string;
}

export function compareAmounts(
  internalAmountMinor: bigint,
  providerAmountMinor: bigint,
  internalReference = '',
  providerReference?: string,
): ReconciliationItem {
  const differenceMinor = internalAmountMinor - providerAmountMinor;
  return {
    internalReference,
    providerReference,
    internalAmountMinor,
    providerAmountMinor,
    status: differenceMinor === 0n ? 'MATCHED' : 'UNMATCHED',
    differenceMinor,
  };
}

/**
 * Pure reconciliation decision. It never mutates a wallet or ledger.
 * Any actual reversal must be a separate, authenticated, idempotent ledger action.
 */
export function decideReconciliation(
  providerStatus: 'SUCCESS' | 'FAILED' | 'REVERSED' | 'PENDING',
  comparison: ReconciliationItem,
  reversalAlreadyRecorded: boolean,
): ReconciliationDecision {
  if (providerStatus === 'SUCCESS' && comparison.status === 'MATCHED') {
    return { status: 'MATCHED', action: 'NO_ACTION', reason: 'provider result matches internal record' };
  }

  if (providerStatus === 'PENDING') {
    return { status: 'UNDER_REVIEW', action: 'REVIEW', reason: 'provider outcome is not final' };
  }

  if (providerStatus === 'FAILED') {
    return {
      status: comparison.status === 'MATCHED' ? 'RESOLVED' : 'UNDER_REVIEW',
      action: 'RECORD_PROVIDER_RESULT',
      reason: comparison.status === 'MATCHED' ? 'provider failure recorded consistently' : 'failed provider result does not match internal record',
    };
  }

  if (providerStatus === 'REVERSED') {
    if (reversalAlreadyRecorded) {
      return { status: 'RESOLVED', action: 'NO_ACTION', reason: 'reversal already recorded; duplicate callback ignored' };
    }
    return { status: 'UNDER_REVIEW', action: 'RECORD_REVERSAL_PENDING', reason: 'reversal requires an authenticated idempotent ledger adjustment' };
  }

  return { status: 'UNDER_REVIEW', action: 'REVIEW', reason: 'unrecognized reconciliation state' };
}

import type { DatabaseClient } from '../../core/database/database.types.js';

export interface WalletReconciliationAudit {
  walletAccountId: string;
  matched: boolean;
  availableMinor: bigint;
  lockedMinor: bigint;
  totalWalletFunds: bigint;
  netLedgerMinor: bigint;
  activeWithdrawalsMinor: bigint;
  discrepancies: string[];
}

export async function auditWalletReconciliation(
  db: DatabaseClient,
  walletAccountId: string
): Promise<WalletReconciliationAudit> {
  const walletRes = await db.query<{ id: string; available_minor: string; locked_minor: string }>(
    `SELECT id, available_minor, locked_minor FROM wallet_accounts WHERE id = $1`,
    [walletAccountId]
  );
  if (walletRes.rows.length === 0) {
    throw new Error(`Wallet account ${walletAccountId} not found.`);
  }

  const wallet = walletRes.rows[0];
  const availableMinor = BigInt(wallet.available_minor);
  const lockedMinor = BigInt(wallet.locked_minor);
  const totalWalletFunds = availableMinor + lockedMinor;

  // 1. Calculate sum of credits and debits from ledger_entries
  const ledgerRes = await db.query<{ direction: string; sum: string }>(
    `SELECT direction, COALESCE(SUM(amount_minor), 0) AS sum
       FROM ledger_entries
      WHERE wallet_account_id = $1
      GROUP BY direction`,
    [walletAccountId]
  );

  let totalCredit = 0n;
  let totalDebit = 0n;
  for (const row of ledgerRes.rows) {
    if (row.direction === 'credit') totalCredit = BigInt(row.sum);
    if (row.direction === 'debit') totalDebit = BigInt(row.sum);
  }
  const netLedgerMinor = totalCredit - totalDebit;

  // 2. Calculate sum of actively locked/pending withdrawals
  const wdRes = await db.query<{ sum: string }>(
    `SELECT COALESCE(SUM(w.amount_minor), 0) AS sum
       FROM withdrawals w
       JOIN transactions t ON t.id = w.transaction_id
      WHERE t.wallet_account_id = $1
        AND w.status IN ('pending', 'under_review', 'approved', 'processing')`,
    [walletAccountId]
  );
  const activeWithdrawalsMinor = BigInt(wdRes.rows[0]?.sum || '0');

  const discrepancies: string[] = [];

  // Invariant 1: locked_minor in wallet must equal sum of active held withdrawals
  if (lockedMinor !== activeWithdrawalsMinor) {
    discrepancies.push(
      `Locked balance mismatch: wallet has ${lockedMinor.toString()} minor, but active withdrawals sum to ${activeWithdrawalsMinor.toString()} minor.`
    );
  }

  // Invariant 2: total wallet funds (available + locked) must equal net ledger balance
  if (totalWalletFunds !== netLedgerMinor) {
    discrepancies.push(
      `Ledger net mismatch: wallet total funds (available + locked) is ${totalWalletFunds.toString()} minor, but ledger net is ${netLedgerMinor.toString()} minor.`
    );
  }

  return {
    walletAccountId,
    matched: discrepancies.length === 0,
    availableMinor,
    lockedMinor,
    totalWalletFunds,
    netLedgerMinor,
    activeWithdrawalsMinor,
    discrepancies,
  };
}
