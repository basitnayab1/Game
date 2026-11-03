-- 039_in_house_games.sql
-- Registers the games that run on N5's own engine (Aviator crash and the
-- fruit slot) in the catalog, so players can find and launch them.
-- External provider games are added later through the admin panel.

INSERT INTO game_providers (name, external_provider_id, status, is_authorized, is_featured)
SELECT 'N5 Originals', 'internal', 'active', true, true
WHERE NOT EXISTS (SELECT 1 FROM game_providers WHERE external_provider_id = 'internal');

INSERT INTO games (provider_id, external_game_id, name, category, status, is_hot, is_featured, display_order)
SELECT p.id, g.external_game_id, g.name, g.category, 'active', true, true, g.display_order
  FROM game_providers p
 CROSS JOIN (VALUES
   ('aviator', 'Aviator', 'Crash', 1),
   ('fruit-slot', 'N5 Slots', 'Slots', 2)
 ) AS g(external_game_id, name, category, display_order)
 WHERE p.external_provider_id = 'internal'
ON CONFLICT (provider_id, external_game_id) DO NOTHING;
