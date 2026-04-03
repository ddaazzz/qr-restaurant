-- Migration 046: Add Payment Terminal Keys Storage
-- Date: 2026-03-23
-- Adds columns to store platform public key and app private key from key exchange

ALTER TABLE payment_terminals 
ADD COLUMN IF NOT EXISTS platform_public_key TEXT,
ADD COLUMN IF NOT EXISTS app_private_key TEXT,
ADD COLUMN IF NOT EXISTS keys_exchanged_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS keys_expire_at TIMESTAMP;

-- Create an index for checking key validity
CREATE INDEX IF NOT EXISTS idx_payment_terminals_keys_valid ON payment_terminals(restaurant_id, keys_exchanged_at);
