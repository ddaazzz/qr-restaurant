-- Receipt Enhancement: Barcode and QR Code Support

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS receipt_show_qr BOOLEAN DEFAULT true;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS receipt_show_barcode BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS receipt_barcode_type VARCHAR(20) DEFAULT 'code128'; -- 'code128', 'ean13', 'upca'
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS receipt_include_order_qr BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS receipt_include_payment_link BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS receipt_include_loyalty_qr BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS receipt_loyalty_program_url VARCHAR(500);

-- Customer order notification settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS customer_receipt_enabled BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS customer_receipt_type VARCHAR(20) DEFAULT 'none'; -- 'printer', 'sms', 'email', 'qr'
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS customer_receipt_printer_id INTEGER REFERENCES printer_zones(id);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS customer_sms_api_key VARCHAR(200);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS customer_email_from VARCHAR(100);

-- Track sent receipts
CREATE TABLE IF NOT EXISTS customer_receipts (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id VARCHAR(50),
  session_id INTEGER,
  customer_identifier VARCHAR(100), -- Phone number or email
  receipt_type VARCHAR(20), -- 'printer', 'sms', 'email', 'qr'
  status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'failed', 'viewed'
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  viewed_at TIMESTAMP,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_customer_receipts_restaurant ON customer_receipts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_customer_receipts_order ON customer_receipts(order_id);
