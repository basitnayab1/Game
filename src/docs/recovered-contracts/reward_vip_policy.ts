export interface RewardPolicy { vipLevel:number; dailySalaryMinor:number; monthlySalaryMinor:number; nextLevelBonusMinor:number; enabled:boolean; }
export function eligibleForReward(policy:RewardPolicy, accountVerified:boolean, selfExcluded:boolean): boolean { return policy.enabled && accountVerified && !selfExcluded && policy.vipLevel >= 0 && policy.vipLevel <= 20; }
