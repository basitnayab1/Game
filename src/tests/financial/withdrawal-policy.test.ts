import { describe, expect, it } from "vitest";
import { evaluateWithdrawal } from "../../backend/src/modules/withdrawals/withdrawal-policy.js";

const config = {
  minAmountMinor: 100n,
  maxAmountMinor: 100_000n,
  dailyCumulativeLimitMinor: 300_000n,
  feeForAmountMinor: (amount: bigint) => amount >= 50_000n ? 3_000n : 400n,
};

const base = {
  amountMinor: 10_000n,
  availableBalanceMinor: 20_000n,
  kycVerified: true,
  paymentMethodVerified: true,
  paymentMethodOwnedByUser: true,
  accountActive: true,
  responsibleGamingBlocked: false,
  riskReviewRequired: false,
  dailyWithdrawnMinor: 0n,
  idempotencyKeyPresent: true,
};

describe("withdrawal policy", () => {
  it("approves only an eligible request and calculates server-side fee", () => {
    expect(evaluateWithdrawal(base, config)).toEqual({
      decision: "approved", feeMinor: 400n, netMinor: 9_600n,
    });
  });
  it("rejects unverified KYC", () => {
    expect(evaluateWithdrawal({ ...base, kycVerified: false }, config).decision).toBe("rejected");
  });
  it("rejects an unowned payout destination", () => {
    expect(evaluateWithdrawal({ ...base, paymentMethodOwnedByUser: false }, config).decision).toBe("rejected");
  });
  it("sends risk-flagged withdrawals to review", () => {
    expect(evaluateWithdrawal({ ...base, riskReviewRequired: true }, config)).toMatchObject({ decision: "under_review", code: "RISK_REVIEW" });
  });
  it("never accepts a client-provided negative/oversized fee", () => {
    const badConfig = { ...config, feeForAmountMinor: () => -1n };
    expect(evaluateWithdrawal(base, badConfig)).toMatchObject({ decision: "rejected", code: "INVALID_FEE_CONFIGURATION" });
  });
});
