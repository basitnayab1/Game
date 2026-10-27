CREATE TABLE IF NOT EXISTS reward_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    cycle_type VARCHAR(16) NOT NULL,
    cycle_key VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'available',
    reward_event_id UUID REFERENCES reward_events(id) ON DELETE RESTRICT,
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    UNIQUE(user_id, cycle_type, cycle_key)
);

CREATE INDEX IF NOT EXISTS idx_reward_cycles_user
ON reward_cycles(user_id, cycle_type, cycle_key DESC);
