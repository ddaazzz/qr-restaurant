-- 080: Add custom_item_name column to order_items
-- Supports market-price / ad-hoc items entered by staff at time of order.
-- menu_item_id is already nullable (migration 065). This column stores the
-- staff-entered name when no real menu item is linked.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS custom_item_name TEXT;
