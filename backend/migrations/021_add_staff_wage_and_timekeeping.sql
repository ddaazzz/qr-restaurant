-- Migration: Add wage/hourly rate and timekeeping support for staff
-- Date: 2026-02-16

-- 1. Add wage/hourly rate field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate_cents BIGINT DEFAULT 0;

-- 2. Create timekeeping table to track clock in/out
CREATE TABLE IF NOT EXISTS staff_timekeeping (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  clock_in_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  clock_out_at TIMESTAMP,
  duration_minutes INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_timekeeping_user ON staff_timekeeping(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_timekeeping_restaurant ON staff_timekeeping(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_timekeeping_date ON staff_timekeeping(clock_in_at);

-- Comment for documentation
COMMENT ON TABLE staff_timekeeping IS 'Tracks clock in/out events for staff members';
COMMENT ON COLUMN staff_timekeeping.clock_in_at IS 'Time when staff clocked in';
COMMENT ON COLUMN staff_timekeeping.clock_out_at IS 'Time when staff clocked out (NULL if still clocked in)';
COMMENT ON COLUMN staff_timekeeping.duration_minutes IS 'Total duration worked in minutes (calculated when clocking out)';
