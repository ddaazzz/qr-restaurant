-- Fix: payment_status should default to NULL (not 'paid')
-- New orders should not show as "paid" until the bill is actually closed
ALTER TABLE orders ALTER COLUMN payment_status SET DEFAULT NULL;

-- Fix existing orders that are still pending but incorrectly have payment_status = 'paid'
UPDATE orders SET payment_status = NULL WHERE status = 'pending' AND payment_status = 'paid';
