-- 037_auth_otp_challenges.sql
-- Durable storage for phone verification / OTP login challenges.
-- Eliminates process-local in-memory OTP state so challenges survive restarts and work across instances.
--
-- Two independent secrets per challenge:
--   code_hash          the 6-digit code delivered by SMS / outbound WhatsApp and typed by the player
--   inbound_token_hash the token embedded in the wa.me deep link; it only verifies when a WhatsApp
--                      message carrying it arrives FROM the challenge phone number
-- The inbound token is returned to the client, so it must never be accepted as the typed code.

CREATE TABLE IF NOT EXISTS auth_otp_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_e164 VARCHAR(32) NOT NULL,
    code_hash TEXT NOT NULL,
    inbound_token_hash TEXT,
    attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    verified_at TIMESTAMPTZ,
    verified_via VARCHAR(24) CHECK (verified_via IN ('code', 'whatsapp_inbound')),
    consumed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_otp_challenges_phone_created
ON auth_otp_challenges(phone_e164, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_auth_otp_challenges_inbound_token
ON auth_otp_challenges(inbound_token_hash)
WHERE inbound_token_hash IS NOT NULL;
