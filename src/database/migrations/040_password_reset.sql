-- 040_password_reset.sql
-- Admin-issued password resets: an admin sets a one-time temporary password,
-- and the player must choose a new password before using the app again.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
