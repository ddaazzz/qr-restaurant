-- Add addon system support for meals and combos

-- 1. Create addons table
-- Stores addon configurations: which items can have addons, and what addons are available
CREATE TABLE IF NOT EXISTS addons (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  addon_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  addon_name TEXT NOT NULL,
  addon_description TEXT,
  regular_price_cents INTEGER NOT NULL,
  addon_discount_price_cents INTEGER NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure unique addon per menu item combination per restaurant
  CONSTRAINT addon_unique_per_restaurant_menu_item 
    UNIQUE(restaurant_id, menu_item_id, addon_item_id)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_addons_restaurant_id ON addons(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_addons_menu_item_id ON addons(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_addons_addon_item_id ON addons(addon_item_id);

-- 2. Add columns to order_items to support addons
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS is_addon BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_order_item_id INTEGER REFERENCES order_items(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS addon_id INTEGER REFERENCES addons(id) ON DELETE SET NULL;

-- 3. Add print_category column to track which kitchen zone should print this item
-- This allows addons to be separated by their original category for kitchen printing
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS print_category_id INTEGER REFERENCES menu_categories(id) ON DELETE SET NULL;

-- 4. Create index for addon relationships
CREATE INDEX IF NOT EXISTS idx_order_items_is_addon ON order_items(is_addon);
CREATE INDEX IF NOT EXISTS idx_order_items_parent_item ON order_items(parent_order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_addon_id ON order_items(addon_id);
CREATE INDEX IF NOT EXISTS idx_order_items_print_category ON order_items(print_category_id);

-- Update existing order_items to have print_category_id set based on their menu item's category
UPDATE order_items oi
SET print_category_id = mi.category_id
FROM menu_items mi
WHERE oi.menu_item_id = mi.id AND oi.print_category_id IS NULL AND NOT oi.is_addon;
