-- Migration: Add Receipt to printers type constraint
-- Date: 2026-05-14
-- Purpose: Allow 'Receipt' as a valid printer type for post-payment receipt printing

ALTER TABLE printers DROP CONSTRAINT IF EXISTS printers_type_check;
ALTER TABLE printers ADD CONSTRAINT printers_type_check CHECK (type IN ('QR', 'Bill', 'Kitchen', 'KPAY', 'Receipt'));
