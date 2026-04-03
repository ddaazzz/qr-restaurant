-- Fix missing KPay columns in table_sessions
-- Run this if migration 020 failed to apply the columns

ALTER TABLE table_sessions 
  ADD COLUMN IF NOT EXISTS kpay_reference_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS kpay_error_message TEXT,
  ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS payment_terminal_id INTEGER;

-- Create the kpay_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS kpay_transactions (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES table_sessions(id),
  restaurant_id INTEGER NOT NULL,
  kpay_reference_id VARCHAR(100) NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency_code VARCHAR(10) DEFAULT '344',
  status VARCHAR(50) DEFAULT 'pending',
  terminal_ip VARCHAR(50),
  transaction_type VARCHAR(20) DEFAULT 'payment',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  kpay_response TEXT,
  refund_reference_id VARCHAR(100),
  refund_amount_cents BIGINT,
  refunded_at TIMESTAMP
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_reference ON kpay_transactions(kpay_reference_id);
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_restaurant ON kpay_transactions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_kpay_ref ON table_sessions(kpay_reference_id);
