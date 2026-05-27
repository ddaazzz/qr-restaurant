-- Migration 124: Rename concept separation for coupons vs vouchers
-- "Voucher" = code-based discount entered at checkout (existing 'open'/'closed' coupons)
-- "Coupon"  = points-redeemable reward from the loyalty catalog (xish_gift_coupons)
-- Add redemption_type to the coupons table to distinguish legacy voucher codes
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS redemption_type TEXT NOT NULL DEFAULT 'voucher_code'
  CHECK (redemption_type IN ('voucher_code', 'points'));
