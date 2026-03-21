-- Remove obsolete printer-related tables from old implementation
-- Migration 041: Clean up legacy printer tables
-- Date: 2026-03-19

-- Drop old tables (CASCADE removes dependent objects)
DROP TABLE IF EXISTS category_printer_zones CASCADE;
DROP TABLE IF EXISTS printer_zones CASCADE;
DROP TABLE IF EXISTS bluetooth_devices CASCADE;
DROP TABLE IF EXISTS printer_jobs CASCADE;

-- Comment: All printer configuration is now in the unified 'printers' table
COMMENT ON TABLE printers IS 'Unified printer configuration for all printer types: QR, Bill, Kitchen. Stores type, connection info, Bluetooth device, and settings as JSON.';
