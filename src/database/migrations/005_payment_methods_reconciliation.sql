CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    method_type VARCHAR(64) NOT NULL,
    masked_account VARCHAR(160) NOT NULL,
    ownership_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    verified_at TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user
ON payment_methods(user_id);

CREATE TABLE IF NOT EXISTS settlement_reconciliation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_name VARCHAR(120) NOT NULL,
    provider_reference VARCHAR(160) NOT NULL,
    internal_transaction_id UUID REFERENCES transactions(id) ON DELETE RESTRICT,
    gross_minor BIGINT NOT NULL,
    provider_fee_minor BIGINT NOT NULL DEFAULT 0,
    platform_share_minor BIGINT NOT NULL DEFAULT 0,
    net_settlement_minor BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'matched',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
