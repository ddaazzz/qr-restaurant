-- Migration 120: Add kitchen_name to menu_items
-- This field is shown on kitchen printer/KDS instead of the item's display name
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS kitchen_name TEXT;
