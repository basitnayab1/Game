export type TransactionStatus =
  | "pending" | "confirmed" | "failed" | "cancelled" | "reversed" | "locked";

export type TransactionType = "deposit" | "withdrawal" | "bonus" | "game" | "fee" | "adjustment";

export interface TransactionRecord {
  id: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  amountMinor: bigint;
  currency: string;
  providerReference?: string;
  idempotencyKey?: string;
  createdAt: Date;
}

/**
 * Deposit orchestration is intentionally provider-neutral.
 * Production credit must happen only after an authorized payment provider
 * verifies the transaction through a signed callback/webhook.
 */
export const depositRules = Object.freeze({
  clientMayCreditWallet: false,
  screenshotBasedCredit: false,
  providerVerificationRequired: true,
  webhookSignatureVerificationRequired: true,
  idempotencyRequired: true,
  auditRequired: true,
});
