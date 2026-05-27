-- Migration 116: XISH single-merchant fixes + correct tier discounts
-- Tiers: basic 5%, silver 10%, gold 15%, platinum 20%
-- Points thresholds: basic 0, silver 500, gold 2000, platinum 10000

-- 1. Update the tier settings defaults for all XISH-enabled restaurants
--    (upsert so existing rows get corrected, new rows get created)
INSERT INTO xish_tier_settings (restaurant_id, tier, points_threshold, discount_percent)
SELECT r.id, t.tier, t.threshold, t.disc
FROM restaurants r
CROSS JOIN (VALUES
  ('basic',    0,      5),
  ('silver',   500,    10),
  ('gold',     2000,   15),
  ('platinum', 10000,  20)
) AS t(tier, threshold, disc)
WHERE r.xish_enabled = true
ON CONFLICT (restaurant_id, tier)
  DO UPDATE SET
    discount_percent  = EXCLUDED.discount_percent,
    points_threshold  = EXCLUDED.points_threshold,
    updated_at        = NOW();

-- 2. Add xish_points_rate column to restaurants: points awarded per $1 spent
--    Default 1 point per $1 (i.e. 1 point per 100 cents)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS xish_points_rate NUMERIC(8,4) NOT NULL DEFAULT 1.0;

-- 3. Add xish_coupon_id to table_sessions so we can track which XISH coupon was applied
ALTER TABLE table_sessions
  ADD COLUMN IF NOT EXISTS xish_coupon_id INTEGER REFERENCES xish_gift_coupons(id) ON DELETE SET NULL;

-- 4. Add xish_discount_applied_cents to table_sessions for tracking
ALTER TABLE table_sessions
  ADD COLUMN IF NOT EXISTS xish_discount_applied_cents INTEGER NOT NULL DEFAULT 0;

-- 5. Add xish_member_id to table_sessions for quick reference
ALTER TABLE table_sessions
  ADD COLUMN IF NOT EXISTS xish_member_id INTEGER REFERENCES xish_members(id) ON DELETE SET NULL;

-- 6. Ensure bill_closures tracks xish redemptions (table may not exist if cleaned up)
ALTER TABLE IF EXISTS bill_closures
  ADD COLUMN IF NOT EXISTS xish_points_awarded INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xish_coupon_id      INTEGER REFERENCES xish_gift_coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS xish_discount_cents INTEGER NOT NULL DEFAULT 0;

-- 7. Add API key column for POS webhook authentication
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS xish_pos_api_key VARCHAR(128);

-- Generate a default pos api key for any restaurants that don't have one
UPDATE restaurants
  SET xish_pos_api_key = encode(gen_random_bytes(32), 'hex')
WHERE xish_enabled = true AND xish_pos_api_key IS NULL;
