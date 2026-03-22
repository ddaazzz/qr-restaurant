-- Migration 045: Add Payment Terminal Support
-- Date: 2026-03-21
-- Adds KPay payment terminal configuration support

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS active_payment_vendor VARCHAR(50);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS active_payment_terminal_id INTEGER;

CREATE TABLE IF NOT EXISTS payment_terminals (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    vendor_name VARCHAR(50) NOT NULL CHECK (vendor_name IN ('kpay','other')),
    is_active BOOLEAN DEFAULT false,
    app_id VARCHAR(255) NOT NULL,
    app_secret VARCHAR(255) NOT NULL,
    terminal_ip VARCHAR(50),
    terminal_port INTEGER,
    endpoint_path VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    last_sign_request_response JSONB,
    last_tested_at TIMESTAMP,
    last_error_message TEXT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE(restaurant_id, vendor_name)
);

CREATE INDEX IF NOT EXISTS idx_payment_terminals_restaurant_id ON payment_terminals(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_payment_terminals_vendor_active ON payment_terminals(restaurant_id, vendor_name, is_active);
