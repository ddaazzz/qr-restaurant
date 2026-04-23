-- Add sort_order column to menu_items for drag-to-reorder functionality
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Set initial sort_order based on existing id to maintain backward compatibility
UPDATE menu_items SET sort_order = id WHERE sort_order = 0;
