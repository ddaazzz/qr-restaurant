-- Migration 012: Add bill_closure_requested column to table_sessions
-- Purpose: Allow customers to request bill closure without immediately ending session
-- Admin/staff then sees orange table card and can close the bill

-- Add bill_closure_requested column to track if customer requested closure
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS bill_closure_requested BOOLEAN DEFAULT FALSE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_table_sessions_bill_closure_requested 
  ON table_sessions(bill_closure_requested) 
  WHERE bill_closure_requested = TRUE;
