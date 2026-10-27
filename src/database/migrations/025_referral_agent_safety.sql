-- Referral/Agent safety: server-side qualification, anti-duplicate links and auditable commission/reward states.
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS qualification_reason VARCHAR(128);
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS rewarded_at TIMESTAMPTZ;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS risk_status VARCHAR(32) NOT NULL DEFAULT 'clear';
CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_invited_user ON referrals(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_inviter_status ON referrals(inviter_user_id,status);
ALTER TABLE agent_accounts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE agent_accounts ADD COLUMN IF NOT EXISTS application_note TEXT;
CREATE INDEX IF NOT EXISTS idx_agent_accounts_user_status ON agent_accounts(user_id,status);
ALTER TABLE agent_commissions ADD COLUMN IF NOT EXISTS source_referral_id UUID REFERENCES referrals(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_commission_source ON agent_commissions(source_referral_id) WHERE source_referral_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_commissions_agent_status ON agent_commissions(agent_id,status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_account_user ON agent_accounts(user_id);
