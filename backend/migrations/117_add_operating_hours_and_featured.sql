-- Migration 117: Add operating_hours and featured_item_ids to restaurants
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS operating_hours TEXT,
  ADD COLUMN IF NOT EXISTS featured_item_ids INTEGER[] DEFAULT '{}';
