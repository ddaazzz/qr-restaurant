-- Migration 100: Add void/refund vendor reference tracking to orders
-- Date: 2026-05-07
-- Purpose: Allow device-direct void/refund flows (KPay, PA Offline) to record
--          the terminal-side reference number against the original order, so the
--          admin UI can display "voided via VOID-xxx" / "refunded via REF-xxx"
--          alongside the original order without creating new order rows.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS void_vendor_ref   VARCHAR(120),  -- e.g. "VOID-1746620000000" (KPay) or PA orderId
  ADD COLUMN IF NOT EXISTS refund_vendor_ref VARCHAR(120);  -- e.g. "REF-1746620000000"  (KPay) or PA orderId

CREATE INDEX IF NOT EXISTS idx_orders_void_vendor_ref   ON orders(void_vendor_ref)   WHERE void_vendor_ref   IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_refund_vendor_ref ON orders(refund_vendor_ref) WHERE refund_vendor_ref IS NOT NULL;
