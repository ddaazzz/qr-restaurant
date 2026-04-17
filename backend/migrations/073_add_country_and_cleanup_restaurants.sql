-- Migration 073: Add country to restaurants, move printer settings to separate table

-- 1. Add country column to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS country VARCHAR(100);

-- 2. Create restaurant_printer_settings table
CREATE TABLE IF NOT EXISTS restaurant_printer_settings (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    -- Legacy general printer
    printer_type VARCHAR(20) DEFAULT 'none',
    printer_host VARCHAR(255),
    printer_port INTEGER DEFAULT 9100,
    printer_usb_vendor_id VARCHAR(50),
    printer_usb_product_id VARCHAR(50),
    bluetooth_device_id VARCHAR(255),
    bluetooth_device_name VARCHAR(255),
    -- Auto-print flags
    kitchen_auto_print BOOLEAN DEFAULT false,
    bill_auto_print BOOLEAN DEFAULT false,
    print_logo BOOLEAN DEFAULT true,
    -- Zone printing
    enable_zone_printing BOOLEAN DEFAULT false,
    -- Print queue
    print_queue_enabled BOOLEAN DEFAULT false,
    print_queue_timeout_seconds INTEGER DEFAULT 30,
    print_queue_max_concurrent INTEGER DEFAULT 1,
    -- Receipt settings
    receipt_show_qr BOOLEAN DEFAULT true,
    receipt_show_barcode BOOLEAN DEFAULT false,
    receipt_barcode_type VARCHAR(20) DEFAULT 'code128',
    receipt_include_order_qr BOOLEAN DEFAULT false,
    receipt_include_payment_link BOOLEAN DEFAULT false,
    receipt_include_loyalty_qr BOOLEAN DEFAULT false,
    receipt_loyalty_program_url VARCHAR(500),
    -- Customer receipt
    customer_receipt_enabled BOOLEAN DEFAULT false,
    customer_receipt_type VARCHAR(20) DEFAULT 'none',
    customer_receipt_printer_id INTEGER,
    customer_sms_api_key VARCHAR(200),
    customer_email_from VARCHAR(100),
    -- QR printer fallback
    qr_printer_type VARCHAR(20) DEFAULT 'none',
    qr_printer_host VARCHAR(255),
    qr_printer_port INTEGER DEFAULT 9100,
    qr_bluetooth_device_id VARCHAR(255),
    qr_bluetooth_device_name VARCHAR(255),
    qr_auto_print BOOLEAN DEFAULT false,
    -- Bill printer fallback
    bill_printer_type VARCHAR(20) DEFAULT 'none',
    bill_printer_host VARCHAR(255),
    bill_printer_port INTEGER DEFAULT 9100,
    bill_bluetooth_device_id VARCHAR(255),
    bill_bluetooth_device_name VARCHAR(255),
    -- Kitchen printer fallback
    kitchen_printer_type VARCHAR(20) DEFAULT 'none',
    kitchen_printer_host VARCHAR(255),
    kitchen_printer_port INTEGER DEFAULT 9100,
    kitchen_bluetooth_device_id VARCHAR(255),
    kitchen_bluetooth_device_name VARCHAR(255),
    -- QR display settings
    qr_restaurant_name_format VARCHAR(255),
    qr_show_time BOOLEAN DEFAULT true,
    qr_table_layout VARCHAR(20) DEFAULT 'both',
    qr_size VARCHAR(20) DEFAULT 'medium',
    qr_footer_text VARCHAR(255) DEFAULT 'Powered by Chuio.io',
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_printer_settings_restaurant_id ON restaurant_printer_settings(restaurant_id);

-- 3. Migrate existing data from restaurants to restaurant_printer_settings
INSERT INTO restaurant_printer_settings (
    restaurant_id,
    printer_type, printer_host, printer_port, printer_usb_vendor_id, printer_usb_product_id,
    bluetooth_device_id, bluetooth_device_name,
    kitchen_auto_print, bill_auto_print, print_logo,
    enable_zone_printing,
    print_queue_enabled, print_queue_timeout_seconds, print_queue_max_concurrent,
    receipt_show_qr, receipt_show_barcode, receipt_barcode_type,
    receipt_include_order_qr, receipt_include_payment_link, receipt_include_loyalty_qr, receipt_loyalty_program_url,
    customer_receipt_enabled, customer_receipt_type, customer_receipt_printer_id, customer_sms_api_key, customer_email_from,
    qr_printer_type, qr_printer_host, qr_printer_port, qr_bluetooth_device_id, qr_bluetooth_device_name, qr_auto_print,
    bill_printer_type, bill_printer_host, bill_printer_port, bill_bluetooth_device_id, bill_bluetooth_device_name,
    kitchen_printer_type, kitchen_printer_host, kitchen_printer_port, kitchen_bluetooth_device_id, kitchen_bluetooth_device_name,
    qr_restaurant_name_format, qr_show_time, qr_table_layout, qr_size, qr_footer_text
)
SELECT
    id,
    printer_type, printer_host, printer_port, printer_usb_vendor_id, printer_usb_product_id,
    bluetooth_device_id, bluetooth_device_name,
    kitchen_auto_print, bill_auto_print, print_logo,
    enable_zone_printing,
    print_queue_enabled, print_queue_timeout_seconds, print_queue_max_concurrent,
    receipt_show_qr, receipt_show_barcode, receipt_barcode_type,
    receipt_include_order_qr, receipt_include_payment_link, receipt_include_loyalty_qr, receipt_loyalty_program_url,
    customer_receipt_enabled, customer_receipt_type, customer_receipt_printer_id, customer_sms_api_key, customer_email_from,
    qr_printer_type, qr_printer_host, qr_printer_port, qr_bluetooth_device_id, qr_bluetooth_device_name, qr_auto_print,
    bill_printer_type, bill_printer_host, bill_printer_port, bill_bluetooth_device_id, bill_bluetooth_device_name,
    kitchen_printer_type, kitchen_printer_host, kitchen_printer_port, kitchen_bluetooth_device_id, kitchen_bluetooth_device_name,
    qr_restaurant_name_format, qr_show_time, qr_table_layout, qr_size, qr_footer_text
FROM restaurants
ON CONFLICT (restaurant_id) DO NOTHING;

-- 4. Drop printer columns from restaurants
ALTER TABLE restaurants
    DROP COLUMN IF EXISTS printer_type,
    DROP COLUMN IF EXISTS printer_host,
    DROP COLUMN IF EXISTS printer_port,
    DROP COLUMN IF EXISTS printer_usb_vendor_id,
    DROP COLUMN IF EXISTS printer_usb_product_id,
    DROP COLUMN IF EXISTS bluetooth_device_id,
    DROP COLUMN IF EXISTS bluetooth_device_name,
    DROP COLUMN IF EXISTS kitchen_auto_print,
    DROP COLUMN IF EXISTS bill_auto_print,
    DROP COLUMN IF EXISTS print_logo,
    DROP COLUMN IF EXISTS enable_zone_printing,
    DROP COLUMN IF EXISTS print_queue_enabled,
    DROP COLUMN IF EXISTS print_queue_timeout_seconds,
    DROP COLUMN IF EXISTS print_queue_max_concurrent,
    DROP COLUMN IF EXISTS receipt_show_qr,
    DROP COLUMN IF EXISTS receipt_show_barcode,
    DROP COLUMN IF EXISTS receipt_barcode_type,
    DROP COLUMN IF EXISTS receipt_include_order_qr,
    DROP COLUMN IF EXISTS receipt_include_payment_link,
    DROP COLUMN IF EXISTS receipt_include_loyalty_qr,
    DROP COLUMN IF EXISTS receipt_loyalty_program_url,
    DROP COLUMN IF EXISTS customer_receipt_enabled,
    DROP COLUMN IF EXISTS customer_receipt_type,
    DROP COLUMN IF EXISTS customer_receipt_printer_id,
    DROP COLUMN IF EXISTS customer_sms_api_key,
    DROP COLUMN IF EXISTS customer_email_from,
    DROP COLUMN IF EXISTS qr_printer_type,
    DROP COLUMN IF EXISTS qr_printer_host,
    DROP COLUMN IF EXISTS qr_printer_port,
    DROP COLUMN IF EXISTS qr_bluetooth_device_id,
    DROP COLUMN IF EXISTS qr_bluetooth_device_name,
    DROP COLUMN IF EXISTS qr_auto_print,
    DROP COLUMN IF EXISTS bill_printer_type,
    DROP COLUMN IF EXISTS bill_printer_host,
    DROP COLUMN IF EXISTS bill_printer_port,
    DROP COLUMN IF EXISTS bill_bluetooth_device_id,
    DROP COLUMN IF EXISTS bill_bluetooth_device_name,
    DROP COLUMN IF EXISTS kitchen_printer_type,
    DROP COLUMN IF EXISTS kitchen_printer_host,
    DROP COLUMN IF EXISTS kitchen_printer_port,
    DROP COLUMN IF EXISTS kitchen_bluetooth_device_id,
    DROP COLUMN IF EXISTS kitchen_bluetooth_device_name,
    DROP COLUMN IF EXISTS qr_restaurant_name_format,
    DROP COLUMN IF EXISTS qr_show_time,
    DROP COLUMN IF EXISTS qr_table_layout,
    DROP COLUMN IF EXISTS qr_size,
    DROP COLUMN IF EXISTS qr_footer_text;
