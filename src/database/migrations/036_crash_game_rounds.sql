-- 036_crash_game_rounds.sql
-- Durable storage for Crash Game (Aviator) rounds and provably fair state.
-- Eliminates process-local in-memory state and guarantees atomic settlement and restart recovery.

CREATE TABLE IF NOT EXISTS crash_game_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    wallet_account_id UUID REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
    game_id UUID REFERENCES games(id) ON DELETE SET NULL,
    session_id UUID REFERENCES game_sessions(id) ON DELETE SET NULL,
    bet_minor BIGINT NOT NULL CHECK (bet_minor > 0),
    crash_point NUMERIC(10, 2) NOT NULL CHECK (crash_point >= 1.00),
    server_seed TEXT NOT NULL,
    server_seed_hash TEXT NOT NULL,
    client_seed TEXT NOT NULL DEFAULT '000000000000000000',
    nonce BIGINT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cashed_out', 'crashed', 'refunded')),
    cashed_out_multiplier NUMERIC(10, 2),
    payout_minor BIGINT DEFAULT 0 CHECK (payout_minor >= 0),
    idempotency_key VARCHAR(128) UNIQUE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crash_rounds_user_status
ON crash_game_rounds(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crash_rounds_status_started
ON crash_game_rounds(status, started_at);
