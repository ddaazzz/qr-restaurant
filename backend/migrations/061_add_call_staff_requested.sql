-- Add call_staff_requested flag to table_sessions
-- Customers can tap "Call Staff" to notify staff from the orders drawer

ALTER TABLE table_sessions
  ADD COLUMN IF NOT EXISTS call_staff_requested BOOLEAN NOT NULL DEFAULT FALSE;
