CREATE TABLE IF NOT EXISTS responsible_gaming_controls (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  session_reminder_minutes INTEGER,
  deposit_limit_minor BIGINT,
  loss_limit_minor BIGINT,
  take_a_break_until TIMESTAMPTZ,
  self_excluded_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rg_session_reminder_chk CHECK (session_reminder_minutes IS NULL OR session_reminder_minutes >= 5),
  CONSTRAINT rg_deposit_limit_chk CHECK (deposit_limit_minor IS NULL OR deposit_limit_minor >= 0),
  CONSTRAINT rg_loss_limit_chk CHECK (loss_limit_minor IS NULL OR loss_limit_minor >= 0)
);
