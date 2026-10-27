export type DepositState = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED' | 'REVERSED';
export interface DepositConfirmation { depositId: string; providerEventId: string; verified: boolean; amountMinor: bigint; currency: 'PKR'; }

export function canCreditDeposit(input: DepositConfirmation): boolean {
  return Boolean(input.depositId && input.providerEventId && input.verified && input.amountMinor > 0n && input.currency === 'PKR');
}
