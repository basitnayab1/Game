import { describe, expect, it } from 'vitest';
import { validateDateRange } from '../src/modules/transactions/account-statement-api.contract.js';
import type { DatabaseClient } from '../src/core/database/database.types.js';
import { getAccountStatement } from '../src/modules/transactions/account-statement.service.js';

function fakeDb(): DatabaseClient {
  const calls: string[] = [];
  return {
    async query(sql: string) {
      calls.push(sql);
      if (calls.length === 1) return { rows: [{ total_deposit_minor: '10000', total_play_minor: '25000', total_withdrawal_minor: '5000', total_withdrawal_fee_minor: '400', total_bonus_received_minor: '1000' }] };
      if (calls.length === 2) return { rows: [{ id: 'd1', date: new Date('2026-07-10T10:00:00Z'), amount_minor: '10000', method: 'Easypaisa', status: 'confirmed' }] };
      return { rows: [{ id: 'w1', date: new Date('2026-07-11T10:00:00Z'), amount_minor: '5000', fee_minor: '400', net_minor: '4600', method: 'Easypaisa', status: 'completed' }] };
    },
    async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>) { return fn(this); },
  };
}

describe('account statement', () => {
  it('validates inclusive calendar date ranges', () => {
    expect(() => validateDateRange({ fromDate: '2026-07-01', toDate: '2026-07-31' })).not.toThrow();
    expect(() => validateDateRange({ fromDate: '2026-08-01', toDate: '2026-07-31' })).toThrow('Invalid date range');
  });

  it('derives summary and separate histories without round-level game records', async () => {
    const result = await getAccountStatement(fakeDb(), 'user-1', { fromDate: '2026-07-01', toDate: '2026-07-31' });
    expect(result.summary).toEqual({ currency: 'PKR', totalDepositMinor: 10000, totalPlayMinor: 25000, totalWithdrawalMinor: 5000, totalWithdrawalFeeMinor: 400, totalBonusReceivedMinor: 1000 });
    expect(result.deposits).toHaveLength(1);
    expect(result.withdrawals).toHaveLength(1);
  });

  it('rejects missing user id before database access', async () => {
    await expect(getAccountStatement(fakeDb(), '', { fromDate: '2026-07-01', toDate: '2026-07-31' })).rejects.toThrow('USER_ID_REQUIRED');
  });
});
