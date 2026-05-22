-- Migration 125: Add image_url, description, discount_percent fields to xish_gift_settings
-- These fields allow points-redeemable coupons to have rich display and discount logic.
ALTER TABLE xish_gift_settings
  ADD COLUMN IF NOT EXISTS image_url        TEXT,
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2);
