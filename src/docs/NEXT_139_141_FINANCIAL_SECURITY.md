# N5 Next 139–141 — Financial Concurrency, Recovery & Webhook Safety

## 139 — Database concurrency
Financial mutation order is server-side: BEGIN, lock the wallet row FOR UPDATE, check idempotency, validate balance, append ledger entry, update cached balance, COMMIT.

## 140 — Recovery/reconciliation
Deadlock/serialization failures may be retried by the server with bounded retry. Unknown financial outcomes must never be treated as success by the player app; they require reconciliation.

## 141 — Webhook security
Provider signature verification and event-id uniqueness must happen before any financial state change. Duplicate provider callbacks must have zero additional financial effect.

The migration adds a unique partial index for non-null ledger idempotency keys. Production rollout must first check existing data for duplicates. A live webhook event table is intentionally not invented here; it must be defined against the selected authorized provider contract.
