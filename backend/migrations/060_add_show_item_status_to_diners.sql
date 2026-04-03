-- Add column to control whether item kitchen/order status is shown to diners
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS show_item_status_to_diners BOOLEAN NOT NULL DEFAULT TRUE;
