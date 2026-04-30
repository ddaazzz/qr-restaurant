-- Migration 097: Add session_id / order_id / chuio_order_reference to terminal transaction tables
-- Date: 2026-04-29
-- Purpose: Give kpay_transactions and pa_offline_transactions the same foreign-key context
--          that payment_asia_transactions already has (restaurant_id + order_id + session_id).

-- kpay_transactions: add session_id (order_id already exists from migration 052/055)
ALTER TABLE kpay_transactions
  ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES table_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kpay_transactions_session
  ON kpay_transactions(session_id);

-- pa_offline_transactions: add order_id, session_id, chuio_order_reference
ALTER TABLE pa_offline_transactions
  ADD COLUMN IF NOT EXISTS order_id  INTEGER REFERENCES orders(id)         ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES table_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chuio_order_reference VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_pa_offline_session
  ON pa_offline_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_pa_offline_order
  ON pa_offline_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_pa_offline_chuio_ref
  ON pa_offline_transactions(chuio_order_reference);
