export type PromotionSummary = { id: string; title: string; status: 'ACTIVE'|'EXPIRED'|'UPCOMING'; endsAt?: string };
export type RewardClaimRequest = { rewardId: string; idempotencyKey: string };
export type RewardClaimResult = { rewardId: string; status: 'CLAIMED'|'PENDING'|'REJECTED'; referenceId?: string };
export const promotionPlayerEndpoints = { list:'/api/v1/promotions', detail:(id:string)=>`/api/v1/promotions/${id}`, claim:'/api/v1/rewards/claim', history:'/api/v1/rewards/history' } as const;
