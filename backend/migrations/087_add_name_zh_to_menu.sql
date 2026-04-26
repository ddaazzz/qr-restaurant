-- Migration 087: Add Chinese name fields to menu_categories and menu_items
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS name_zh TEXT;
ALTER TABLE menu_items       ADD COLUMN IF NOT EXISTS name_zh TEXT;
