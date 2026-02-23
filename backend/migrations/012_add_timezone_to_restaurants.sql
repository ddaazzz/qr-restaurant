-- Add timezone column to restaurants table
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';

-- Create index on timezone for faster queries if needed
CREATE INDEX IF NOT EXISTS idx_restaurants_timezone ON restaurants(timezone);
