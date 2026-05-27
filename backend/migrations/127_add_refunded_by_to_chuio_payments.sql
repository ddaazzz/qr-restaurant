-- Migration 127: Track which staff member performed a refund
ALTER TABLE chuio_payments
  ADD COLUMN IF NOT EXISTS refunded_by_staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN chuio_payments.refunded_by_staff_id
  IS 'Staff user ID who initiated the refund via the admin app';
