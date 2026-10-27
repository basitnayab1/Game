CREATE TABLE IF NOT EXISTS vip_levels (
  level INTEGER PRIMARY KEY CHECK(level BETWEEN 1 AND 20),
  name VARCHAR(64) NOT NULL,
  tier VARCHAR(64) NOT NULL,
  progress_target_minor BIGINT,
  daily_salary_minor BIGINT,
  monthly_salary_minor BIGINT,
  next_level_bonus_minor BIGINT,
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO vip_levels(level,name,tier,benefits) VALUES
(1,'VIP 1','Bronze I','["VIP profile badge","Level reward eligibility"]'),
(2,'VIP 2','Bronze II','["VIP profile badge","Level reward eligibility"]'),
(3,'VIP 3','Bronze III','["VIP profile badge","Level reward eligibility"]'),
(4,'VIP 4','Silver I','["Silver badge","Level reward eligibility"]'),
(5,'VIP 5','Silver II','["Silver badge","Level reward eligibility"]'),
(6,'VIP 6','Silver III','["Silver badge","Level reward eligibility"]'),
(7,'VIP 7','Gold I','["Gold badge","Level reward eligibility"]'),
(8,'VIP 8','Gold II','["Gold badge","Level reward eligibility"]'),
(9,'VIP 9','Gold III','["Gold badge","Level reward eligibility"]'),
(10,'VIP 10','Gold IV','["Gold IV badge","Level reward eligibility"]'),
(11,'VIP 11','Platinum I','["Platinum badge","Level reward eligibility"]'),
(12,'VIP 12','Platinum II','["Platinum badge","Level reward eligibility"]'),
(13,'VIP 13','Platinum III','["Platinum badge","Level reward eligibility"]'),
(14,'VIP 14','Platinum IV','["Platinum IV badge","Level reward eligibility"]'),
(15,'VIP 15','Diamond I','["Diamond badge","Level reward eligibility"]'),
(16,'VIP 16','Diamond II','["Diamond badge","Level reward eligibility"]'),
(17,'VIP 17','Diamond III','["Diamond badge","Level reward eligibility"]'),
(18,'VIP 18','Diamond IV','["Diamond IV badge","Level reward eligibility"]'),
(19,'VIP 19','Black','["Black VIP badge","Level reward eligibility"]'),
(20,'VIP 20','Royal','["Royal VIP badge","Highest configured VIP benefits"]')
ON CONFLICT(level) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_vip (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  level INTEGER NOT NULL REFERENCES vip_levels(level),
  progress_minor BIGINT NOT NULL DEFAULT 0 CHECK(progress_minor >= 0),
  qualified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vip_reward_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  vip_level INTEGER NOT NULL REFERENCES vip_levels(level),
  reward_event_id UUID REFERENCES reward_events(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  UNIQUE(user_id, vip_level)
);

CREATE INDEX IF NOT EXISTS idx_user_vip_level ON user_vip(level);
CREATE INDEX IF NOT EXISTS idx_vip_reward_history_user ON vip_reward_history(user_id, created_at DESC);

UPDATE vip_levels SET daily_salary_minor=33300 WHERE level=20;
