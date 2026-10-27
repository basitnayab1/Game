export interface ReconciliationRecord {
  providerName: string;
  providerReference: string;
  internalTransactionId: string;
  grossMinor: bigint;
  providerFeeMinor: bigint;
  platformShareMinor: bigint;
  netSettlementMinor: bigint;
  status: "matched" | "unmatched" | "under_review" | "resolved";
}

/**
 * Reconciliation compares internal records with authorized provider reports.
 * It must never silently alter historical customer ledger entries.
 */
