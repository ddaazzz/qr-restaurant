-- Migration 070: Add api_base_url for per-restaurant custom deployments
-- NULL = use main platform URL (default for all restaurants)
-- Set to a URL string when a restaurant has its own forked deployment

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS api_base_url TEXT;
