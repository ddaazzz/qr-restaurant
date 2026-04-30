-- Migration 093: Printer profiles and bill printer routing
-- Adds named printer profiles (saved configurations) and bill printer routing columns

-- Named printer profiles table
-- Allows restaurants to save connection configs by name and reuse them when setting up printers
CREATE TABLE IF NOT EXISTS printer_profiles (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    printer_type VARCHAR(20) NOT NULL DEFAULT 'none',
    printer_host VARCHAR(255),
    printer_port INTEGER DEFAULT 9100,
    bluetooth_device_id VARCHAR(255),
    bluetooth_device_name VARCHAR(255),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_printer_profiles_restaurant ON printer_profiles(restaurant_id);

-- Bill printer routing: which table sections / order types go to which bill printer
-- bill_printers array is stored in the Bill row's settings JSONB (settings.bill_printers)
-- No schema change needed for that.

-- Add display name column to printers so each printer row has a human-readable label
ALTER TABLE printers ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

COMMENT ON TABLE printer_profiles IS 'Saved named printer connection configurations per restaurant, shown as a dropdown when configuring a printer';
COMMENT ON COLUMN printers.display_name IS 'Human-readable label for this printer row, used when showing multiple printers of the same type';
