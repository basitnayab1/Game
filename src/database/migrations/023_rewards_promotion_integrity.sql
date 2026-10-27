-- Server-authoritative promotion/reward claim integrity.
ALTER TABLE promotion_claims ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE promotion_claims ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE reward_events ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_promotions_active_window ON promotions(status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_promotion_claims_user_status ON promotion_claims(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_events_user_created ON reward_events(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_event_cycle
ON reward_events(user_id, reward_type, source_id)
WHERE source_id IS NOT NULL;
