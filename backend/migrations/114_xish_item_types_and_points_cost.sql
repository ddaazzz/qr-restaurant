-- Migration 114: Add item_type to xish_gift_settings and xish_gift_coupons
-- Distinguishes discount coupons from physical gift rewards.
-- Also adds points_cost (how many points to redeem from catalog)
-- and metadata JSONB to xish_gift_settings (used by sync-coupon route).

ALTER TABLE xish_gift_settings
  ADD COLUMN IF NOT EXISTS item_type   VARCHAR(20) NOT NULL DEFAULT 'gift'
    CHECK (item_type IN ('gift', 'coupon')),
  ADD COLUMN IF NOT EXISTS points_cost INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata    JSONB DEFAULT '{}';

ALTER TABLE xish_gift_coupons
  ADD COLUMN IF NOT EXISTS item_type        VARCHAR(20) NOT NULL DEFAULT 'gift'
    CHECK (item_type IN ('gift', 'coupon')),
  ADD COLUMN IF NOT EXISTS gift_setting_id  INTEGER REFERENCES xish_gift_settings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code      VARCHAR(100);

-- Backfill: any existing gift_settings whose item_name was created by sync-coupon
-- (they contain "% off" or "$ off" patterns) become type='coupon'
UPDATE xish_gift_settings
SET item_type = 'coupon'
WHERE item_name ILIKE '%% off%'
   OR item_name ILIKE '% off%'
   OR (metadata IS NOT NULL AND metadata->>'source' = 'chuio_coupon');
