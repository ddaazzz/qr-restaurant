-- Migration 102: Add XISH enabled flag and geolocation to restaurants

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS xish_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS lat          NUMERIC(10, 7) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lng          NUMERIC(10, 7) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_restaurants_xish_enabled ON restaurants(xish_enabled) WHERE xish_enabled = true;
