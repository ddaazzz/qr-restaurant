-- Add service_uuid column to printers table to store discovered Bluetooth service UUIDs
-- This avoids re-discovery on every print job
ALTER TABLE printers ADD COLUMN IF NOT EXISTS service_uuid VARCHAR(36);

CREATE INDEX IF NOT EXISTS idx_printers_service_uuid ON printers(service_uuid);
