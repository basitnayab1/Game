-- Admin foundation and controlled configuration.
-- Admin configuration is versioned and auditable; it is not a wallet-edit mechanism.
CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  description VARCHAR(180) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO admin_roles (code, description) VALUES
  ('admin', 'Standard administrative access'),
  ('super_admin', 'Elevated administrative access')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  role_id UUID NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
  status VARCHAR(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_config_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(120) NOT NULL UNIQUE,
  value_json JSONB NOT NULL,
  value_type VARCHAR(24) NOT NULL CHECK (value_type IN ('boolean','string','number','json')),
  sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_config_updated ON admin_config_entries(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_users_role_status ON admin_users(role_id,status);
