export interface WithdrawalCheck { balanceMinor: bigint; amountMinor: bigint; kycVerified: boolean; paymentOwnershipVerified: boolean; riskReviewRequired: boolean; idempotencyKey: string; }

export function validateWithdrawal(input: WithdrawalCheck): void {
  if (input.amountMinor <= 0n || input.amountMinor > input.balanceMinor) throw new Error('INSUFFICIENT_BALANCE');
  if (!input.kycVerified) throw new Error('KYC_REQUIRED');
  if (!input.paymentOwnershipVerified) throw new Error('PAYMENT_OWNERSHIP_REQUIRED');
  if (!input.idempotencyKey) throw new Error('IDEMPOTENCY_REQUIRED');
}
