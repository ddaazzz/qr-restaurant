-- Migration 119: Add featured_banners column to restaurants
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS featured_banners JSONB DEFAULT '[]'::jsonb;
