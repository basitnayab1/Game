CREATE TABLE IF NOT EXISTS account_closure_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(32) NOT NULL,
  reason_code VARCHAR(64),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  CONSTRAINT account_closure_status_chk CHECK (status IN ('REQUESTED','SECURITY_REVIEW','PENDING_OBLIGATIONS','PROCESSING','CLOSED','REJECTED','CANCELLED'))
);
CREATE INDEX IF NOT EXISTS idx_account_closure_user_status ON account_closure_requests(user_id, status);
