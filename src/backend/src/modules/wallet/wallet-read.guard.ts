export interface AuthenticatedWalletRequest {
  userId: string;
  sessionId: string;
}

export interface WalletReadResponse {
  currency: 'PKR';
  availableMinor: number;
  bonusMinor: number;
  pendingMinor: number;
  lockedMinor: number;
  refreshedAt: string;
}

export function requireWalletOwner(auth: AuthenticatedWalletRequest | undefined): AuthenticatedWalletRequest {
  if (!auth?.userId || !auth.sessionId) {
    throw new Error('AUTHENTICATED_SESSION_REQUIRED');
  }
  return auth;
}

export function validateWalletReadResponse(value: WalletReadResponse): void {
  if (value.currency !== 'PKR') throw new Error('UNSUPPORTED_WALLET_CURRENCY');
  const amounts = [value.availableMinor, value.bonusMinor, value.pendingMinor, value.lockedMinor];
  if (amounts.some((amount) => !Number.isSafeInteger(amount) || amount < 0)) {
    throw new Error('INVALID_WALLET_AMOUNT');
  }
  if (Number.isNaN(Date.parse(value.refreshedAt))) throw new Error('INVALID_WALLET_TIMESTAMP');
}

export const walletReadRules = Object.freeze({
  ownershipFromAuthContextOnly: true,
  clientMaySetBalance: false,
  clientMayChooseWalletOwner: false,
  zeroBalanceIsNotUsedAsProductionFallback: true,
});
