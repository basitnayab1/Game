export interface DepositCreateRequest { amountMinor: number; methodId: string; idempotencyKey: string; }
export interface DepositCreateResponse { transactionId: string; status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REVERSED'; nextAction?: { type: 'PROVIDER_REDIRECT' | 'PROVIDER_APPROVAL'; url?: string }; }
export interface WithdrawalCreateRequest { amountMinor: number; methodId: string; idempotencyKey: string; }
export interface WithdrawalCreateResponse { transactionId: string; status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED' | 'REVERSED'; feeMinor: number; netMinor: number; }

export function validateAmount(amountMinor: number): void { if (!Number.isInteger(amountMinor) || amountMinor <= 0) throw new Error('Invalid amount'); }
