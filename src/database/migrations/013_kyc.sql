CREATE TABLE IF NOT EXISTS kyc_profiles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
 status VARCHAR(48) NOT NULL DEFAULT 'not_started',
 provider_reference VARCHAR(180),
 verified_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS kyc_documents (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 kyc_profile_id UUID NOT NULL REFERENCES kyc_profiles(id) ON DELETE RESTRICT,
 document_type VARCHAR(64) NOT NULL,
 storage_key TEXT NOT NULL,
 status VARCHAR(32) NOT NULL DEFAULT 'pending',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
