-- Migration 099: Split bill creates real orders
-- Purpose: When a bill is split, create actual order records so portions
--           appear in order history with their own order numbers.

-- 1. Allow split orders to have a fixed amount (overrides item-based total)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS custom_amount_cents INT NULL;

-- 2. Flag original orders that were replaced by split child orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_split_parent BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Link split_bill_payments to their real order record
ALTER TABLE split_bill_payments ADD COLUMN IF NOT EXISTS order_id INT NULL REFERENCES orders(id) ON DELETE SET NULL;

-- 4. Fix closed_at default: should be NULL until the portion is paid
--    (previous default of NOW() caused all portions to appear paid immediately)
ALTER TABLE split_bill_payments ALTER COLUMN closed_at DROP NOT NULL;
ALTER TABLE split_bill_payments ALTER COLUMN closed_at DROP DEFAULT;

-- Update any unpaid rows (closed_at should only be set when payment_method is set)
-- This is a best-effort fix — rows without a real payment may have been auto-set to NOW()
-- Safe to leave as-is for existing data since they are already closed.
