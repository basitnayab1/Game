-- N5 safety gate: database-level duplicate protection for financial idempotency and provider events.
-- Review existing data for duplicate non-null idempotency keys before production migration.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ledger_entries_idempotency_key
ON ledger_entries(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Provider callback tables must use a unique (provider,event_id) key in the canonical webhook event store.
-- This migration intentionally does not invent a webhook table; the application/provider integration
-- must create it with the same uniqueness constraint before enabling live callbacks.
