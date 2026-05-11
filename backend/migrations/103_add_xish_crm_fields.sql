-- Migration 103: Add XISH-specific fields to crm_customers

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS xish_member_status       VARCHAR(20) DEFAULT 'none'
    CHECK (xish_member_status IN ('none','basic','silver','gold','platinum')),
  ADD COLUMN IF NOT EXISTS is_previous_diner         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS xish_discount_usage_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_of_birth             DATE    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gender                    VARCHAR(10) DEFAULT NULL
    CHECK (gender IN ('male','female','other', NULL));

CREATE INDEX IF NOT EXISTS idx_crm_xish_status   ON crm_customers(restaurant_id, xish_member_status);
CREATE INDEX IF NOT EXISTS idx_crm_prev_diner    ON crm_customers(restaurant_id, is_previous_diner);
