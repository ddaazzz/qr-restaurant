-- Migration: Add variant_preset_options table and options management for variant presets
-- Purpose: Allow storing options directly within variant presets for template management

-- Create variant_preset_options table to store options for variant presets
CREATE TABLE IF NOT EXISTS variant_preset_options (
  id SERIAL PRIMARY KEY,
  variant_preset_id INTEGER NOT NULL REFERENCES variant_presets(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price_cents INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_variant_preset_options_preset_id ON variant_preset_options(variant_preset_id);
CREATE INDEX IF NOT EXISTS idx_variant_preset_options_available ON variant_preset_options(is_available);

-- Add restaurant_id to variant_preset_options for security/filtering
ALTER TABLE variant_preset_options 
ADD COLUMN IF NOT EXISTS restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE;

-- Create index for restaurant_id
CREATE INDEX IF NOT EXISTS idx_variant_preset_options_restaurant_id ON variant_preset_options(restaurant_id);
