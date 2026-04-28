-- Migration: Add KPAY to printers type constraint
-- Date: 2026-04-27
-- Purpose: Allow KPAY as a valid printer type in the printers table

DO $$
BEGIN
  -- Drop existing constraint regardless of its current definition
  ALTER TABLE printers DROP CONSTRAINT IF EXISTS printers_type_check;
  -- Re-add with KPAY included
  ALTER TABLE printers ADD CONSTRAINT printers_type_check CHECK (type IN ('QR', 'Bill', 'Kitchen', 'KPAY'));
EXCEPTION WHEN others THEN
  -- If constraint already exists with the correct definition, ignore
  NULL;
END;
$$;
