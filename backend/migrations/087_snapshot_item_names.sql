-- Migration 087: Add item_name_snapshot to order_items for preserving deleted item names
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS item_name_snapshot TEXT;
