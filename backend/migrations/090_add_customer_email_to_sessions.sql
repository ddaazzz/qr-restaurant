-- Migration 090: Add customer_email to table_sessions
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_table_sessions_customer_email ON table_sessions(customer_email) WHERE customer_email IS NOT NULL;
