-- Migration 081: Add image_url to service_request_items
ALTER TABLE service_request_items ADD COLUMN IF NOT EXISTS image_url TEXT;
