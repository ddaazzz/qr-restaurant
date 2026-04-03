-- Migration 047: Add Payment Asia Support
-- Date: 2026-03-23
-- Adds Payment Asia payment gateway support and order payment tracking

-- Update vendor_name constraint to include payment-asia
-- Note: Cannot directly modify CHECK constraint, so we drop and recreate it
-- First, we need to drop the foreign key constraint and the table check

-- Drop existing table and recreate with updated constraint
ALTER TABLE payment_terminals 
  DROP CONSTRAINT IF EXISTS payment_terminals_vendor_name_check;

ALTER TABLE payment_terminals
  ADD CONSTRAINT payment_terminals_vendor_name_check 
  CHECK (vendor_name IN ('kpay', 'payment-asia', 'other'));

-- Add Payment Asia specific fields
ALTER TABLE payment_terminals 
  ADD COLUMN IF NOT EXISTS merchant_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS secret_code VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payment_gateway_env VARCHAR(50) DEFAULT 'sandbox';

-- Create table to track order payments (for Payment Asia and other online payment vendors)
CREATE TABLE IF NOT EXISTS order_payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    session_id INTEGER NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    vendor_name VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed, cancelled
    transaction_id VARCHAR(255),
    payment_url VARCHAR(500),
    amount_cents INTEGER NOT NULL, -- Amount in cents
    currency VARCHAR(10) DEFAULT 'SGD',
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    signature VARCHAR(512),
    response_data JSONB DEFAULT '{}',
    webhook_received_at TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_session_id ON order_payments(session_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_restaurant_id ON order_payments(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_status ON order_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_order_payments_transaction_id ON order_payments(transaction_id);

-- Add webhook configuration to restaurants table
ALTER TABLE restaurants 
  ADD COLUMN IF NOT EXISTS payment_webhook_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS payment_webhook_secret VARCHAR(255);
