-- Migration 128: Add addon_preset_id to menu_items
-- This column was referenced in code but never added via migration

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS addon_preset_id INTEGER REFERENCES addon_presets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_addon_preset_id ON menu_items(addon_preset_id);
