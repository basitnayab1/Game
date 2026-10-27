CREATE INDEX IF NOT EXISTS idx_transactions_status_created ON transactions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_provider_ref ON deposits(provider_reference);
CREATE INDEX IF NOT EXISTS idx_withdrawals_provider_ref ON withdrawals(provider_reference);
