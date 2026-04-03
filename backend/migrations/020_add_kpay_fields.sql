-- Migration: Add KPay payment fields
-- Date: 2026-03-24

-- Add KPay reference ID to table_sessions for payment tracking
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS kpay_reference_id VARCHAR(100);
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending'; -- pending, completed, failed
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS kpay_error_message TEXT;
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMP;

-- Create KPay transactions table for audit trail
CREATE TABLE IF NOT EXISTS kpay_transactions (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES table_sessions(id),
  restaurant_id INTEGER NOT NULL,
  kpay_reference_id VARCHAR(100) NOT NULL, -- outTradeNo from KPay
  amount_cents BIGINT NOT NULL,
  currency_code VARCHAR(10) DEFAULT '344', -- HKD
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed, refunded
  terminal_ip VARCHAR(50),
  transaction_type VARCHAR(20) DEFAULT 'payment', -- payment, refund
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  kpay_response TEXT, -- Full response from KPay
  refund_reference_id VARCHAR(100), -- For refunds
  refund_amount_cents BIGINT, -- For refunds
  refunded_at TIMESTAMP
);

-- Create indexes for efficient lookups
-- (session_id index removed — kpay_transactions uses kpay_reference_id as primary lookup)
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_reference ON kpay_transactions(kpay_reference_id);
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_restaurant ON kpay_transactions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_kpay_ref ON table_sessions(kpay_reference_id);

-- Add payment_terminal_id to table_sessions to track which terminal was used
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS payment_terminal_id INTEGER REFERENCES payment_terminals(id);
