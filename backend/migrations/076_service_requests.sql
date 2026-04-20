-- Service Requests: configurable per-restaurant service request items
-- Generalizes the existing call_staff_requested / bill_closure_requested booleans
-- into a flexible system where restaurants define their own request types

CREATE TABLE IF NOT EXISTS service_requests (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_session_id INTEGER NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  table_unit_id INTEGER REFERENCES table_units(id),
  request_type TEXT NOT NULL,          -- e.g. 'tea_refill', 'towel', 'call_staff', 'close_bill'
  label TEXT NOT NULL,                  -- display label e.g. 'Tea Refill', 'Towel'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'acknowledged', 'fulfilled'
  fulfilled_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX idx_service_requests_restaurant ON service_requests(restaurant_id);
CREATE INDEX idx_service_requests_session ON service_requests(table_session_id);
CREATE INDEX idx_service_requests_status ON service_requests(restaurant_id, status) WHERE status = 'pending';
