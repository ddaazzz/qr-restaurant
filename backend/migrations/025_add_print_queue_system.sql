-- Print Queue System with Retry Logic

CREATE TABLE IF NOT EXISTS print_queue (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id VARCHAR(50),
  session_id INTEGER,
  job_type VARCHAR(20) NOT NULL, -- 'kitchen', 'bill', 'receipt'
  priority INTEGER DEFAULT 0, -- Higher = more urgent
  status VARCHAR(20) DEFAULT 'queued', -- 'queued', 'printing', 'completed', 'failed'
  printer_zone_id INTEGER REFERENCES printer_zones(id),
  payload JSONB NOT NULL, -- Stores complete order/bill data
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  next_retry_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_print_queue_restaurant_status ON print_queue(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_print_queue_order ON print_queue(order_id);
CREATE INDEX IF NOT EXISTS idx_print_queue_priority ON print_queue(restaurant_id, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_print_queue_retry ON print_queue(next_retry_at) WHERE status = 'failed';

-- Print queue settings per restaurant
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS print_queue_enabled BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS print_queue_timeout_seconds INTEGER DEFAULT 30;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS print_queue_max_concurrent INTEGER DEFAULT 1;
