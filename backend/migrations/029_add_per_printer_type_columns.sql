-- Add per-printer-type columns to support separate QR, Bill, and Kitchen printers
-- Migration 029: Per-Printer-Type Configuration
-- Date: 2026-03-11

-- QR Code Printer Configuration
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS qr_printer_type VARCHAR(20) DEFAULT 'none';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS qr_printer_host VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS qr_printer_port INTEGER DEFAULT 9100;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS qr_bluetooth_device_id VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS qr_bluetooth_device_name VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS qr_auto_print BOOLEAN DEFAULT false;

-- Bill Receipt Printer Configuration
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS bill_printer_type VARCHAR(20) DEFAULT 'none';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS bill_printer_host VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS bill_printer_port INTEGER DEFAULT 9100;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS bill_bluetooth_device_id VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS bill_bluetooth_device_name VARCHAR(255);
-- Note: bill_auto_print already exists from migration 023

-- Kitchen Order Printer Configuration
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS kitchen_printer_type VARCHAR(20) DEFAULT 'none';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS kitchen_printer_host VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS kitchen_printer_port INTEGER DEFAULT 9100;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS kitchen_bluetooth_device_id VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS kitchen_bluetooth_device_name VARCHAR(255);
-- Note: kitchen_auto_print already exists from migration 023

-- Add index for faster lookups by printer type
CREATE INDEX IF NOT EXISTS idx_qr_printer_type ON restaurants(qr_printer_type);
CREATE INDEX IF NOT EXISTS idx_bill_printer_type ON restaurants(bill_printer_type);
CREATE INDEX IF NOT EXISTS idx_kitchen_printer_type ON restaurants(kitchen_printer_type);

-- Comment: The old generic printer_type, printer_host, printer_port columns can be deprecated
-- and used as fallback if the per-printer-type columns are not set, maintaining backward compatibility
