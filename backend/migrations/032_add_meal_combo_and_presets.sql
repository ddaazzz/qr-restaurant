-- Add meal/combo support and pre-saved addon/variant lists

-- 1. Add is_meal_combo column to menu_items
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS is_meal_combo BOOLEAN DEFAULT false;

-- 2. Create addon_presets table for pre-saved addon lists
-- Stores pre-configured addon lists that can be reused across items
CREATE TABLE IF NOT EXISTS addon_presets (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure unique preset name per restaurant
  CONSTRAINT addon_preset_unique_per_restaurant 
    UNIQUE(restaurant_id, name)
);

-- 3. Create addon_preset_items table for items in each preset
-- Links menu items to presets with discount pricing
CREATE TABLE IF NOT EXISTS addon_preset_items (
  id SERIAL PRIMARY KEY,
  addon_preset_id INTEGER NOT NULL REFERENCES addon_presets(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  addon_discount_price_cents INTEGER NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure unique item per preset
  CONSTRAINT addon_preset_item_unique 
    UNIQUE(addon_preset_id, menu_item_id)
);

-- 4. Add preset_id column to addons table to link to preset
ALTER TABLE addons
ADD COLUMN IF NOT EXISTS addon_preset_id INTEGER REFERENCES addon_presets(id) ON DELETE SET NULL;

-- 5. Create variant_presets table for pre-saved variant lists
-- Stores pre-configured variant lists that can be reused across items
CREATE TABLE IF NOT EXISTS variant_presets (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure unique preset name per restaurant
  CONSTRAINT variant_preset_unique_per_restaurant 
    UNIQUE(restaurant_id, name)
);

-- 6. Create variant_preset_items table for linking variants to presets
-- This is a mapping table between variant_presets and menu_item_variants
CREATE TABLE IF NOT EXISTS variant_preset_items (
  id SERIAL PRIMARY KEY,
  variant_preset_id INTEGER NOT NULL REFERENCES variant_presets(id) ON DELETE CASCADE,
  variant_id INTEGER NOT NULL REFERENCES menu_item_variants(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure unique variant per preset
  CONSTRAINT variant_preset_item_unique 
    UNIQUE(variant_preset_id, variant_id)
);

-- 7. Add preset_id column to menu_item_variants to link to preset
ALTER TABLE menu_item_variants
ADD COLUMN IF NOT EXISTS variant_preset_id INTEGER REFERENCES variant_presets(id) ON DELETE SET NULL;

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_addon_presets_restaurant_id ON addon_presets(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_addon_presets_is_active ON addon_presets(is_active);
CREATE INDEX IF NOT EXISTS idx_addon_preset_items_addon_preset_id ON addon_preset_items(addon_preset_id);
CREATE INDEX IF NOT EXISTS idx_addon_preset_items_menu_item_id ON addon_preset_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_addons_addon_preset_id ON addons(addon_preset_id);

CREATE INDEX IF NOT EXISTS idx_variant_presets_restaurant_id ON variant_presets(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_variant_presets_is_active ON variant_presets(is_active);
CREATE INDEX IF NOT EXISTS idx_variant_preset_items_variant_preset_id ON variant_preset_items(variant_preset_id);
CREATE INDEX IF NOT EXISTS idx_variant_preset_items_variant_id ON variant_preset_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_variants_variant_preset_id ON menu_item_variants(variant_preset_id);
