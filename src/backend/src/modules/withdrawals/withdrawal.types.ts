export type WithdrawalStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "processing"
  | "completed"
  | "rejected"
  | "failed"
  | "reversed";

export interface WithdrawalRequest {
  userId: string;
  walletAccountId: string;
  amountMinor: bigint;
  currency: string;
  paymentMethodId: string;
  idempotencyKey: string;
}

/**
 * Withdrawal policy is configuration, not client authority.
 * Actual execution must be handled by an authorized payment/settlement
 * provider and applicable compliance controls.
 */
export const withdrawalRules = Object.freeze({
  clientMaySetStatus: false,
  clientMaySetFee: false,
  ownershipVerificationRequired: true,
  riskReviewMayBeRequired: true,
  idempotencyRequired: true,
  auditRequired: true,
});
