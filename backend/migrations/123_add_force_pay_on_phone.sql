-- Migration 123: Add force_pay_on_phone toggle to restaurants
-- When true + online payment configured, customers must pay on their phone before order is confirmed.
-- When false (default), orders are confirmed and sent; POS/admin settles the bill.
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS force_pay_on_phone BOOLEAN NOT NULL DEFAULT false;
