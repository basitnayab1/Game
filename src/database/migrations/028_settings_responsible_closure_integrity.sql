-- N5 Settings + Responsible Gaming + Account Closure integration integrity
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale VARCHAR(8) NOT NULL DEFAULT 'en',
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  security_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  biometric_unlock_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_settings_locale_chk CHECK (locale IN ('en','tr','hi','ur','ar'))
);

ALTER TABLE responsible_gaming_controls
  DROP CONSTRAINT IF EXISTS rg_session_reminder_max_chk;
ALTER TABLE responsible_gaming_controls
  ADD CONSTRAINT rg_session_reminder_max_chk CHECK (session_reminder_minutes IS NULL OR session_reminder_minutes <= 1440);

CREATE INDEX IF NOT EXISTS idx_closure_open_user
  ON account_closure_requests(user_id, requested_at DESC)
  WHERE status IN ('REQUESTED','SECURITY_REVIEW','PENDING_OBLIGATIONS','PROCESSING');
