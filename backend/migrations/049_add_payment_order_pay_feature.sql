-- Migration 049: Add Order & Pay feature flags to restaurants
-- Adds configuration for enabling/disabling Payment Asia "Order & Pay" feature
-- Ensures merchant can choose between Payment Asia (Order & Pay) or KPay (Bill Closure)

-- Add feature flags to restaurants table
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS payment_asia_order_pay_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_method_integration VARCHAR(50) DEFAULT 'kpay';
-- payment_method_integration values: 'kpay', 'payment-asia', 'both'
-- When set to 'kpay': Use KPay for bill closure payment
-- When set to 'payment-asia': Use Payment Asia for order payment (Order & Pay)
-- When set to 'both': Admin can select either method during bill closure

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_restaurants_payment_asia_enabled ON restaurants(payment_asia_order_pay_enabled);
CREATE INDEX IF NOT EXISTS idx_restaurants_payment_method_integration ON restaurants(payment_method_integration);

-- Add comments for clarity
COMMENT ON COLUMN restaurants.payment_asia_order_pay_enabled IS 'Enable Order & Pay: customers pay immediately after placing order via Payment Asia';
COMMENT ON COLUMN restaurants.payment_method_integration IS 'Which payment integration strategy: kpay=Bill Closure, payment-asia=Order & Pay, both=Flexible';
