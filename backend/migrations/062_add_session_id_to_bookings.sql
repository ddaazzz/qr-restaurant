-- Migration 062: Add session_id to bookings table
-- Links a booking to the table session that was started for it

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES table_sessions(id) ON DELETE SET NULL;
