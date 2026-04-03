-- Migration 059: Add network column to payment_asia_transactions
-- Stores the payment network (Alipay, WeChat Pay, CreditCard, Octopus, FPS, etc.)
-- captured at payment initiation time so it can be displayed in order history
-- without needing to query the request_data JSONB.

ALTER TABLE payment_asia_transactions
  ADD COLUMN IF NOT EXISTS network VARCHAR(50);

-- Backfill from existing request_data JSONB for all existing rows
UPDATE payment_asia_transactions
  SET network = request_data->>'network'
  WHERE network IS NULL AND request_data IS NOT NULL AND request_data->>'network' IS NOT NULL;

COMMENT ON COLUMN payment_asia_transactions.network IS 'Payment network chosen by customer: Alipay, Wechat, CreditCard, Octopus, Fps, CUP';
