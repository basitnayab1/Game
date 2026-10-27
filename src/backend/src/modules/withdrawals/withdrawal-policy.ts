export type WithdrawalDecision =
  | { decision: "approved"; feeMinor: bigint; netMinor: bigint }
  | { decision: "rejected"; code: string; reason: string }
  | { decision: "under_review"; code: string; reason: string };

export interface WithdrawalPolicyConfig {
  minAmountMinor: bigint;
  maxAmountMinor: bigint;
  dailyCumulativeLimitMinor: bigint;
  feeForAmountMinor: (amountMinor: bigint) => bigint;
}

export interface WithdrawalEligibility {
  amountMinor: bigint;
  availableBalanceMinor: bigint;
  kycVerified: boolean;
  paymentMethodVerified: boolean;
  paymentMethodOwnedByUser: boolean;
  accountActive: boolean;
  responsibleGamingBlocked: boolean;
  riskReviewRequired: boolean;
  dailyWithdrawnMinor: bigint;
  idempotencyKeyPresent: boolean;
}

/**
 * Pure, deterministic pre-payout decision layer.
 * It never moves money and never trusts client-supplied status/fee values.
 */
export function evaluateWithdrawal(
  input: WithdrawalEligibility,
  config: WithdrawalPolicyConfig,
): WithdrawalDecision {
  if (!input.idempotencyKeyPresent) {
    return { decision: "rejected", code: "IDEMPOTENCY_REQUIRED", reason: "A unique idempotency key is required." };
  }
  if (!input.accountActive) {
    return { decision: "rejected", code: "ACCOUNT_INACTIVE", reason: "Account is not eligible for withdrawal." };
  }
  if (input.amountMinor < config.minAmountMinor || input.amountMinor > config.maxAmountMinor) {
    return { decision: "rejected", code: "AMOUNT_OUT_OF_RANGE", reason: "Withdrawal amount is outside the configured limits." };
  }
  if (input.amountMinor > input.availableBalanceMinor) {
    return { decision: "rejected", code: "INSUFFICIENT_BALANCE", reason: "Available balance is insufficient." };
  }
  if (input.dailyWithdrawnMinor + input.amountMinor > config.dailyCumulativeLimitMinor) {
    return { decision: "rejected", code: "DAILY_LIMIT_EXCEEDED", reason: "Configured daily withdrawal limit would be exceeded." };
  }
  if (!input.kycVerified) {
    return { decision: "rejected", code: "KYC_REQUIRED", reason: "Verified identity is required before payout." };
  }
  if (!input.paymentMethodVerified || !input.paymentMethodOwnedByUser) {
    return { decision: "rejected", code: "PAYMENT_OWNERSHIP_REQUIRED", reason: "The payout destination must be verified and owned by the user." };
  }
  if (input.responsibleGamingBlocked) {
    return { decision: "rejected", code: "RESPONSIBLE_GAMING_BLOCK", reason: "Account controls currently block withdrawals." };
  }
  if (input.riskReviewRequired) {
    return { decision: "under_review", code: "RISK_REVIEW", reason: "Withdrawal requires authorized risk/compliance review." };
  }

  const feeMinor = config.feeForAmountMinor(input.amountMinor);
  if (feeMinor < 0n || feeMinor > input.amountMinor) {
    return { decision: "rejected", code: "INVALID_FEE_CONFIGURATION", reason: "Configured platform fee is invalid." };
  }
  return { decision: "approved", feeMinor, netMinor: input.amountMinor - feeMinor };
}
