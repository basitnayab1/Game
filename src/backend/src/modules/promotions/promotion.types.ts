export interface Promotion {
  id: string;
  title: string;
  type: string;
  status: "draft" | "active" | "expired" | "disabled";
  startsAt: Date;
  endsAt: Date;
  config: Record<string, unknown>;
}

export interface RewardClaim {
  id: string;
  userId: string;
  promotionId: string;
  status: "available" | "claimed" | "expired" | "rejected";
}
