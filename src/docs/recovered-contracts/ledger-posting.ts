export type LedgerPosting = { walletId: string; transactionId: string; direction: 'CREDIT'|'DEBIT'; amountMinor: bigint; currency: 'PKR'; idempotencyKey: string };
export function validateLedgerPosting(p: LedgerPosting): void { if (!p.walletId || !p.transactionId || !p.idempotencyKey) throw new Error('INVALID_LEDGER_POSTING'); if (p.amountMinor <= 0n) throw new Error('INVALID_AMOUNT'); }
