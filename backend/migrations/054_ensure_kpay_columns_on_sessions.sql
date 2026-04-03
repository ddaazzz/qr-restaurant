-- Migration: Ensure all KPay columns exist on table_sessions
-- Date: 2026-03-30
-- Purpose: Fix missing KPay columns on table_sessions (in case previous migration didn't apply)

-- Add KPay reference ID to table_sessions for payment tracking
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS kpay_reference_id VARCHAR(100);

-- Add payment status tracking
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';

-- Add error message for KPay payment failures  
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS kpay_error_message TEXT;

-- Add payment completion timestamp
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMP;

-- Add payment terminal reference
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS payment_terminal_id INTEGER REFERENCES payment_terminals(id);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_table_sessions_kpay_ref ON table_sessions(kpay_reference_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_payment_status ON table_sessions(payment_status);
