-- Migration: Add QR mode column to restaurants
-- This allows restaurants to choose between three QR code strategies:
-- 1. 'regenerate' - Generate new QR for each session
-- 2. 'static_table' - One QR per table (only one session allowed per table)
-- 3. 'static_seat' - One QR per seat (multiple sessions on same table)

ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS qr_mode VARCHAR(50) DEFAULT 'regenerate';

COMMENT ON COLUMN public.restaurants.qr_mode IS 
'QR code strategy: "regenerate" (new QR per session), "static_table" (one session per table), or "static_seat" (one QR per seat)';
