CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale VARCHAR(10) NOT NULL DEFAULT 'en',
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  security_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  biometric_unlock_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_settings_locale_chk CHECK (locale IN ('en','ur','ar','hi','bn','fa','tr','zh'))
);
