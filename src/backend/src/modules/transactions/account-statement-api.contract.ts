export interface AccountStatementRequest {
  fromDate: string;
  toDate: string;
}

export interface AccountStatementSummary {
  currency: 'PKR';
  totalDepositMinor: number;
  totalPlayMinor: number;
  totalWithdrawalMinor: number;
  totalWithdrawalFeeMinor: number;
  totalBonusReceivedMinor: number;
}

export interface DepositHistoryItem {
  id: string;
  date: string;
  amountMinor: number;
  method: string;
  status: string;
}

export interface WithdrawalHistoryItem {
  id: string;
  date: string;
  amountMinor: number;
  feeMinor: number;
  netMinor: number;
  method: string;
  status: string;
}

export interface AccountStatementResponse {
  summary: AccountStatementSummary;
  deposits: DepositHistoryItem[];
  withdrawals: WithdrawalHistoryItem[];
}

export function validateDateRange(request: AccountStatementRequest): void {
  const from = new Date(request.fromDate);
  const to = new Date(request.toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new Error('Invalid date range');
  }
}
