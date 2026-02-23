-- Migration: Add background image URL to restaurants table
-- Date: 2026-02-21

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS background_url VARCHAR(500);

COMMENT ON COLUMN restaurants.background_url IS 'URL to the restaurant background image for menu page';
