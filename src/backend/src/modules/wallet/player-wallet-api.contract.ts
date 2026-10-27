export interface WalletSummaryResponse {
  currency: 'PKR';
  availableMinor: number;
  bonusMinor: number;
  pendingMinor: number;
  lockedMinor: number;
  refreshedAt: string;
}

export interface AccountStatementQuery {
  from: string;
  to: string;
  page?: number;
  pageSize?: number;
}

export interface AccountStatementResponse {
  from: string;
  to: string;
  totals: {
    depositMinor: number;
    playMinor: number;
    withdrawalMinor: number;
    withdrawalFeeMinor: number;
    bonusMinor: number;
  };
  deposits: Array<{ id: string; amountMinor: number; method: string; status: string; createdAt: string }>;
  withdrawals: Array<{ id: string; amountMinor: number; feeMinor: number; netMinor: number; method: string; status: string; createdAt: string }>;
}

export function assertWalletSummary(value: WalletSummaryResponse): void {
  const amounts = [value.availableMinor, value.bonusMinor, value.pendingMinor, value.lockedMinor];
  if (value.currency !== 'PKR' || amounts.some((v) => !Number.isInteger(v) || v < 0)) {
    throw new Error('Invalid wallet response');
  }
}
