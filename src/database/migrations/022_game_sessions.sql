CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES game_providers(id) ON DELETE RESTRICT,
  provider_session_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('created','active','expired','closed','failed')),
  launch_url TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES game_providers(id) ON DELETE RESTRICT;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS launch_url TEXT;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_game_sessions_provider_session
  ON game_sessions(provider_id, provider_session_id) WHERE provider_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_status ON game_sessions(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_expiry ON game_sessions(expires_at) WHERE status IN ('created','active');
