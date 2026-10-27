export type RewardCycle = "daily" | "weekly" | "monthly";

export interface RewardCycleClaim {
  userId: string;
  cycle: RewardCycle;
  cycleKey: string;
  status: "available" | "claimed" | "expired";
  rewardEventId?: string;
}

/** Example cycle keys: 2026-10-03, 2026-W40, 2026-10. */
export function buildCycleKey(cycle: RewardCycle, date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  if (cycle === "daily") return `${y}-${m}-${d}`;
  if (cycle === "monthly") return `${y}-${m}`;
  const firstDay = new Date(Date.UTC(y, 0, 1));
  const day = Math.ceil(((date.getTime() - firstDay.getTime()) / 86400000) + 1);
  const week = Math.ceil(day / 7);
  return `${y}-W${String(week).padStart(2, "0")}`;
}
