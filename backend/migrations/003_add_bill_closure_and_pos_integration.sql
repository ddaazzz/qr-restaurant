-- Migration: Add bill closure and POS integration fields
-- Date: 2026-02-04

-- Add bill closure fields to table_sessions
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash';
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS amount_paid BIGINT DEFAULT 0;
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS discount_applied BIGINT DEFAULT 0;
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS closed_by_staff_id INTEGER;
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS pos_reference VARCHAR(100) UNIQUE;

-- Add POS webhook configuration to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS pos_webhook_url VARCHAR(500);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS pos_api_key VARCHAR(500);

-- Create bill closure audit table
CREATE TABLE IF NOT EXISTS bill_closures (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES table_sessions(id),
  closed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_by_staff_id INTEGER,
  payment_method VARCHAR(50),
  amount_paid BIGINT,
  discount_applied BIGINT,
  total_amount BIGINT,
  pos_reference VARCHAR(100),
  webhook_sent BOOLEAN DEFAULT false,
  webhook_response TEXT,
  notes TEXT
);

-- Create index for bill lookups
CREATE INDEX IF NOT EXISTS idx_bill_closures_session ON bill_closures(session_id);
CREATE INDEX IF NOT EXISTS idx_bill_closures_pos_ref ON bill_closures(pos_reference);
CREATE INDEX IF NOT EXISTS idx_table_sessions_pos_ref ON table_sessions(pos_reference);

-- Add table availability tracking
ALTER TABLE tables ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true;
