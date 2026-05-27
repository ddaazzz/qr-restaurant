-- Migration 107: XISH member tier settings
-- Stores per-restaurant tier thresholds and automatic discount percentages

CREATE TABLE IF NOT EXISTS xish_tier_settings (
  id                SERIAL PRIMARY KEY,
  restaurant_id     INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  tier              VARCHAR(20) NOT NULL,          -- basic | silver | gold | platinum
  points_threshold  INTEGER NOT NULL DEFAULT 0,    -- cumulative points needed to reach this tier
  discount_percent  NUMERIC(5,2) NOT NULL DEFAULT 0, -- automatic checkout discount
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, tier),
  CHECK (tier IN ('basic', 'silver', 'gold', 'platinum')),
  CHECK (points_threshold >= 0),
  CHECK (discount_percent >= 0 AND discount_percent <= 100)
);

-- Seed default tiers for all existing XISH-enabled restaurants
INSERT INTO xish_tier_settings (restaurant_id, tier, points_threshold, discount_percent)
SELECT r.id, t.tier, t.threshold, t.disc
FROM restaurants r
CROSS JOIN (VALUES
  ('basic',    0,      0),
  ('silver',   500,    5),
  ('gold',     2000,   10),
  ('platinum', 10000,  15)
) AS t(tier, threshold, disc)
WHERE r.xish_enabled = true
ON CONFLICT (restaurant_id, tier) DO NOTHING;
