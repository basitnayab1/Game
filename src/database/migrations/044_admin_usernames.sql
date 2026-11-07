-- Admins may sign in with a username instead of their phone number.
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS username VARCHAR(32);
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_users_username ON admin_users (lower(username)) WHERE username IS NOT NULL;
