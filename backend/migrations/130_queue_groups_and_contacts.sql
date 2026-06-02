-- Migration 130: Queue groups (A/B/C) and contact collection
-- Replaces pax_bands concept with lettered groups (A, B, C) customizable per restaurant.
-- Each group has its own sequential numbering: A001, A002, B001, etc.
-- Adds optional contact capture (name / phone / email) when customer joins queue.

-- ─── queue_settings: new columns ────────────────────────────────────────────
ALTER TABLE queue_settings
  ADD COLUMN IF NOT EXISTS groups JSONB NOT NULL DEFAULT '[
    {"letter":"A","label":"A","pax_min":1,"pax_max":2,"active":true},
    {"letter":"B","label":"B","pax_min":3,"pax_max":4,"active":true},
    {"letter":"C","label":"C","pax_min":5,"pax_max":20,"active":true}
  ]'::jsonb,
  ADD COLUMN IF NOT EXISTS collect_name  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS collect_phone BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS collect_email BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_pax       INT     NOT NULL DEFAULT 20;

-- ─── queue_entries: new columns ─────────────────────────────────────────────
ALTER TABLE queue_entries
  ADD COLUMN IF NOT EXISTS group_letter    VARCHAR(1),
  ADD COLUMN IF NOT EXISTS group_number    INT,
  ADD COLUMN IF NOT EXISTS contact_name    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS contact_phone   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS contact_email   VARCHAR(200),
  ADD COLUMN IF NOT EXISTS crm_customer_id INT REFERENCES crm_customers(id) ON DELETE SET NULL;

-- Composite index for group-based ordering in admin view
CREATE INDEX IF NOT EXISTS idx_queue_entries_group
  ON queue_entries (restaurant_id, group_letter, status, group_number);
