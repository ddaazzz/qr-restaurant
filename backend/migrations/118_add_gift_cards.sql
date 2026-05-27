-- Migration 118: Prepaid gift cards (purchase-and-use-as-credit)
CREATE TABLE IF NOT EXISTS gift_cards (
  id                    SERIAL PRIMARY KEY,
  restaurant_id         INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  code                  VARCHAR(20) NOT NULL,
  original_value_cents  INTEGER NOT NULL,
  balance_cents         INTEGER NOT NULL,
  purchaser_name        VARCHAR(255),
  purchaser_email       VARCHAR(255),
  purchaser_phone       VARCHAR(50),
  note                  TEXT,
  issued_at             TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMP,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_gift_cards_restaurant ON gift_cards(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code        ON gift_cards(code);
