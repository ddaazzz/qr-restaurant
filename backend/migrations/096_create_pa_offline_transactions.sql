-- Migration 096: Create pa_offline_transactions table
-- Date: 2026-04-29
-- Purpose: Store Payment Asia Offline terminal transactions separately from KPay

CREATE TABLE IF NOT EXISTS pa_offline_transactions (
  id                   SERIAL PRIMARY KEY,
  restaurant_id        INTEGER NOT NULL,
  -- Our order identifier sent to the terminal (also used for /order/query and /order/void)
  pa_order_id          VARCHAR(100) NOT NULL,
  -- Fields returned by PA /order/create and /order/query
  request_reference    VARCHAR(200),        -- PA internal request UUID
  merchant_reference   VARCHAR(200),        -- PA echo of our order_id
  provider_reference   VARCHAR(200),        -- PA provider (acquirer) reference
  -- Payment details
  amount_cents         BIGINT NOT NULL,
  currency             VARCHAR(10) DEFAULT 'HKD',
  payment_method       VARCHAR(50),         -- QR_CODE / CREDITCARD / CUP_CARD / OCTOPUS
  -- PA query fields
  provider             VARCHAR(100),        -- e.g. CREDITCARDOFFLINE, ALIPAYOFFLINE
  transaction_type     VARCHAR(20),         -- Sale / Refund (from PA /order/query response)
  pa_status_code       VARCHAR(10),         -- Raw status from PA ("1"=completed, "0"=pending …)
  remark               TEXT,
  -- Timestamps from PA response (Unix seconds)
  pa_created_time      BIGINT,
  pa_completed_time    BIGINT,
  -- Our tracking
  status               VARCHAR(50) DEFAULT 'pending',  -- pending / completed / cancelled / failed / closed
  pa_response          JSONB,               -- Full last PA response payload (for audit)
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at         TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pa_offline_order_id   ON pa_offline_transactions(pa_order_id);
CREATE INDEX IF NOT EXISTS idx_pa_offline_restaurant ON pa_offline_transactions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_pa_offline_status     ON pa_offline_transactions(restaurant_id, status);
