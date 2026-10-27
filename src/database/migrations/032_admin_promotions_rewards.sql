CREATE TABLE IF NOT EXISTS admin_reward_cycle_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_type TEXT NOT NULL CHECK (cycle_type IN ('weekly','monthly')),
  title TEXT NOT NULL,
  reward_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_reward_cycle_type ON admin_reward_cycle_configs(cycle_type);
CREATE INDEX IF NOT EXISTS idx_promotions_admin_window ON promotions(status, starts_at, ends_at);
