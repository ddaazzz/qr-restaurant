-- Add multi-zone printer support for different food categories
-- Example: Grill printer, Fryer printer, Beverage printer, etc.

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS enable_zone_printing BOOLEAN DEFAULT false;

-- Create printer zones table
CREATE TABLE IF NOT EXISTS printer_zones (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  zone_name VARCHAR(100) NOT NULL, -- "Grill", "Fryer", "Beverages", etc.
  printer_type VARCHAR(20), -- 'network', 'usb', 'browser', 'none'
  printer_host VARCHAR(255),
  printer_port INTEGER DEFAULT 9100,
  printer_usb_vendor_id VARCHAR(50),
  printer_usb_product_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(restaurant_id, zone_name)
);

-- Link menu categories to printer zones
CREATE TABLE IF NOT EXISTS category_printer_zones (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL,
  printer_zone_id INTEGER NOT NULL REFERENCES printer_zones(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category_id, printer_zone_id)
);

-- Add zone_id to printer_jobs table for tracking which zone printed
ALTER TABLE printer_jobs ADD COLUMN IF NOT EXISTS printer_zone_id INTEGER REFERENCES printer_zones(id);

CREATE INDEX IF NOT EXISTS idx_printer_zones_restaurant ON printer_zones(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_category_printer_zones_category ON category_printer_zones(category_id);
CREATE INDEX IF NOT EXISTS idx_printer_jobs_zone ON printer_jobs(printer_zone_id);
