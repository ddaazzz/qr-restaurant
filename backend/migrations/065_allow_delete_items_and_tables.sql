-- Migration 065: Allow deletion of menu items and tables that have been ordered
-- Date: 2026-04-07
-- Purpose: Change FK constraints to SET NULL so items/tables can be deleted
--          while preserving order history

-- 1. Make order_items.menu_item_id nullable and change FK to ON DELETE SET NULL
ALTER TABLE order_items ALTER COLUMN menu_item_id DROP NOT NULL;

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_menu_item_id_fkey;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_menu_item_id_fkey
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL;

-- 2. Make kpay_transactions.order_id FK use SET NULL so table cascade can proceed
ALTER TABLE kpay_transactions
  DROP CONSTRAINT IF EXISTS kpay_transactions_order_id_fkey;

ALTER TABLE kpay_transactions
  ADD CONSTRAINT kpay_transactions_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
