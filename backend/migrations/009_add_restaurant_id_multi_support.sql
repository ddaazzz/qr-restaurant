-- =====================================================
-- Migration 009: Add Multi-Restaurant Support
-- =====================================================
-- This migration adds restaurant_id to all relevant tables
-- to ensure proper data isolation across multiple restaurants

-- 1. ADD restaurant_id TO orders TABLE (if not exists)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_id INTEGER;

-- 2. ADD restaurant_id TO order_items TABLE (if not exists) 
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS restaurant_id INTEGER;

-- 3. ADD restaurant_id TO menu_item_variants TABLE (if not exists)
ALTER TABLE menu_item_variants ADD COLUMN IF NOT EXISTS restaurant_id INTEGER;

-- 4. ADD restaurant_id TO menu_item_variant_options TABLE (if not exists)
ALTER TABLE menu_item_variant_options ADD COLUMN IF NOT EXISTS restaurant_id INTEGER;

-- 5. ADD restaurant_id TO table_sessions TABLE (if not exists)
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS restaurant_id INTEGER;

-- =====================================================
-- POPULATE restaurant_id FOR EXISTING DATA
-- =====================================================

-- Populate restaurant_id in orders via table_sessions -> tables
UPDATE orders o
SET restaurant_id = (
  SELECT t.restaurant_id
  FROM table_sessions ts
  JOIN tables t ON ts.table_id = t.id
  WHERE ts.id = o.session_id
)
WHERE o.restaurant_id IS NULL;

-- Populate restaurant_id in order_items via orders
UPDATE order_items oi
SET restaurant_id = (
  SELECT restaurant_id FROM orders o WHERE o.id = oi.order_id
)
WHERE oi.restaurant_id IS NULL;

-- Populate restaurant_id in table_sessions via tables
UPDATE table_sessions ts
SET restaurant_id = (
  SELECT t.restaurant_id FROM tables t WHERE t.id = ts.table_id
)
WHERE ts.restaurant_id IS NULL;

-- Populate restaurant_id in menu_item_variants via menu_items -> categories
UPDATE menu_item_variants miv
SET restaurant_id = (
  SELECT mc.restaurant_id
  FROM menu_items mi
  JOIN menu_categories mc ON mi.category_id = mc.id
  WHERE mi.id = miv.menu_item_id
)
WHERE miv.restaurant_id IS NULL;

-- Populate restaurant_id in menu_item_variant_options via menu_item_variants
UPDATE menu_item_variant_options mivo
SET restaurant_id = (
  SELECT restaurant_id FROM menu_item_variants miv WHERE miv.id = mivo.variant_id
)
WHERE mivo.restaurant_id IS NULL;

-- =====================================================
-- ADD FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Add FK constraints for orders.restaurant_id
ALTER TABLE orders
ADD CONSTRAINT IF NOT EXISTS orders_restaurant_id_fkey
FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

-- Add FK constraints for order_items.restaurant_id  
ALTER TABLE order_items
ADD CONSTRAINT IF NOT EXISTS order_items_restaurant_id_fkey
FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

-- Add FK constraints for table_sessions.restaurant_id
ALTER TABLE table_sessions
ADD CONSTRAINT IF NOT EXISTS table_sessions_restaurant_id_fkey
FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

-- Add FK constraints for menu_item_variants.restaurant_id
ALTER TABLE menu_item_variants
ADD CONSTRAINT IF NOT EXISTS menu_item_variants_restaurant_id_fkey
FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

-- Add FK constraints for menu_item_variant_options.restaurant_id
ALTER TABLE menu_item_variant_options
ADD CONSTRAINT IF NOT EXISTS menu_item_variant_options_restaurant_id_fkey
FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for filtering by restaurant_id
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_session ON orders(restaurant_id, session_id);

CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_id ON order_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_order ON order_items(restaurant_id, order_id);

CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant_id ON table_sessions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant_table ON table_sessions(restaurant_id, table_id);

CREATE INDEX IF NOT EXISTS idx_menu_item_variants_restaurant_id ON menu_item_variants(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_variant_options_restaurant_id ON menu_item_variant_options(restaurant_id);
