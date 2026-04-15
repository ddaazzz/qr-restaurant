-- Migration 069: Add customer_phone to table_sessions for to-go/counter orders
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);
