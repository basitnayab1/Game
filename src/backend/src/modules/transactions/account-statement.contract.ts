/** Statement dates are inclusive calendar dates; service uses UTC day boundaries. */
export interface AccountStatementQuery { fromDate: string; toDate: string; }
export interface AccountStatementSummary { totalDepositMinor: number; totalPlayMinor: number; totalWithdrawalMinor: number; totalWithdrawalFeeMinor: number; totalBonusMinor: number; currency: 'PKR'; }
export function validateDateRange(q: AccountStatementQuery): void { if (!q.fromDate || !q.toDate || q.fromDate > q.toDate) throw new Error('Invalid date range'); }
