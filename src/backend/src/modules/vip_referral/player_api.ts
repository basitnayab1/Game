export type VipSummary = { level:number; name:string; progress:number; nextLevel?:number };
export type ReferralSummary = { code:string; total:number; pending:number; qualified:number; rewarded:number };
export const vipReferralPlayerEndpoints = { vip:'/api/v1/vip', vipHistory:'/api/v1/vip/rewards', referral:'/api/v1/referrals', referralHistory:'/api/v1/referrals/history' } as const;
