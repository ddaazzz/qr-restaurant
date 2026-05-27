-- Migration 111: Recalculate all xish_member tiers based on current points_balance
-- and each restaurant's xish_tier_settings (fixes stale/incorrect tier values)

UPDATE xish_members m
SET tier = COALESCE(
  (
    SELECT ts.tier
    FROM xish_tier_settings ts
    JOIN crm_customers c ON c.id = m.crm_customer_id
    WHERE ts.restaurant_id = c.restaurant_id
      AND ts.is_active = true
      AND m.points_balance >= ts.points_threshold
    ORDER BY ts.points_threshold DESC
    LIMIT 1
  ),
  'basic'
),
updated_at = NOW();

-- Sync xish_member_status on crm_customers to match the corrected tier
UPDATE crm_customers c
SET xish_member_status = m.tier,
    updated_at = NOW()
FROM xish_members m
WHERE m.crm_customer_id = c.id;
