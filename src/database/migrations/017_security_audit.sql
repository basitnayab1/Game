CREATE TABLE IF NOT EXISTS security_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 event_type VARCHAR(80) NOT NULL,
 ip_hash TEXT,
 device_id UUID REFERENCES user_devices(id) ON DELETE SET NULL,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_events_user_created
ON security_events(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS audit_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 action VARCHAR(120) NOT NULL,
 entity_type VARCHAR(80),
 entity_id UUID,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
