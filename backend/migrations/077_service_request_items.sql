-- Service Request Items: configurable per-restaurant list of items customers can request
-- e.g. Tea Refill, Towel, Call Staff, Close Bill
-- These items are managed by the restaurant admin and shown on the customer-facing menu.

CREATE TABLE IF NOT EXISTS service_request_items (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,           -- internal key e.g. 'tea_refill', 'towel', 'call_staff'
  label_en TEXT NOT NULL,               -- English display label e.g. 'Tea Refill'
  label_zh TEXT,                        -- Chinese display label e.g. '加茶'
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_service_request_items_restaurant ON service_request_items(restaurant_id);
