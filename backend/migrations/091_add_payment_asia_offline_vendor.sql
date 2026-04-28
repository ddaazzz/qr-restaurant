-- Migration 091: Add payment-asia-offline to payment_terminals vendor_name constraint
-- Date: 2026-04-29

ALTER TABLE payment_terminals
  DROP CONSTRAINT IF EXISTS payment_terminals_vendor_name_check;

ALTER TABLE payment_terminals
  ADD CONSTRAINT payment_terminals_vendor_name_check
  CHECK (vendor_name IN ('kpay', 'payment-asia', 'payment-asia-offline', 'other'));
