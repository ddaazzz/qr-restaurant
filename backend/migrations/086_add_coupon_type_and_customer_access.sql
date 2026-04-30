-- Migration 086: Add coupon_type (open/closed) and customer coupon access table
-- open = anyone with the code can use it
-- closed = only explicitly assigned CRM customers can use it

-- Add coupon_type column to coupons table (default 'open' for backwards compat)
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS coupon_type TEXT NOT NULL DEFAULT 'open'
  CHECK (coupon_type IN ('open', 'closed'));

-- Table to track which CRM customers have been granted access to closed coupons
CREATE TABLE IF NOT EXISTS customer_coupon_access (
  id              SERIAL PRIMARY KEY,
  coupon_id       INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  customer_id     INTEGER NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coupon_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_cca_coupon_id   ON customer_coupon_access(coupon_id);
CREATE INDEX IF NOT EXISTS idx_cca_customer_id ON customer_coupon_access(customer_id);
