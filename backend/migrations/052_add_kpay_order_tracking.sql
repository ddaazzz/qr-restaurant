-- Migration: Add KPay tracking and service charge fields
-- Date: 2026-03-29

-- Add service_charge column to bill_closures
ALTER TABLE bill_closures ADD COLUMN IF NOT EXISTS service_charge BIGINT DEFAULT 0;

-- Add kpay_reference_id to orders table for tracking which KPay transaction each order belongs to
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kpay_reference_id VARCHAR(100);

-- Create index for efficient KPay lookups
CREATE INDEX IF NOT EXISTS idx_orders_kpay_reference ON orders(kpay_reference_id);
