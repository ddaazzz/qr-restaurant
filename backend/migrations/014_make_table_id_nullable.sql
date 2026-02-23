-- Migration 014: Make table_id and table_unit_id nullable for counter/to-go orders
-- This enables sessions without table references (counter orders, to-go orders)

-- 1. ALTER table_id to be nullable
ALTER TABLE table_sessions
  ALTER COLUMN table_id DROP NOT NULL;

-- 2. ALTER table_unit_id to be nullable
ALTER TABLE table_sessions
  ALTER COLUMN table_unit_id DROP NOT NULL;

-- 3. Create indexes for filtering null and non-null table_id
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_unit_id ON table_sessions(table_unit_id);
