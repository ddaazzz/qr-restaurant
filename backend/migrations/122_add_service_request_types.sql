-- Migration 122: Add service_request_types column to restaurants table
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_request_types JSONB DEFAULT '[]'::jsonb;
