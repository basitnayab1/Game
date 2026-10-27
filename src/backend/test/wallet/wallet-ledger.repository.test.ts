import { describe, expect, it } from 'vitest';
import { postLedgerEntry } from '../../src/modules/wallet/wallet-ledger.repository';
import type { DatabaseClient } from '../../src/core/database/database.types';

function fakeDb(initial = '10000') {
  let balance = initial;
  let ledgerId = 0;
  const ledger: any[] = [];
  const db: DatabaseClient = {
    async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>) {
      return fn(db);
    },
    async query(sql: string, params: unknown[] = []) {
      if (sql.includes('SELECT id, available_minor, currency') && sql.includes('FOR UPDATE')) {
        return { rows: [{ id: String(params[0]), available_minor: balance, currency: 'PKR' }] };
      }
      if (sql.includes('SELECT id, wallet_account_id, amount_minor, direction')) {
        return { rows: ledger.filter((x) => x.idempotency_key === params[0]) };
      }
      if (sql.includes('INSERT INTO ledger_entries')) {
        const row = {
          id: `ledger-${++ledgerId}`,
          wallet_account_id: params[0],
          amount_minor: params[3],
          direction: params[2],
          idempotency_key: params[7],
        };
        ledger.push(row);
        return { rows: [row] };
      }
      if (sql.includes('UPDATE wallet_accounts')) {
        balance = String(params[1]);
        return { rows: [{ id: params[0], available_minor: balance, currency: 'PKR' }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  return { db, ledger, getBalance: () => BigInt(balance) };
}

describe('wallet-ledger repository', () => {
  it('credits atomically and returns the new balance', async () => {
    const f = fakeDb();
    const result = await postLedgerEntry(f.db, {
      walletAccountId: 'wallet-1', direction: 'credit', amountMinor: 2500n,
      entryType: 'authorized_deposit', idempotencyKey: 'dep-1',
    });
    expect(result.availableMinor).toBe(12500n);
    expect(result.replayed).toBe(false);
    expect(f.getBalance()).toBe(12500n);
  });

  it('rejects a debit that would make balance negative', async () => {
    const f = fakeDb('1000');
    await expect(postLedgerEntry(f.db, {
      walletAccountId: 'wallet-1', direction: 'debit', amountMinor: 1001n,
      entryType: 'authorized_withdrawal', idempotencyKey: 'wd-1',
    })).rejects.toThrow('INSUFFICIENT_AVAILABLE_BALANCE');
  });

  it('replays the same idempotency key without inserting a second ledger entry', async () => {
    const f = fakeDb();
    const command = {
      walletAccountId: 'wallet-1', direction: 'credit' as const, amountMinor: 2500n,
      entryType: 'authorized_deposit', idempotencyKey: 'dep-replay',
    };
    const first = await postLedgerEntry(f.db, command);
    const second = await postLedgerEntry(f.db, command);
    expect(first.ledgerEntryId).toBe(second.ledgerEntryId);
    expect(second.replayed).toBe(true);
    expect(f.ledger).toHaveLength(1);
    expect(f.getBalance()).toBe(12500n);
  });

  it('rejects reuse of an idempotency key for different financial data', async () => {
    const f = fakeDb();
    await postLedgerEntry(f.db, {
      walletAccountId: 'wallet-1', direction: 'credit', amountMinor: 2500n,
      entryType: 'authorized_deposit', idempotencyKey: 'same-key',
    });
    await expect(postLedgerEntry(f.db, {
      walletAccountId: 'wallet-1', direction: 'credit', amountMinor: 2600n,
      entryType: 'authorized_deposit', idempotencyKey: 'same-key',
    })).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  });
});
