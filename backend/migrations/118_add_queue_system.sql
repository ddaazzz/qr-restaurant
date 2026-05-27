-- Migration 118: Table queuing system
-- queue_settings: per-restaurant config (pax bands, enabled flag, QR token)
-- queue_entries: individual queue slots

CREATE TABLE IF NOT EXISTS queue_settings (
  restaurant_id   INT PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  pax_bands       JSONB NOT NULL DEFAULT '[
    {"min":1,"max":2,"label":"1–2 pax"},
    {"min":3,"max":4,"label":"3–4 pax"},
    {"min":5,"max":8,"label":"5–8 pax"}
  ]',
  queue_qr_token  VARCHAR(64) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS queue_entries (
  id                  SERIAL PRIMARY KEY,
  restaurant_id       INT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  queue_number        INT NOT NULL,
  pax                 INT NOT NULL,
  pax_band_label      VARCHAR(80),
  status              VARCHAR(20) NOT NULL DEFAULT 'waiting',
  -- 'waiting' | 'called' | 'seated' | 'cancelled'
  pre_order_session_id INT REFERENCES table_sessions(id) ON DELETE SET NULL,
  linked_table_unit_id INT REFERENCES table_units(id) ON DELETE SET NULL,
  called_at           TIMESTAMPTZ,
  seated_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT queue_entries_status_check CHECK (status IN ('waiting','called','seated','cancelled'))
);

-- Index for fast per-restaurant lookups ordered by number
CREATE INDEX IF NOT EXISTS idx_queue_entries_restaurant_status
  ON queue_entries (restaurant_id, status, queue_number);

-- Trigger: auto-update updated_at on queue_settings
CREATE OR REPLACE FUNCTION update_queue_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_queue_settings_updated_at ON queue_settings;
CREATE TRIGGER trg_queue_settings_updated_at
  BEFORE UPDATE ON queue_settings
  FOR EACH ROW EXECUTE FUNCTION update_queue_settings_updated_at();
