-- Migration: Add access_rights column to users table
-- This stores JSON permissions for staff members

ALTER TABLE users ADD COLUMN IF NOT EXISTS access_rights JSONB DEFAULT '{}';

COMMENT ON COLUMN users.access_rights IS 'JSON object storing access rights for staff (view_tables, manage_orders, view_menu, close_bills, manage_menu, manage_staff, view_reports)';
