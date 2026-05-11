-- Migration 112: XISH Apple Wallet device registrations for PassKit push updates
-- Each row = one physical device registered for one pass serial.
-- When we award points we push to every push_token for the member → iOS Wallet
-- fetches the updated .pkpass from GET /api/xish/wallet/passkit/v1/passes/...

CREATE TABLE IF NOT EXISTS xish_wallet_device_registrations (
  id                 SERIAL PRIMARY KEY,
  device_library_id  VARCHAR(255) NOT NULL,
  push_token         VARCHAR(255) NOT NULL,
  pass_type_id       VARCHAR(255) NOT NULL DEFAULT 'pass.io.xish.loyalty',
  pass_serial        VARCHAR(255) NOT NULL,
  member_id          INTEGER NOT NULL REFERENCES xish_members(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_library_id, pass_serial)
);

CREATE INDEX IF NOT EXISTS idx_xish_wallet_reg_serial   ON xish_wallet_device_registrations(pass_serial);
CREATE INDEX IF NOT EXISTS idx_xish_wallet_reg_member   ON xish_wallet_device_registrations(member_id);
CREATE INDEX IF NOT EXISTS idx_xish_wallet_reg_pushtoken ON xish_wallet_device_registrations(push_token);
