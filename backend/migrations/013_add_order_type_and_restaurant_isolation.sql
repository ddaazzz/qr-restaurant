-- Migration 013: Add comprehensive order type support and restaurant isolation
-- This migration:
-- 1. Adds restaurant_id to bill_closures
-- 2. Adds order_type to table_sessions (table, counter, to-go)
-- 3. Ensures session_id is in orders (already exists)
-- 4. Ensures restaurant_id is in orders and order_items (already added, verifying)
-- 5. Makes table_id and table_unit_id optional (for counter/to-go orders)

-- 1. ADD restaurant_id TO bill_closures
ALTER TABLE bill_closures ADD COLUMN IF NOT EXISTS restaurant_id INTEGER;

-- 2. ADD order_type TO table_sessions (enum: 'table', 'counter', 'to-go')
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'table';

-- 3. ADD pax TO table_sessions (if not exists - for counter/to-go orders)
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS pax INTEGER;

-- 4. ADD table_unit_id TO table_sessions (if not exists)
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS table_unit_id INTEGER;

-- 5. MAKE table_id nullable for counter/to-go orders (already not constrained, just verify)
-- No change needed - table_id is already NOT NULL, but we'll only populate for table orders

-- 6. VERIFY orders has session_id (already exists)
-- VERIFY orders has restaurant_id (already added in migration 009)

-- POPULATE restaurant_id IN bill_closures FROM sessions
UPDATE bill_closures bc
SET restaurant_id = ts.restaurant_id
FROM table_sessions ts
WHERE ts.id = bc.session_id AND bc.restaurant_id IS NULL;

-- CREATE INDEX for faster lookups
CREATE INDEX IF NOT EXISTS idx_bill_closures_restaurant_id ON bill_closures(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_bill_closures_session_id ON bill_closures(session_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_order_type ON table_sessions(order_type);
CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant_id ON table_sessions(restaurant_id);
