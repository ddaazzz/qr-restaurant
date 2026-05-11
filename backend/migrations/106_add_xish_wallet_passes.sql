-- Migration 106: XISH wallet passes (Apple / Google Wallet)

CREATE TABLE IF NOT EXISTS xish_wallet_passes (
  id                    SERIAL PRIMARY KEY,
  member_id             INTEGER NOT NULL REFERENCES xish_members(id) ON DELETE CASCADE,
  pass_type             VARCHAR(10) NOT NULL CHECK (pass_type IN ('apple','google')),
  pass_serial           VARCHAR(255),
  pass_auth_token       VARCHAR(255),
  nearby_merchant_ids   JSONB DEFAULT '[]',
  last_updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, pass_type)
);

CREATE INDEX IF NOT EXISTS idx_xish_passes_member ON xish_wallet_passes(member_id);
CREATE INDEX IF NOT EXISTS idx_xish_passes_serial ON xish_wallet_passes(pass_serial);
