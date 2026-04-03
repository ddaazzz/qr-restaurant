-- Migration 063: Track which staff member placed an order
-- Adds placed_by_user_id to the orders table so reports can show per-staff order activity

ALTER TABLE orders ADD COLUMN IF NOT EXISTS placed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_placed_by ON orders(placed_by_user_id);

COMMENT ON COLUMN orders.placed_by_user_id IS 'User (staff/admin) who placed this order; NULL if placed by customer via QR';
