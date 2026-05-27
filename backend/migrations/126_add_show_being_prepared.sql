-- Migration 126: Add show_being_prepared toggle to restaurants
-- Controls whether customers see order number + preparation status after payment.
-- Defaults TRUE to preserve existing behaviour for all restaurants.
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS show_being_prepared BOOLEAN NOT NULL DEFAULT TRUE;
