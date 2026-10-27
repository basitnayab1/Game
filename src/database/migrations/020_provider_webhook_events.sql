-- N5 provider-event safety gate.
-- This table records callbacks for audit/replay protection only.
-- It intentionally does NOT mutate wallet balances.
CREATE TABLE IF NOT EXISTS provider_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(120) NOT NULL,
    event_id VARCHAR(200) NOT NULL,
    event_type VARCHAR(120) NOT NULL,
    signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
    payload_hash VARCHAR(128) NOT NULL,
    state VARCHAR(32) NOT NULL DEFAULT 'RECEIVED',
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE(provider, event_id)
);
CREATE INDEX IF NOT EXISTS idx_provider_webhook_events_state
ON provider_webhook_events(state, received_at DESC);
