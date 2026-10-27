import type { DatabaseClient } from '../../core/database/database.types';
import type { LedgerCommand } from './wallet.service';

export type WalletMutationResult = {
  walletAccountId: string;
  ledgerEntryId: string;
  availableMinor: bigint;
  replayed: boolean;
};

type WalletRow = {
  id: string;
  available_minor: string | number | bigint;
  currency: string;
};

type LedgerRow = {
  id: string;
  wallet_account_id: string;
  amount_minor: string | number | bigint;
  direction: 'credit' | 'debit';
};

function asBigInt(value: string | number | bigint): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}

/**
 * PostgreSQL-backed wallet/ledger mutation boundary.
 *
 * This repository is deliberately not mounted as a public API by itself.
 * Callers must supply an authenticated, authorized financial operation and
 * an idempotency key. Every mutation is atomic and uses the wallet row lock.
 */
export async function postLedgerEntry(
  db: DatabaseClient,
  command: LedgerCommand,
): Promise<WalletMutationResult> {
  validateRepositoryCommand(command);

  return db.transaction(async (tx) => {
    const walletResult = await tx.query<WalletRow>(
      `SELECT id, available_minor, currency
         FROM wallet_accounts
        WHERE id = $1
        FOR UPDATE`,
      [command.walletAccountId],
    );

    const wallet = walletResult.rows[0];
    if (!wallet) throw new Error('WALLET_NOT_FOUND');
    if (wallet.currency !== (command.currency ?? 'PKR')) throw new Error('CURRENCY_MISMATCH');

    if (command.idempotencyKey) {
      const existing = await tx.query<LedgerRow>(
        `SELECT id, wallet_account_id, amount_minor, direction
           FROM ledger_entries
          WHERE idempotency_key = $1
          LIMIT 1`,
        [command.idempotencyKey],
      );

      if (existing.rows[0]) {
        const row = existing.rows[0];
        if (
          row.wallet_account_id !== command.walletAccountId ||
          row.direction !== command.direction ||
          asBigInt(row.amount_minor) !== command.amountMinor
        ) {
          throw new Error('IDEMPOTENCY_CONFLICT');
        }
        return {
          walletAccountId: row.wallet_account_id,
          ledgerEntryId: row.id,
          availableMinor: asBigInt(wallet.available_minor),
          replayed: true,
        };
      }
    }

    const current = asBigInt(wallet.available_minor);
    const next = command.direction === 'credit'
      ? current + command.amountMinor
      : current - command.amountMinor;

    if (next < 0n) throw new Error('INSUFFICIENT_AVAILABLE_BALANCE');

    const ledgerResult = await tx.query<LedgerRow>(
      `INSERT INTO ledger_entries
        (wallet_account_id, entry_type, direction, amount_minor, currency,
         reference_type, reference_id, idempotency_key, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING id, wallet_account_id, amount_minor, direction`,
      [
        command.walletAccountId,
        command.entryType,
        command.direction,
        command.amountMinor.toString(),
        command.currency ?? 'PKR',
        command.referenceType ?? null,
        command.referenceId ?? null,
        command.idempotencyKey ?? null,
        JSON.stringify(command.metadata ?? {}),
      ],
    );

    const ledger = ledgerResult.rows[0];
    if (!ledger) throw new Error('LEDGER_INSERT_FAILED');

    const updateResult = await tx.query<WalletRow>(
      `UPDATE wallet_accounts
          SET available_minor = $2,
              version = version + 1,
              updated_at = now()
        WHERE id = $1
        RETURNING id, available_minor, currency`,
      [command.walletAccountId, next.toString()],
    );

    const updated = updateResult.rows[0];
    if (!updated) throw new Error('WALLET_UPDATE_FAILED');

    return {
      walletAccountId: updated.id,
      ledgerEntryId: ledger.id,
      availableMinor: asBigInt(updated.available_minor),
      replayed: false,
    };
  });
}

function validateRepositoryCommand(command: LedgerCommand): void {
  if (!command.walletAccountId?.trim()) throw new Error('walletAccountId is required');
  if (command.amountMinor <= 0n) throw new Error('amount must be positive');
  if (!command.entryType?.trim()) throw new Error('entryType is required');
  if (!command.idempotencyKey?.trim()) throw new Error('idempotencyKey is required');
  if (command.currency && command.currency !== 'PKR') throw new Error('unsupported currency');
}
