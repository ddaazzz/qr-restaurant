-- Add color field to service_request_items for per-item table card color configuration
ALTER TABLE service_request_items ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#4f46e5';
