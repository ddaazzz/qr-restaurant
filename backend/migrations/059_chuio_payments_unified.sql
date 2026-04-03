-- Migration 059: Unified chuio_payments table + PA network column
-- date: 2026-04-01

-- 1. Add network column to payment_asia_transactions (the chosen PA channel)
ALTER TABLE payment_asia_transactions
  ADD COLUMN IF NOT EXISTS network VARCHAR(50);

-- Backfill from existing request_data JSONB
UPDATE payment_asia_transactions
  SET network = request_data->>'network'
  WHERE network IS NULL
    AND request_data IS NOT NULL
    AND request_data->>'network' IS NOT NULL;

COMMENT ON COLUMN payment_asia_transactions.network
  IS 'Payment channel chosen by customer: Alipay, Wechat, CreditCard, Octopus, Fps, CUP';

-- 2. Unified chuio_payments view across all vendors and all restaurants
CREATE TABLE IF NOT EXISTS chuio_payments (
  id                    SERIAL PRIMARY KEY,

  -- Context
  restaurant_id         INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  order_id              INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  session_id            INTEGER REFERENCES table_sessions(id) ON DELETE SET NULL,

  -- Vendor & method
  payment_vendor        VARCHAR(30) NOT NULL,  -- 'kpay', 'payment-asia', 'cash', 'card'
  payment_method        VARCHAR(50),           -- 'Alipay', 'WeChat Pay', 'Visa', 'Octopus', 'Cash', etc.
  payment_gateway_env   VARCHAR(20) DEFAULT 'production', -- 'sandbox' | 'production'

  -- References
  order_reference       VARCHAR(255),          -- chuio_order_reference / merchant_reference
  vendor_reference      VARCHAR(255),          -- transactionNo (KPay QR/Octopus) or refNo (KPay card) or request_reference (PA)

  -- Amounts
  amount_cents          BIGINT NOT NULL,
  currency_code         VARCHAR(10) DEFAULT 'HKD',
  service_charge_cents  BIGINT DEFAULT 0,
  total_cents           BIGINT NOT NULL,       -- amount_cents + service_charge_cents

  -- Status
  status                VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- pending | completed | failed | voided | refunded | partial_refund

  -- Refund tracking
  refund_amount_cents   BIGINT,
  refunded_at           TIMESTAMP,
  refund_reference      VARCHAR(255),

  -- Timestamps
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at          TIMESTAMP,
  failed_at             TIMESTAMP,

  -- Extra detail (raw terminal/gateway fields for audit)
  extra_data            JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_chuio_payments_restaurant   ON chuio_payments(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_chuio_payments_order        ON chuio_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_chuio_payments_session      ON chuio_payments(session_id);
CREATE INDEX IF NOT EXISTS idx_chuio_payments_order_ref    ON chuio_payments(order_reference);
CREATE INDEX IF NOT EXISTS idx_chuio_payments_vendor       ON chuio_payments(payment_vendor);
CREATE INDEX IF NOT EXISTS idx_chuio_payments_status       ON chuio_payments(status);
CREATE INDEX IF NOT EXISTS idx_chuio_payments_created      ON chuio_payments(created_at);

COMMENT ON TABLE chuio_payments
  IS 'Unified payment ledger across all vendors (KPay, Payment Asia, Cash, Card) for all restaurants';
