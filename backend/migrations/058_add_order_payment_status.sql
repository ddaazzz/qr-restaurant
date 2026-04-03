-- Migration 058: Add payment_status tracking to orders
-- Date: 2026-03-30
-- Purpose: Track void/refund state on individual orders independently of session payment_method

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'paid';
-- Values: 'paid', 'voided', 'refunded', 'partial_refund'

COMMENT ON COLUMN orders.payment_status IS 'Payment outcome: paid, voided, refunded, partial_refund. Defaults to paid when bill is closed.';

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
