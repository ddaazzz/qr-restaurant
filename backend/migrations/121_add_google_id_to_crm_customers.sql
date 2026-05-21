-- Migration 121: Add google_id to crm_customers for Google OAuth sign-up

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_customers_google_id
  ON crm_customers(restaurant_id, google_id)
  WHERE google_id IS NOT NULL;
