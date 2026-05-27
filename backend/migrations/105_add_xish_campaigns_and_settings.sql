-- Migration 105: XISH discount settings, gift settings, and notification campaigns

-- ─── xish_discount_settings ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS xish_discount_settings (
  id                      SERIAL PRIMARY KEY,
  restaurant_id           INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  tier                    VARCHAR(20) NOT NULL DEFAULT 'basic'
    CHECK (tier IN ('basic','silver','gold','platinum')),
  discount_percent        NUMERIC(5,2) NOT NULL DEFAULT 0,
  usage_limit_per_member  INTEGER,
  valid_days_of_week      JSONB DEFAULT '[0,1,2,3,4,5,6]',  -- 0=Sun … 6=Sat
  valid_from              TIMESTAMP,
  valid_until             TIMESTAMP,
  applicable_outlet_ids   JSONB DEFAULT '[]',
  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xish_discount_restaurant ON xish_discount_settings(restaurant_id);

-- ─── xish_gift_settings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xish_gift_settings (
  id                  SERIAL PRIMARY KEY,
  restaurant_id       INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  item_name           VARCHAR(255) NOT NULL,
  menu_item_id        INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
  quantity            INTEGER NOT NULL DEFAULT 1,
  redemption_start    TIMESTAMP,
  redemption_end      TIMESTAMP,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xish_gift_restaurant ON xish_gift_settings(restaurant_id);

-- ─── xish_campaigns ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xish_campaigns (
  id                          SERIAL PRIMARY KEY,
  restaurant_id               INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title                       VARCHAR(255) NOT NULL,
  body                        TEXT NOT NULL,
  target_previous_diners_only BOOLEAN NOT NULL DEFAULT true,
  filter_age_min              INTEGER,
  filter_age_max              INTEGER,
  filter_gender               VARCHAR(10),
  filter_birthday_month       INTEGER CHECK (filter_birthday_month BETWEEN 1 AND 12),
  frequency_cooldown_hours    INTEGER DEFAULT 24,
  trigger_type                VARCHAR(20) NOT NULL DEFAULT 'instant'
    CHECK (trigger_type IN ('instant','automated')),
  trigger_rule                JSONB DEFAULT '{}',  -- e.g. {"no_visit_days": 30}
  action_deep_link            TEXT,
  scheduled_at                TIMESTAMP,
  sent_at                     TIMESTAMP,
  created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xish_campaigns_restaurant ON xish_campaigns(restaurant_id);
