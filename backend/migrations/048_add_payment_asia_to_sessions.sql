-- Migration 048: Add Payment Asia tracking to table_sessions and orders
-- Adds fields for tracking online payments (Payment Asia)

-- Add payment tracking columns to table_sessions
ALTER TABLE table_sessions
ADD COLUMN IF NOT EXISTS payment_received BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_method_online VARCHAR(50),
ADD COLUMN IF NOT EXISTS merchant_reference VARCHAR(255),
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS payment_data JSONB;

-- Add index for tracking payment transactions
CREATE INDEX IF NOT EXISTS idx_sessions_merchant_reference ON table_sessions(merchant_reference);
CREATE INDEX IF NOT EXISTS idx_sessions_payment_received ON table_sessions(payment_received);

-- Add payment receiving flag to orders as well
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_received BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_method_online VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMP;

-- Create index for order payment tracking
CREATE INDEX IF NOT EXISTS idx_orders_payment_received ON orders(payment_received);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method_online);

-- Add comment explaining the new fields
COMMENT ON COLUMN table_sessions.payment_received IS 'True when online payment (Payment Asia, KPay) has been completed';
COMMENT ON COLUMN table_sessions.merchant_reference IS 'Payment Asia merchant reference for tracking transactions';
COMMENT ON COLUMN table_sessions.transaction_id IS 'Payment Asia transaction ID returned in callback';
COMMENT ON COLUMN table_sessions.payment_received_at IS 'Timestamp when payment was confirmed';
COMMENT ON COLUMN table_sessions.payment_data IS 'Full Payment Asia callback response data';
