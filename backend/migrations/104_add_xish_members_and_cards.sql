-- Migration 104: XISH members, loyalty cards, gift coupons

-- ─── xish_members ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xish_members (
  id               SERIAL PRIMARY KEY,
  crm_customer_id  INTEGER NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  points_balance   INTEGER NOT NULL DEFAULT 0,
  tier             VARCHAR(20) NOT NULL DEFAULT 'basic'
    CHECK (tier IN ('basic','silver','gold','platinum')),
  wallet_id        VARCHAR(255) UNIQUE,
  wallet_type      VARCHAR(10) DEFAULT NULL CHECK (wallet_type IN ('apple','google', NULL)),
  xish_id          VARCHAR(20) UNIQUE,   -- numeric XISH ID shown as barcode/QR on pass
  joined_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xish_members_crm    ON xish_members(crm_customer_id);
CREATE INDEX IF NOT EXISTS idx_xish_members_wallet ON xish_members(wallet_id);
CREATE INDEX IF NOT EXISTS idx_xish_members_xish_id ON xish_members(xish_id);

-- ─── xish_loyalty_cards ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xish_loyalty_cards (
  id              SERIAL PRIMARY KEY,
  member_id       INTEGER NOT NULL REFERENCES xish_members(id) ON DELETE CASCADE,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  card_type       VARCHAR(30) NOT NULL DEFAULT 'points',
  balance_cents   BIGINT NOT NULL DEFAULT 0,
  issued_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMP,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xish_cards_member     ON xish_loyalty_cards(member_id);
CREATE INDEX IF NOT EXISTS idx_xish_cards_restaurant ON xish_loyalty_cards(restaurant_id);

-- ─── xish_gift_coupons ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xish_gift_coupons (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  member_id       INTEGER REFERENCES xish_members(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  item_reward     VARCHAR(255),
  qty_remaining   INTEGER NOT NULL DEFAULT 1,
  valid_from      TIMESTAMP,
  valid_until     TIMESTAMP,
  redeemed_at     TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xish_gift_coupons_restaurant ON xish_gift_coupons(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_xish_gift_coupons_member     ON xish_gift_coupons(member_id);

-- ─── xish_point_transactions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS xish_point_transactions (
  id              SERIAL PRIMARY KEY,
  member_id       INTEGER NOT NULL REFERENCES xish_members(id) ON DELETE CASCADE,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  session_id      INTEGER REFERENCES table_sessions(id) ON DELETE SET NULL,
  points_delta    INTEGER NOT NULL,
  reason          VARCHAR(100) NOT NULL DEFAULT 'purchase',
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xish_pts_member     ON xish_point_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_xish_pts_restaurant ON xish_point_transactions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_xish_pts_session    ON xish_point_transactions(session_id);
