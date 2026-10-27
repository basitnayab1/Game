CREATE TABLE IF NOT EXISTS referral_codes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 code VARCHAR(64) NOT NULL UNIQUE,
 status VARCHAR(32) NOT NULL DEFAULT 'active',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS referrals (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 inviter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 invited_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 status VARCHAR(32) NOT NULL DEFAULT 'pending',
 reward_minor BIGINT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(inviter_user_id, invited_user_id)
);
CREATE TABLE IF NOT EXISTS agent_accounts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 status VARCHAR(32) NOT NULL DEFAULT 'pending',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_commissions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 agent_id UUID NOT NULL REFERENCES agent_accounts(id) ON DELETE RESTRICT,
 amount_minor BIGINT NOT NULL CHECK(amount_minor >= 0),
 status VARCHAR(32) NOT NULL DEFAULT 'pending',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
