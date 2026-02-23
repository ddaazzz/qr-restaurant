-- Migration 015: Add timezone field to restaurants table
-- This enables proper timezone handling for all timestamps

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC';

-- Create index for timezone lookups
CREATE INDEX IF NOT EXISTS idx_restaurants_timezone ON restaurants(timezone);
