-- =====================================================
-- Migration 011: Add Booking Time Allowance Setting
-- =====================================================
-- This migration adds reservation time allowance setting to restaurants table
-- Used to determine how long a reservation is held past booking time

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS booking_time_allowance_mins INTEGER DEFAULT 15;

-- Ensure all existing restaurants have the default value
UPDATE restaurants
SET booking_time_allowance_mins = 15
WHERE booking_time_allowance_mins IS NULL;

-- Create index for faster lookups if needed
CREATE INDEX IF NOT EXISTS idx_restaurants_booking_allowance ON restaurants(booking_time_allowance_mins);

-- =====================================================
-- SUMMARY
-- =====================================================
/*
RESTAURANTS TABLE NOW INCLUDES:
- id (PK)
- name, address, phone, created_at, updated_at
- service_charge_percent
- theme_color, logo_url
- pos_webhook_url, pos_api_key
- booking_time_allowance_mins (NEW) - Default 15 minutes

This setting controls how long a reservation is held past its booking time
before it expires and the table becomes available again.

Example: If booking_time_allowance_mins = 15, and a table is booked for 7:00 PM,
the reservation will remain active until 7:15 PM, after which it expires.
*/
