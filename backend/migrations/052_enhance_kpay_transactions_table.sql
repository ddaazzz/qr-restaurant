-- Migration: Enhance KPay transactions table with complete transaction details
-- Date: 2026-03-29
-- Purpose: Store all KPay query response data for audit trail and easy retrieval

-- Add columns to store complete KPay transaction response data
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS transaction_no VARCHAR(100); -- KPay transaction number
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS ref_no VARCHAR(100); -- KPay reference number
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS pay_method INTEGER; -- 1:Visa, 2:Mastercard, etc.
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS pay_result INTEGER; -- -1:Timeout, 1:Pending, 2:Success, 3:Failed, etc.
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS merchant_no VARCHAR(50); -- KPay merchant number
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS merchant_name_en VARCHAR(200); -- Merchant English name
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS merchant_name_zh VARCHAR(200); -- Merchant Chinese name
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS card_no VARCHAR(50); -- Masked card number
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS card_input_code VARCHAR(10); -- S:Swipe, I:Insert, C:Tap
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS batch_no VARCHAR(20); -- KPay batch number
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS trace_no VARCHAR(20); -- KPay trace number
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS auth_code VARCHAR(50); -- Authorization code
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS device_id VARCHAR(50); -- Device unique number
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS kpos_version VARCHAR(20); -- KPOS version
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS terminal_type VARCHAR(50); -- Device model
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS tips_amount_cents BIGINT; -- Tips in smallest unit
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS discount_amount_cents BIGINT; -- Discount in smallest unit
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS order_amount_cents BIGINT; -- Total order amount
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS commit_time BIGINT; -- Transaction submission time (UTC ms)
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS query_count INTEGER DEFAULT 0; -- Number of times queried

-- Add index for order_id for easy retrieval
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_order ON kpay_transactions(order_id);

-- Add index for restaurant_id and created_at for reporting
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_restaurant_time ON kpay_transactions(restaurant_id, created_at DESC);
