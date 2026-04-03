-- Migration: Align kpay_transactions table with official KPay API specification
-- Date: 2026-03-30
-- Purpose: Store KPay API responses according to official spec with proper code tracking

-- Add kpay_response_code column to store the actual response code from KPay API
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS kpay_response_code INTEGER;

-- Add kpay_response_message column to store the message from KPay API
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS kpay_response_message TEXT;

-- Add query_status column to track if transaction was queried and the final status
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS query_status VARCHAR(50);
  -- Values: 'not_queried' (initial), 'queried' (has been queried at least once), 'final' (status is definitive)

-- Add last_queried_at column to track when transaction was last checked
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS last_queried_at TIMESTAMP;

-- Add final_status column to store the definitive transaction outcome
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS final_status VARCHAR(50);
  -- Values: 'completed' (successfully paid), 'failed' (payment failed), 'cancelled' (user cancelled), 'pending' (still processing)

-- Add order_id column to support KPay transactions for orders (refunds, retry payments)
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id);

-- Create index for order lookups (needed for retry payments and refunds)
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_order ON kpay_transactions(order_id);

-- Add comment explaining status tracking
COMMENT ON TABLE kpay_transactions IS 'KPay transaction audit trail. Stores all KPay API interactions including sales, refunds, and status queries.';
COMMENT ON COLUMN kpay_transactions.kpay_response_code IS 'Response code from KPay API (10000=success, 20011/20014/20016/50006/700034=pending, 700029/20017=cancelled, 700035=failed)';
COMMENT ON COLUMN kpay_transactions.kpay_response_message IS 'Message from KPay API response';
COMMENT ON COLUMN kpay_transactions.query_status IS 'Whether this transaction has been actively queried (not_queried, queried, final)';
COMMENT ON COLUMN kpay_transactions.final_status IS 'Definitive transaction status after all queries complete';
COMMENT ON COLUMN kpay_transactions.status IS '[DEPRECATED] Use final_status instead. Kept for backward compatibility.';
