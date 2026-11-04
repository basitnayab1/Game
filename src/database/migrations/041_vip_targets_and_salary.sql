-- 041_vip_targets_and_salary.sql
-- VIP levels are reached by lifetime deposits and betting, both set per level by
-- the operator. Reaching a level pays its level-up bonus once; each level can pay
-- a daily salary that the player claims once per day (Pakistan time).

ALTER TABLE vip_levels
  ADD COLUMN IF NOT EXISTS deposit_required_minor BIGINT CHECK (deposit_required_minor IS NULL OR deposit_required_minor >= 0),
  ADD COLUMN IF NOT EXISTS betting_required_minor BIGINT CHECK (betting_required_minor IS NULL OR betting_required_minor >= 0);

CREATE TABLE IF NOT EXISTS vip_salary_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  claim_date DATE NOT NULL,
  vip_level INTEGER NOT NULL REFERENCES vip_levels(level),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, claim_date)
);

-- The example agreed with the operator for level 2; every other level is set in the admin panel.
UPDATE vip_levels
   SET deposit_required_minor = 500000, betting_required_minor = 1000000,
       next_level_bonus_minor = 1000, daily_salary_minor = 200
 WHERE level = 2 AND deposit_required_minor IS NULL AND betting_required_minor IS NULL;

-- Level 20 had a placeholder salary of Rs 333 with no way to reach the level; clear it.
UPDATE vip_levels SET daily_salary_minor = NULL
 WHERE level = 20 AND daily_salary_minor = 33300 AND deposit_required_minor IS NULL AND betting_required_minor IS NULL;
