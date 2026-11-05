/**
 * Withdrawal limits and the platform fee, in paisa (PKR minor units).
 *
 * The fee is charged per Rs 1,000 at the rate of the highest tier the amount
 * reaches (from the fee table agreed with the operator):
 *   up to Rs 19,999      Rs 40 per 1,000  (4%)    e.g. 10,000 -> fee 400
 *   Rs 20,000 - 29,999   Rs 45 per 1,000  (4.5%)  e.g. 20,000 -> fee 900
 *   Rs 30,000 - 39,999   Rs 50 per 1,000  (5%)
 *   Rs 40,000 - 49,999   Rs 55 per 1,000  (5.5%)
 *   Rs 50,000 - 99,999   Rs 60 per 1,000  (6%)    e.g. 50,000 -> fee 3,000
 *   Rs 100,000           Rs 90 per 1,000  (9%)    e.g. 100,000 -> fee 9,000
 * The app shows the same table (lib/features/wallet/data/withdrawal_fee.dart).
 */

export const MIN_WITHDRAWAL_MINOR = 500 * 100;
export const MAX_WITHDRAWAL_MINOR = 100_000 * 100;
export const MIN_DEPOSIT_MINOR = 100 * 100;
/** Per deposit; there is no daily or monthly deposit limit. */
export const MAX_DEPOSIT_MINOR = 50_000 * 100;
/** Total withdrawals per player per day (Pakistan time); no monthly limit. */
export const DAILY_WITHDRAWAL_LIMIT_MINOR = 300_000 * 100;

const TIERS: Array<{ fromMinor: number; perThousand: number }> = [
  { fromMinor: 100_000 * 100, perThousand: 90 },
  { fromMinor: 50_000 * 100, perThousand: 60 },
  { fromMinor: 40_000 * 100, perThousand: 55 },
  { fromMinor: 30_000 * 100, perThousand: 50 },
  { fromMinor: 20_000 * 100, perThousand: 45 },
  { fromMinor: 0, perThousand: 40 },
];

export function withdrawalFeeMinor(amountMinor: number): number {
  const tier = TIERS.find((t) => amountMinor >= t.fromMinor)!;
  return Math.round((amountMinor * tier.perThousand) / 1000);
}

/** Null when the amount is allowed, else the error to return. */
export function withdrawalLimitError(amountMinor: number): { code: string; message: string } | null {
  if (amountMinor < MIN_WITHDRAWAL_MINOR) {
    return { code: 'BELOW_MIN_WITHDRAWAL', message: `Minimum withdrawal is Rs ${MIN_WITHDRAWAL_MINOR / 100}.` };
  }
  if (amountMinor > MAX_WITHDRAWAL_MINOR) {
    return { code: 'ABOVE_MAX_WITHDRAWAL', message: `Maximum withdrawal is Rs ${(MAX_WITHDRAWAL_MINOR / 100).toLocaleString('en-US')}.` };
  }
  return null;
}
