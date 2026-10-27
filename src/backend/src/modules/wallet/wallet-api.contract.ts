export interface WalletSummaryResponse { currency: 'PKR'; availableMinor: number; bonusMinor: number; pendingMinor: number; lockedMinor: number; }
export interface TransactionSummary { id: string; type: string; amountMinor: number; status: string; createdAt: string; }

export function assertWalletResponse(value: WalletSummaryResponse): void {
  if (value.currency !== 'PKR' || value.availableMinor < 0 || value.bonusMinor < 0 || value.pendingMinor < 0 || value.lockedMinor < 0) throw new Error('Invalid wallet response');
}
