-- Migration 082: Add time-based availability to menu categories
ALTER TABLE menu_categories
  ADD COLUMN IF NOT EXISTS time_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS available_from  TIME,
  ADD COLUMN IF NOT EXISTS available_to    TIME;

COMMENT ON COLUMN menu_categories.time_restricted IS 'When TRUE, category is only shown to customers during available_from – available_to (restaurant local time)';
COMMENT ON COLUMN menu_categories.available_from   IS 'Start time of availability window (HH:MM), e.g. 11:00';
COMMENT ON COLUMN menu_categories.available_to     IS 'End time of availability window (HH:MM), e.g. 15:00';
