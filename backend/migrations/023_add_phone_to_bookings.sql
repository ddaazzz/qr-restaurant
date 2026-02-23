-- Migration: Add phone column to bookings table
-- Date: 2026-02-22

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

COMMENT ON COLUMN bookings.phone IS 'Guest phone number for booking';
