-- Migration 068: Add customer_name to table_sessions and CRM tables

-- Add customer_name to table_sessions for to-go orders
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);

-- ────────────────────────────────────────────────────────────────
-- CRM: customers table
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_customers (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  phone           VARCHAR(50),
  email           VARCHAR(255),
  notes           TEXT,
  total_visits    INTEGER DEFAULT 0,
  total_spent_cents BIGINT DEFAULT 0,
  last_visit_at   TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_customers_restaurant ON crm_customers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_crm_customers_phone ON crm_customers(restaurant_id, phone);
CREATE INDEX IF NOT EXISTS idx_crm_customers_email ON crm_customers(restaurant_id, email);

-- ────────────────────────────────────────────────────────────────
-- CRM: link orders to customers
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_customer_orders (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  session_id      INTEGER REFERENCES table_sessions(id) ON DELETE SET NULL,
  total_cents     BIGINT DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_customer_orders_customer ON crm_customer_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_customer_orders_order ON crm_customer_orders(order_id);

-- ────────────────────────────────────────────────────────────────
-- CRM: offers / promotions
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_offers (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  offer_type      VARCHAR(30) NOT NULL CHECK (offer_type IN ('percentage', 'fixed', 'freebie', 'bogo')),
  offer_value     NUMERIC DEFAULT 0,
  coupon_id       INTEGER REFERENCES coupons(id) ON DELETE SET NULL,
  min_order_cents BIGINT DEFAULT 0,
  max_uses        INTEGER,
  current_uses    INTEGER DEFAULT 0,
  valid_from      TIMESTAMP,
  valid_until     TIMESTAMP,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_offers_restaurant ON crm_offers(restaurant_id);

-- ────────────────────────────────────────────────────────────────
-- CRM: offers assigned to customers
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_customer_offers (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  offer_id        INTEGER NOT NULL REFERENCES crm_offers(id) ON DELETE CASCADE,
  redeemed        BOOLEAN DEFAULT false,
  redeemed_at     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, offer_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_customer_offers_customer ON crm_customer_offers(customer_id);
