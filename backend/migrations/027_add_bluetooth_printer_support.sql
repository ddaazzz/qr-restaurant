-- Add Bluetooth printer support to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS bluetooth_device_id VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS bluetooth_device_name VARCHAR(255);

-- Update printer_type enum options to include 'bluetooth'
-- Note: PostgreSQL VARCHAR allows any string, so no explicit enum constraint needed
