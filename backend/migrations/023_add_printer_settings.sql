-- Add printer configuration to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS printer_type VARCHAR(20) DEFAULT 'none';
-- 'none', 'network', 'usb', 'browser'

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS printer_host VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS printer_port INTEGER DEFAULT 9100;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS printer_usb_vendor_id VARCHAR(50);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS printer_usb_product_id VARCHAR(50);

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS kitchen_auto_print BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS bill_auto_print BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS print_logo BOOLEAN DEFAULT true;

-- Create printer job history table for debugging/auditing
CREATE TABLE IF NOT EXISTS printer_jobs (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  order_id VARCHAR(50),
  job_type VARCHAR(20), -- 'kitchen', 'bill', 'receipt'
  status VARCHAR(20), -- 'pending', 'sent', 'failed'
  printer_type VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_printer_jobs_restaurant ON printer_jobs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_printer_jobs_order ON printer_jobs(order_id);
