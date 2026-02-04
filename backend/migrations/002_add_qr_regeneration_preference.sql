-- Migration: Add QR code regeneration preference to restaurants
-- This allows restaurants to choose whether to generate new QR codes for each session
-- or keep static QR codes that can be printed once for each seat

ALTER TABLE public.restaurants
ADD COLUMN regenerate_qr_per_session BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.restaurants.regenerate_qr_per_session IS 
'If true, generates new QR code for each session. If false, keeps static QR codes for each seat.';
