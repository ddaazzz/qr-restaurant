-- Migration 108: Add pickup_ready_at to table_sessions for to-go order notifications
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS pickup_ready_at TIMESTAMPTZ;
