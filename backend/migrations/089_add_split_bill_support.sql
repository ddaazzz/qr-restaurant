-- Migration: Add split bill support
-- Date: 2026-04-27
-- Purpose: Track split bill payments separately so closing in portions is supported

-- Add split tracking columns to table_sessions
ALTER TABLE table_sessions
  ADD COLUMN IF NOT EXISTS split_count INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS split_bills_paid INTEGER DEFAULT 0;

-- Create split_bill_payments table to track individual split payments
CREATE TABLE IF NOT EXISTS split_bill_payments (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL,
  split_index INTEGER NOT NULL,   -- 1-based (1 = first portion, 2 = second, etc.)
  split_count INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  discount_applied INTEGER NOT NULL DEFAULT 0,
  service_charge INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  kpay_reference_id TEXT DEFAULT NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  closed_by_staff_id INTEGER DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_split_bill_payments_session_id ON split_bill_payments(session_id);
CREATE INDEX IF NOT EXISTS idx_split_bill_payments_restaurant_id ON split_bill_payments(restaurant_id);
