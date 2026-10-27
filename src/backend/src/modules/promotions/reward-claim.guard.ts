export interface RewardClaimInput {
  rewardId: string;
  idempotencyKey: string;
  now: Date;
  startsAt: Date;
  endsAt: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'DISABLED' | 'UPCOMING';
}

export function validateRewardClaim(input: RewardClaimInput): void {
  if (!input.rewardId.trim()) throw new Error('REWARD_ID_REQUIRED');
  if (!input.idempotencyKey.trim()) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  if (input.status !== 'ACTIVE') throw new Error('REWARD_NOT_ACTIVE');
  if (input.now < input.startsAt) throw new Error('REWARD_NOT_STARTED');
  if (input.now > input.endsAt) throw new Error('REWARD_EXPIRED');
  if (input.endsAt < input.startsAt) throw new Error('INVALID_REWARD_WINDOW');
}

export function assertClaimMayPostToLedger(input: { eligible: boolean; duplicate: boolean; walletPostAuthorized: boolean }): void {
  if (!input.eligible) throw new Error('REWARD_NOT_ELIGIBLE');
  if (input.duplicate) throw new Error('REWARD_ALREADY_CLAIMED');
  if (!input.walletPostAuthorized) throw new Error('WALLET_POST_NOT_AUTHORIZED');
}

export const rewardClaimRules = Object.freeze({
  idempotencyRequired: true,
  duplicateClaimsBlocked: true,
  eligibilityServerSide: true,
  walletPostingServerSideOnly: true,
});
