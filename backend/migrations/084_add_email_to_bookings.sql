-- Migration 084: Add email column to bookings table for CRM capture

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email VARCHAR(255);

COMMENT ON COLUMN bookings.email IS 'Guest email address for booking confirmations and CRM';
