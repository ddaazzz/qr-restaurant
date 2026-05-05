-- Add subscription tier columns to restaurants table
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_trial_end TIMESTAMPTZ;

-- Add constraint to limit valid tier values
ALTER TABLE restaurants
  DROP CONSTRAINT IF EXISTS restaurants_subscription_tier_check;

ALTER TABLE restaurants
  ADD CONSTRAINT restaurants_subscription_tier_check
    CHECK (subscription_tier IN ('free', 'premium'));
