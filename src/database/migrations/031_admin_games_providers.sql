ALTER TABLE game_providers
  ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_game_providers_admin_status
  ON game_providers(status, is_authorized);
CREATE INDEX IF NOT EXISTS idx_games_admin_catalog
  ON games(status, is_hot, is_new, is_featured, display_order);
