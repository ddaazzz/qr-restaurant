-- Migration 101: Full subscription billing fields
-- Adds plan type, start/end date, paid status tracking to restaurants

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS subscription_plan      VARCHAR(20)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subscription_end_date   TIMESTAMPTZ  DEFAULT NULL;

-- Widen tier to include 'trial' and 'expired' states
ALTER TABLE restaurants
  DROP CONSTRAINT IF EXISTS restaurants_subscription_tier_check;

ALTER TABLE restaurants
  ADD CONSTRAINT restaurants_subscription_tier_check
    CHECK (subscription_tier IN ('free', 'trial', 'premium', 'expired'));

-- Backfill existing restaurants: set trial_end = created_at + 30 days
-- so they get a trial window from when they were created
UPDATE restaurants
SET
  subscription_tier     = 'trial',
  subscription_trial_end = created_at + INTERVAL '30 days'
WHERE subscription_trial_end IS NULL;
