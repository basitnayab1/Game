-- Admin team: limited roles, authenticator-app 2FA, and room for a team.

-- Roles. super_admin = Owner (everything, incl. team); admin = Manager
-- (everything except team); finance = deposits/withdrawals; support = players.
INSERT INTO admin_roles (code, description) VALUES
  ('finance', 'Deposits, withdrawals and payment methods'),
  ('support', 'Players: view, password reset, support tickets')
ON CONFLICT (code) DO NOTHING;

-- 2FA per admin. The secret is stored encrypted (AES-256-GCM).
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_secret_enc TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_last_step BIGINT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_failed_count INT NOT NULL DEFAULT 0;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_locked_until TIMESTAMPTZ;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- A session passes 2FA once; refresh rotation carries it to the new session.
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS admin_2fa_at TIMESTAMPTZ;

-- The old cap of two operators becomes ten active team members.
CREATE OR REPLACE FUNCTION enforce_n5_admin_operator_limit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('n5_admin_operator_limit'));
  IF NEW.status='active' AND (SELECT COUNT(*) FROM admin_users WHERE status='active' AND user_id<>NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'N5_ADMIN_OPERATOR_LIMIT_REACHED';
  END IF;
  RETURN NEW;
END $$;
