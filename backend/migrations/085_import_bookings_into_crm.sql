-- Migration 085: one-time import of historical booking guests into crm_customers
-- Runs once at deploy time; safe to re-run (INSERT WHERE NOT EXISTS / COALESCE update).

-- Step 1: Insert net-new booking guests (skip any that already have a matching phone or name).
WITH booking_guests AS (
  SELECT
    restaurant_id,
    TRIM(guest_name)            AS name,
    NULLIF(TRIM(phone), '')     AS phone,
    NULLIF(TRIM(email), '')     AS email,
    COUNT(*)::int               AS booking_count
  FROM bookings
  WHERE guest_name IS NOT NULL AND TRIM(guest_name) <> ''
  GROUP BY restaurant_id, TRIM(guest_name), NULLIF(TRIM(phone), ''), NULLIF(TRIM(email), '')
)
INSERT INTO crm_customers (restaurant_id, name, phone, email, total_visits, created_at, updated_at)
SELECT
  bg.restaurant_id,
  bg.name,
  bg.phone,
  bg.email,
  bg.booking_count,
  NOW(),
  NOW()
FROM booking_guests bg
WHERE NOT EXISTS (
  SELECT 1
  FROM crm_customers cc
  WHERE cc.restaurant_id = bg.restaurant_id
    AND (
      (bg.phone IS NOT NULL AND cc.phone = bg.phone)
      OR (bg.phone IS NULL AND cc.name = bg.name AND (cc.phone IS NULL OR cc.phone = ''))
    )
);

-- Step 2: Backfill phone/email onto existing customers that lack them.
UPDATE crm_customers cc
SET
  phone      = COALESCE(NULLIF(cc.phone, ''), bg.phone),
  email      = COALESCE(NULLIF(cc.email, ''), bg.email),
  updated_at = NOW()
FROM (
  SELECT
    restaurant_id,
    TRIM(guest_name)        AS name,
    NULLIF(TRIM(phone), '') AS phone,
    NULLIF(TRIM(email), '') AS email
  FROM bookings
  WHERE guest_name IS NOT NULL AND TRIM(guest_name) <> ''
    AND phone IS NOT NULL AND TRIM(phone) <> ''
  GROUP BY restaurant_id, TRIM(guest_name), NULLIF(TRIM(phone), ''), NULLIF(TRIM(email), '')
) bg
WHERE cc.restaurant_id = bg.restaurant_id
  AND cc.name = bg.name
  AND (cc.phone IS NULL OR cc.phone = '');

-- Step 3: Refresh visit counts and spend from actual orders linked by phone or name.
UPDATE crm_customers cc
SET
  total_visits      = sub.visit_count,
  total_spent_cents = sub.spent_cents,
  last_visit_at     = sub.last_visit
FROM (
  SELECT
    ccc.id                   AS customer_id,
    COUNT(DISTINCT o.id)::int AS visit_count,
    COALESCE(SUM(oi.price_cents * oi.quantity) FILTER (WHERE oi.removed = false), 0) AS spent_cents,
    MAX(o.created_at)        AS last_visit
  FROM crm_customers ccc
  JOIN table_sessions ts ON ts.restaurant_id = ccc.restaurant_id
    AND (
      (ts.customer_phone IS NOT NULL AND ts.customer_phone <> '' AND ts.customer_phone = ccc.phone)
      OR (ts.customer_name IS NOT NULL AND ts.customer_name = ccc.name)
    )
  JOIN orders o ON o.session_id = ts.id AND o.restaurant_id = ccc.restaurant_id
  LEFT JOIN order_items oi ON oi.order_id = o.id
  GROUP BY ccc.id
) sub
WHERE cc.id = sub.customer_id;
