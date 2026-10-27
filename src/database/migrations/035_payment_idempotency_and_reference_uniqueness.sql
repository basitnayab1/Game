-- 035_payment_idempotency_and_reference_uniqueness.sql
-- Durable idempotency store and provider reference uniqueness for deposits and withdrawals.

-- 1. Enforce database-backed provider reference uniqueness on deposits
-- Scoped to provider: prevents duplicate submission of the same TRX ID across transactions.
CREATE UNIQUE INDEX IF NOT EXISTS uq_deposits_provider_reference
ON deposits (LOWER(provider_name), LOWER(provider_reference))
WHERE provider_reference IS NOT NULL AND provider_reference <> '';

-- 2. Durable request idempotency table for cashier operations (deposits & withdrawals)
CREATE TABLE IF NOT EXISTS payment_idempotency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope VARCHAR(32) NOT NULL, -- 'deposit' | 'withdrawal'
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
    response_code INT,
    response_body JSONB,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_payment_idempotency_scope_key UNIQUE (user_id, scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_idempotency_lookup
ON payment_idempotency_records(user_id, scope, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_payment_idempotency_user_status
ON payment_idempotency_records(user_id, status, created_at DESC);

-- 3. Scope transaction idempotency to user account
DROP INDEX IF EXISTS uq_transactions_idempotency;
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_user_idempotency
ON transactions(user_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;
