-- Migration 094: Add employment_start_date to users, hourly_rate_cents snapshot to staff_timekeeping

-- Add start date to track when a staff member was hired
ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_start_date DATE;

-- Snapshot the hourly rate at time of clock-in, so historical salary is preserved
-- even when the current rate changes later
ALTER TABLE staff_timekeeping ADD COLUMN IF NOT EXISTS hourly_rate_cents BIGINT;
