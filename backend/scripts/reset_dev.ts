-- ⚠️ DEVELOPMENT ONLY
-- This WILL DELETE ALL ORDER DATA

TRUNCATE
  order_item_variants,
  order_items,
  orders,
  table_sessions
RESTART IDENTITY CASCADE;

-- Optional: keep tables but reset sessions
-- TRUNCATE table_sessions RESTART IDENTITY CASCADE;
