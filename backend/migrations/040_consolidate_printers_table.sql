-- Consolidate all printer configuration into a single printers table
-- Migration 040: Create unified printers table
-- Date: 2026-03-19

-- Drop existing printers table if it exists (from failed migration)
DROP TABLE IF EXISTS printers CASCADE;

-- Create the new printers table
CREATE TABLE IF NOT EXISTS printers (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('QR', 'Bill', 'Kitchen')), -- Printer type
    printer_type VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (printer_type IN ('none', 'network', 'bluetooth')), -- Connection type
    printer_host VARCHAR(255), -- Network IP or hostname
    printer_port INTEGER DEFAULT 9100, -- Network printer port
    bluetooth_device_id VARCHAR(255), -- Bluetooth device UUID
    bluetooth_device_name VARCHAR(255), -- Bluetooth device name
    menu_category_id INTEGER REFERENCES menu_categories(id) ON DELETE SET NULL, -- For Kitchen printer routing
    -- Format settings as JSON to avoid too many columns
    settings JSONB DEFAULT '{}', -- Contains: font_size, header_text, footer_text, code_size, text_above, text_below, auto_print, etc.
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE(restaurant_id, type) -- One printer per type per restaurant
);

-- Create indexes for fast lookups
CREATE INDEX idx_printers_restaurant_id ON printers(restaurant_id);
CREATE INDEX idx_printers_type ON printers(type);
CREATE INDEX idx_printers_restaurant_type ON printers(restaurant_id, type);
CREATE INDEX idx_printers_menu_category ON printers(menu_category_id);

-- Migrate existing data from restaurants table (only valid printer types)
INSERT INTO printers (restaurant_id, type, printer_type, printer_host, printer_port, bluetooth_device_id, bluetooth_device_name, settings)
SELECT 
    id,
    'QR',
    CASE 
      WHEN qr_printer_type IN ('none', 'network', 'bluetooth') THEN qr_printer_type
      ELSE 'none'
    END,
    qr_printer_host,
    COALESCE(qr_printer_port, 9100),
    qr_bluetooth_device_id,
    qr_bluetooth_device_name,
    jsonb_build_object(
        'code_size', 'medium',
        'text_above', 'Scan to Order',
        'text_below', 'Let us know how we did!',
        'auto_print', false
    )
FROM restaurants
WHERE qr_printer_type IS NOT NULL OR qr_printer_host IS NOT NULL OR qr_bluetooth_device_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO printers (restaurant_id, type, printer_type, printer_host, printer_port, bluetooth_device_id, bluetooth_device_name, settings)
SELECT 
    id,
    'Bill',
    CASE 
      WHEN bill_printer_type IN ('none', 'network', 'bluetooth') THEN bill_printer_type
      ELSE 'none'
    END,
    bill_printer_host,
    COALESCE(bill_printer_port, 9100),
    bill_bluetooth_device_id,
    bill_bluetooth_device_name,
    jsonb_build_object(
        'font_size', 12,
        'header_text', 'Thank You',
        'footer_text', 'Follow us on social media',
        'auto_print', COALESCE(bill_auto_print, false)
    )
FROM restaurants
WHERE bill_printer_type IS NOT NULL OR bill_printer_host IS NOT NULL OR bill_bluetooth_device_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO printers (restaurant_id, type, printer_type, printer_host, printer_port, bluetooth_device_id, bluetooth_device_name, settings)
SELECT 
    id,
    'Kitchen',
    CASE 
      WHEN kitchen_printer_type IN ('none', 'network', 'bluetooth') THEN kitchen_printer_type
      ELSE 'none'
    END,
    kitchen_printer_host,
    COALESCE(kitchen_printer_port, 9100),
    kitchen_bluetooth_device_id,
    kitchen_bluetooth_device_name,
    jsonb_build_object(
        'auto_print', COALESCE(kitchen_auto_print, false)
    )
FROM restaurants
WHERE kitchen_printer_type IN ('none', 'network', 'bluetooth', 'configured') OR kitchen_printer_host IS NOT NULL OR kitchen_bluetooth_device_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Add comment about old columns
COMMENT ON TABLE printers IS 'Unified printer configuration table for all printer types (QR, Bill, Kitchen) per restaurant';
