-- Add QR format customization columns
-- Migration 033: QR Code Print Format Settings
-- Date: 2026-03-12

-- QR Code Format Settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS qr_restaurant_name_format VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS qr_show_time BOOLEAN DEFAULT true;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS qr_table_layout VARCHAR(20) DEFAULT 'both'; -- 'both', 'table-only', 'vertical'
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS qr_size VARCHAR(20) DEFAULT 'medium'; -- 'small', 'medium', 'large'
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS qr_footer_text VARCHAR(255) DEFAULT 'Powered by Chuio.io';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_qr_format_restaurant ON restaurants(id);
