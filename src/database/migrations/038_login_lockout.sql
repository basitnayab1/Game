-- 038_login_lockout.sql
-- Wrong-password lockout: after 3 failed logins the account is locked for one
-- minute, and every further failure locks it again until a successful login.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS login_locked_until timestamptz;
