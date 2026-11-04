import { describe, expect, it } from 'vitest';
import { withdrawalFeeMinor, withdrawalLimitError } from '../src/modules/payments/withdrawal-fee.js';

const rs = (n: number) => n * 100;

describe('withdrawal fee', () => {
  it('matches the agreed fee table', () => {
    const table: Array<[number, number]> = [
      [10_000, 400], [20_000, 900], [30_000, 1_500], [40_000, 2_200], [50_000, 3_000], [100_000, 9_000],
    ];
    for (const [amount, fee] of table) expect(withdrawalFeeMinor(rs(amount))).toBe(rs(fee));
  });

  it('charges the rate of the tier reached', () => {
    expect(withdrawalFeeMinor(rs(500))).toBe(rs(20));
    expect(withdrawalFeeMinor(rs(15_000))).toBe(rs(600));
    expect(withdrawalFeeMinor(rs(75_000))).toBe(rs(4_500));
  });

  it('enforces Rs 500 minimum and Rs 100,000 maximum', () => {
    expect(withdrawalLimitError(rs(499))?.code).toBe('BELOW_MIN_WITHDRAWAL');
    expect(withdrawalLimitError(rs(500))).toBeNull();
    expect(withdrawalLimitError(rs(100_000))).toBeNull();
    expect(withdrawalLimitError(rs(100_001))?.code).toBe('ABOVE_MAX_WITHDRAWAL');
  });
});
