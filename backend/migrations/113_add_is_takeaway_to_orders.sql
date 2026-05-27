-- Migration 113: Add is_takeaway flag to orders
-- Supports the case where a diner at a table chooses takeaway (order packed
-- to-go but delivered/collected at the table). The session remains type='table'
-- but the individual order is flagged for the pickup queue.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_takeaway BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for fast pickup queue queries
CREATE INDEX IF NOT EXISTS orders_is_takeaway_idx ON orders (restaurant_id, is_takeaway)
  WHERE is_takeaway = TRUE;
