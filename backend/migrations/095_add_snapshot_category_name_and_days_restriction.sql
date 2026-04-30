-- Migration 095: Add category name snapshots to order_items + days_of_week to menu_categories

-- Snapshot columns so reports still work after items/categories are deleted or renamed
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS item_name_zh_snapshot    TEXT,
  ADD COLUMN IF NOT EXISTS category_name_snapshot   TEXT,
  ADD COLUMN IF NOT EXISTS category_name_zh_snapshot TEXT;

-- Day-of-week restriction for timed categories (1=Mon … 7=Sun)
-- NULL means "every day" (same default as no restriction)
ALTER TABLE menu_categories
  ADD COLUMN IF NOT EXISTS days_of_week INTEGER[];

COMMENT ON COLUMN menu_categories.days_of_week IS 'Array of weekday numbers (1=Mon, 7=Sun). NULL or empty = every day.';
COMMENT ON COLUMN order_items.item_name_zh_snapshot IS 'Chinese name of the menu item at the time the order was placed';
COMMENT ON COLUMN order_items.category_name_snapshot IS 'English category name at the time the order was placed';
COMMENT ON COLUMN order_items.category_name_zh_snapshot IS 'Chinese category name at the time the order was placed';
