-- Migration: Add enabled field to printer settings
-- Date: 2026-03-30
-- Purpose: Add enable/disable toggle for each printer

-- Add enabled field to all printer settings (default to true for existing printers)
UPDATE printers 
SET settings = jsonb_set(settings, '{enabled}', 'true'::jsonb)
WHERE settings->>'enabled' IS NULL;

-- Ensure all printers have the enabled field
ALTER TABLE printers 
ADD CONSTRAINT check_settings_enabled CHECK (settings ? 'enabled');

CREATE INDEX idx_printers_enabled ON printers((settings->>'enabled'));
