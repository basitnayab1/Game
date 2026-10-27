export type LedgerDirection = "credit" | "debit";

export interface LedgerCommand {
  walletAccountId: string;
  direction: LedgerDirection;
  amountMinor: bigint;
  entryType: string;
  currency?: string;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Domain-level wallet rules.
 * Actual persistence must run inside a PostgreSQL transaction with row locking.
 */
export function validateLedgerCommand(command: LedgerCommand): void {
  if (!command.walletAccountId) throw new Error("walletAccountId is required");
  if (command.amountMinor <= 0n) throw new Error("amount must be positive");
  if (!command.entryType) throw new Error("entryType is required");

  if (command.currency && command.currency.length !== 3) {
    throw new Error("currency must be an ISO-style 3 character code");
  }
}

/**
 * The production repository implementation is in wallet-ledger.repository.ts.
 * It must:
 * 1. Begin DB transaction.
 * 2. Lock wallet_accounts row FOR UPDATE.
 * 3. Check idempotency key.
 * 4. Reject a debit that would make the available balance negative.
 * 5. Insert immutable ledger entry.
 * 6. Update the cached wallet balance atomically.
 * 7. Commit.
 *
 * No player/client request may directly set a wallet balance.
 */
export const walletIntegrityRules = Object.freeze({
  clientMaySetBalance: false,
  ledgerEntriesAreHistorical: true,
  correctionsUseCompensatingEntry: true,
  financialWritesRequireIdempotency: true,
  financialWritesRequireAudit: true,
});
