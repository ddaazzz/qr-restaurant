-- Migration: Add KPAY to printers type constraint
-- Date: 2026-04-27
-- Purpose: Allow KPAY as a valid printer type in the printers table

ALTER TABLE printers DROP CONSTRAINT IF EXISTS printers_type_check;
ALTER TABLE printers ADD CONSTRAINT printers_type_check CHECK (type IN ('QR', 'Bill', 'Kitchen', 'KPAY'));
