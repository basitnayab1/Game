-- N5 Part 25: wallet/ledger integrity additions
-- Amounts remain integer minor units; PKR uses 100 minor units per rupee.

CREATE INDEX IF NOT EXISTS idx_ledger_reference
ON ledger_entries(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_ledger_idempotency_lookup
ON ledger_entries(idempotency_key);

-- Prevent zero/negative financial events.
ALTER TABLE ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_amount_positive;

ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_entries_amount_positive CHECK (amount_minor > 0);

-- Supported wallet currency for the current N5 design.
ALTER TABLE wallet_accounts
  DROP CONSTRAINT IF EXISTS wallet_accounts_currency_pkr;

ALTER TABLE wallet_accounts
  ADD CONSTRAINT wallet_accounts_currency_pkr CHECK (currency = 'PKR');
