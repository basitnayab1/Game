export type RewardCycle = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export interface RewardCycleJob { cycle: RewardCycle; periodKey: string; expiresAt: string; }

export function createRewardCycleJob(cycle: RewardCycle, periodKey: string, expiresAt: string): RewardCycleJob {
  return { cycle, periodKey, expiresAt };
}

export function isExpired(expiresAt: string, now = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}
