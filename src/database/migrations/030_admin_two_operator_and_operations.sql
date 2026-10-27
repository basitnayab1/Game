-- Exactly two authorized N5 admin operators maximum.
-- Both operators may receive the same broad operational visibility; identity and actions remain separate/auditable.
CREATE OR REPLACE FUNCTION enforce_n5_admin_operator_limit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Serialize concurrent admin activation/insertion checks so the two-operator
  -- limit cannot be bypassed by simultaneous transactions.
  PERFORM pg_advisory_xact_lock(hashtext('n5_admin_operator_limit'));
  IF NEW.status='active' AND (SELECT COUNT(*) FROM admin_users WHERE status='active' AND user_id<>NEW.user_id) >= 2 THEN
    RAISE EXCEPTION 'N5_ADMIN_OPERATOR_LIMIT_REACHED';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_n5_admin_operator_limit ON admin_users;
CREATE TRIGGER trg_n5_admin_operator_limit BEFORE INSERT OR UPDATE OF status ON admin_users
FOR EACH ROW EXECUTE FUNCTION enforce_n5_admin_operator_limit();
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(status) WHERE status='active';
