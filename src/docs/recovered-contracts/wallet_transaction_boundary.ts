export type WalletMutation = 'CREDIT' | 'DEBIT' | 'REVERSAL';
export interface WalletMutationRequest { userId: string; amountMinor: bigint; currency: 'PKR'; idempotencyKey: string; mutation: WalletMutation; reference: string; }

export function validateWalletMutation(req: WalletMutationRequest): void {
  if (!req.userId || req.amountMinor <= 0n || req.currency !== 'PKR' || !req.idempotencyKey || !req.reference) {
    throw new Error('INVALID_WALLET_MUTATION');
  }
}
