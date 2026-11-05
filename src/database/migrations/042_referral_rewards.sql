-- 042_referral_rewards.sql
-- What inviters earn from the players they bring in:
--   'qualification'  a one-time reward once the invited player has deposited and bet enough
--   'deposit'        a commission on every completed deposit the invited player makes
-- One row per payment; the unique keys stop any payment from being made twice.

CREATE TABLE IF NOT EXISTS referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE RESTRICT,
  inviter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  kind VARCHAR(32) NOT NULL CHECK (kind IN ('qualification', 'deposit')),
  source_transaction_id UUID REFERENCES transactions(id) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_earning_qualification
  ON referral_earnings (referral_id) WHERE kind = 'qualification';
CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_earning_deposit
  ON referral_earnings (source_transaction_id) WHERE kind = 'deposit';
CREATE INDEX IF NOT EXISTS idx_referral_earnings_inviter ON referral_earnings (inviter_user_id, created_at DESC);
