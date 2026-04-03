-- Migration 050: Add Payment Asia transactions table
-- Date: 2026-03-25
-- Creates dedicated payment_asia_transactions table for audit trail
-- Mirrors kpay_transactions structure but tailored for Payment Asia

-- Create Payment Asia transactions table for comprehensive audit trail
CREATE TABLE IF NOT EXISTS payment_asia_transactions (
  id SERIAL PRIMARY KEY,
  
  -- Relationships
  order_id INTEGER REFERENCES orders(id),
  session_id INTEGER REFERENCES table_sessions(id),
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  
  -- Transaction identifiers
  merchant_reference VARCHAR(255) NOT NULL, -- Merchant reference from Payment Asia request
  transaction_id VARCHAR(255), -- Transaction ID from Payment Asia response/webhook
  
  -- Amount and currency
  amount_cents BIGINT NOT NULL,
  currency_code VARCHAR(10) DEFAULT 'SGD', -- SGD, HKD, MYR, etc.
  
  -- Payment status tracking
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, failed, cancelled, refunded
  
  -- Customer information
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  
  -- Payment method and details
  payment_method VARCHAR(50), -- credit_card, bank_transfer, wallet, etc.
  payment_gateway_env VARCHAR(50) DEFAULT 'sandbox', -- sandbox or production
  
  -- Transaction type
  transaction_type VARCHAR(20) DEFAULT 'payment', -- payment, refund
  
  -- Request and response data
  request_data JSONB DEFAULT '{}', -- Full Payment Asia request
  response_data JSONB DEFAULT '{}', -- Full Payment Asia response
  signature VARCHAR(512), -- Payment Asia signature for verification
  
  -- Refund information
  refund_reference VARCHAR(255), -- Merchant reference for refund transaction
  refund_amount_cents BIGINT, -- Refund amount if applicable
  refund_transaction_id VARCHAR(255), -- Refund transaction ID from Payment Asia
  
  -- Timestamp tracking
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  failed_at TIMESTAMP,
  refunded_at TIMESTAMP,
  
  -- Error and notes
  error_code VARCHAR(50),
  error_message TEXT,
  notes TEXT
);

-- Create indexes for efficient lookups and tracking
CREATE INDEX IF NOT EXISTS idx_payment_asia_transactions_order ON payment_asia_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_asia_transactions_session ON payment_asia_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_payment_asia_transactions_restaurant ON payment_asia_transactions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_payment_asia_transactions_merchant_ref ON payment_asia_transactions(merchant_reference);
CREATE INDEX IF NOT EXISTS idx_payment_asia_transactions_transaction_id ON payment_asia_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_asia_transactions_status ON payment_asia_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_asia_transactions_email ON payment_asia_transactions(customer_email);
CREATE INDEX IF NOT EXISTS idx_payment_asia_transactions_type ON payment_asia_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_payment_asia_transactions_created ON payment_asia_transactions(created_at);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_payment_asia_transactions_restaurant_status ON payment_asia_transactions(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_asia_transactions_restaurant_created ON payment_asia_transactions(restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_asia_transactions_session_status ON payment_asia_transactions(session_id, status);

-- Add foreign key constraints with ON DELETE actions
ALTER TABLE payment_asia_transactions
DROP CONSTRAINT IF EXISTS payment_asia_transactions_order_id_fkey,
DROP CONSTRAINT IF EXISTS payment_asia_transactions_session_id_fkey,
DROP CONSTRAINT IF EXISTS payment_asia_transactions_restaurant_id_fkey;

ALTER TABLE payment_asia_transactions
ADD CONSTRAINT payment_asia_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
ADD CONSTRAINT payment_asia_transactions_session_id_fkey FOREIGN KEY (session_id) REFERENCES table_sessions(id) ON DELETE SET NULL,
ADD CONSTRAINT payment_asia_transactions_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE RESTRICT;

-- Add column comments for documentation
COMMENT ON TABLE payment_asia_transactions IS 'Audit trail for all Payment Asia transactions (payments and refunds)';
COMMENT ON COLUMN payment_asia_transactions.merchant_reference IS 'Unique merchant reference sent to Payment Asia';
COMMENT ON COLUMN payment_asia_transactions.transaction_id IS 'Transaction ID returned by Payment Asia webhook';
COMMENT ON COLUMN payment_asia_transactions.customer_email IS 'Customer email for payment link and receipt';
COMMENT ON COLUMN payment_asia_transactions.payment_gateway_env IS 'Environment used for this transaction (sandbox or production)';
COMMENT ON COLUMN payment_asia_transactions.request_data IS 'Complete request payload sent to Payment Asia API';
COMMENT ON COLUMN payment_asia_transactions.response_data IS 'Complete response received from Payment Asia webhook';
COMMENT ON COLUMN payment_asia_transactions.signature IS 'Signature for validating webhook authenticity';
COMMENT ON COLUMN payment_asia_transactions.status IS 'Current payment status: pending, approved, failed, cancelled, refunded';
