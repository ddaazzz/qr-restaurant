-- Migration 055: Cleanup and refactor payment tracking schema
-- Date: 2026-03-30
-- Purpose: Consolidate duplicate payment fields, introduce chuio_order_reference as unified payment ref

-- Migration 055: Cleanup and refactor payment tracking schema
-- Date: 2026-03-30
-- Purpose: Consolidate duplicate payment fields, introduce chuio_order_reference as unified payment ref

-- Add new unified columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS chuio_order_reference VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash';

-- Drop old redundant columns from orders
ALTER TABLE orders DROP COLUMN IF EXISTS payment_received CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_received_at CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_method_online CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS kpay_reference_id CASCADE;

-- Drop redundant columns from table_sessions
ALTER TABLE table_sessions DROP COLUMN IF EXISTS payment_received CASCADE;
ALTER TABLE table_sessions DROP COLUMN IF EXISTS payment_method_online CASCADE;
ALTER TABLE table_sessions DROP COLUMN IF EXISTS merchant_reference CASCADE;
ALTER TABLE table_sessions DROP COLUMN IF EXISTS transaction_id CASCADE;
ALTER TABLE table_sessions DROP COLUMN IF EXISTS payment_received_at CASCADE;
ALTER TABLE table_sessions DROP COLUMN IF EXISTS payment_data CASCADE;

-- Add new columns to kpay_transactions
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS chuio_order_reference VARCHAR(100);

-- Add new columns to order_payments
ALTER TABLE order_payments ADD COLUMN IF NOT EXISTS chuio_order_reference VARCHAR(100);

-- Drop redundant bill_closures table
DROP TABLE IF EXISTS bill_closures CASCADE;

-- Create indexes
DROP INDEX IF EXISTS idx_orders_payment_method;
DROP INDEX IF EXISTS idx_orders_payment_received;
CREATE INDEX IF NOT EXISTS idx_orders_chuio_reference ON orders(chuio_order_reference);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_chuio_ref ON kpay_transactions(chuio_order_reference);
CREATE INDEX IF NOT EXISTS idx_order_payments_chuio_ref ON order_payments(chuio_order_reference);




-- ============================================================================
-- STEP 2: CONSOLIDATE TABLE_SESSIONS
-- ============================================================================

-- Remove duplicate payment fields from table_sessions that should only exist in orders/payment tables
-- These fields are redundant since we have order_payments and kpay_transactions tables
ALTER TABLE table_sessions 
  DROP COLUMN IF EXISTS payment_received,
  DROP COLUMN IF EXISTS payment_method_online,
  DROP COLUMN IF EXISTS merchant_reference,
  DROP COLUMN IF EXISTS transaction_id,
  DROP COLUMN IF EXISTS payment_received_at,
  DROP COLUMN IF EXISTS payment_data,
  DROP COLUMN IF EXISTS kpay_reference_id,
  DROP COLUMN IF EXISTS payment_status,
  DROP COLUMN IF EXISTS kpay_error_message,
  DROP COLUMN IF EXISTS payment_completed_at,
  DROP COLUMN IF EXISTS payment_terminal_id;

-- Keep POS-related fields for bill closure tracking (these are session-level concerns)
-- payment_method, amount_paid, discount_applied already exist from migration 003

-- Remove redundant pos_reference (not being used, duplication with table_sessions.id)
ALTER TABLE table_sessions 
  DROP COLUMN IF EXISTS pos_reference;

-- ============================================================================
-- STEP 3: UPDATE KPAY_TRANSACTIONS TABLE
-- ============================================================================

-- Add order_id if not exists (to link transactions to orders)
ALTER TABLE kpay_transactions 
  ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE;

-- Add chuio_order_reference if not exists (for unified payment reference)
ALTER TABLE kpay_transactions 
  ADD COLUMN IF NOT EXISTS chuio_order_reference VARCHAR(100);

-- Update existing kpay_transactions with order_id from orders where kpay_reference_id matches
-- (This assumes old kpay_reference_id was stored in transactions)
UPDATE kpay_transactions kt
SET order_id = o.id, chuio_order_reference = o.chuio_order_reference
FROM orders o
WHERE o.chuio_order_reference = kt.kpay_reference_id
  AND kt.order_id IS NULL;

-- Create index for unified lookups by chuio_order_reference
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_chuio_ref ON kpay_transactions(chuio_order_reference);
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_order_id ON kpay_transactions(order_id);

-- ============================================================================
-- STEP 4: UPDATE ORDER_PAYMENTS TABLE
-- ============================================================================

-- Add chuio_order_reference if not exists (for unified payment reference)
ALTER TABLE order_payments 
  ADD COLUMN IF NOT EXISTS chuio_order_reference VARCHAR(100);

-- Create index for unified lookups
CREATE INDEX IF NOT EXISTS idx_order_payments_chuio_ref ON order_payments(chuio_order_reference);

-- ============================================================================
-- STEP 5: DROP REDUNDANT BILL_CLOSURES TABLE
-- ============================================================================

-- Drop bill_closures table - redundant since:
-- - Payment status is tracked in order_payments for Payment Asia
-- - Payment status is tracked in kpay_transactions for KPay  
-- - Session closure is tracked in table_sessions.ended_at
-- - Bill closure details (amount, discount, staff) can be in table_sessions
DROP TABLE IF EXISTS bill_closures CASCADE;

-- ============================================================================
-- STEP 6: ADD COMMENTS FOR CLARITY
-- ============================================================================

COMMENT ON COLUMN orders.chuio_order_reference IS 'Unified payment reference for tracking across all payment methods (kpay, payment-asia, cash)';
COMMENT ON COLUMN orders.payment_method IS 'Payment method used: cash, kpay, payment-asia';
COMMENT ON COLUMN kpay_transactions.order_id IS 'Reference to orders table for linking transactions to orders';
COMMENT ON COLUMN kpay_transactions.chuio_order_reference IS 'Unified reference matching orders.chuio_order_reference';
COMMENT ON COLUMN order_payments.chuio_order_reference IS 'Unified reference matching orders.chuio_order_reference';
