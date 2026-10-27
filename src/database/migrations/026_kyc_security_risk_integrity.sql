-- KYC/security/risk integration boundary.
-- Provider decisions and account-security actions remain server-authoritative.
CREATE TABLE IF NOT EXISTS kyc_submissions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 kyc_profile_id UUID NOT NULL REFERENCES kyc_profiles(id) ON DELETE RESTRICT,
 provider VARCHAR(80),
 provider_reference VARCHAR(180),
 requested_status VARCHAR(48) NOT NULL DEFAULT 'in_progress',
 submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 reviewed_at TIMESTAMPTZ,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_profile_created ON kyc_submissions(kyc_profile_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS user_risk_flags (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 flag_code VARCHAR(80) NOT NULL,
 severity VARCHAR(16) NOT NULL DEFAULT 'medium',
 status VARCHAR(24) NOT NULL DEFAULT 'open',
 source VARCHAR(80) NOT NULL,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_user_risk_flags_user_status ON user_risk_flags(user_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS security_login_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
 device_id UUID REFERENCES user_devices(id) ON DELETE SET NULL,
 outcome VARCHAR(24) NOT NULL,
 ip_hash TEXT,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_login_events_user_created ON security_login_events(user_id,created_at DESC);
