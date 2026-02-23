-- =====================================================
-- Migration 024: Add language_preference to restaurants
-- =====================================================
-- This migration adds language_preference to the restaurants table
-- to store the restaurant's preferred language setting

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS language_preference VARCHAR(10) DEFAULT 'en';

-- Add comment explaining the column
COMMENT ON COLUMN restaurants.language_preference IS 'Preferred language for restaurant admin interface (en, zh, etc.)';
