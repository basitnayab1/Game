export function canClaimReward(input: {
  status: string;
  now: Date;
  startsAt: Date;
  endsAt: Date;
}) {
  return input.status === "active"
    && input.now >= input.startsAt
    && input.now <= input.endsAt;
}

/**
 * Final reward amounts/eligibility are backend/admin configuration.
 * Client UI cannot credit itself.
 */
export const rewardRules = Object.freeze({
  clientMayCreditReward: false,
  duplicateClaimsBlocked: true,
  eligibilityServerSide: true,
  rewardHistoryAudited: true,
});
