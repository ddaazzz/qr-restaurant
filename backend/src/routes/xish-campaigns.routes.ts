import { Router } from "express";
import pool from "../config/db";

const router = Router();

// ─── ANALYTICS ───────────────────────────────────────────────────────────────

// GET /api/restaurants/:restaurantId/xish/analytics/stats
router.get("/restaurants/:restaurantId/xish/analytics/stats", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { from, to, days } = req.query as Record<string, string>;

    const daysN = days ? parseInt(days) : 30;
    const toDate   = to   ? new Date(to)   : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - daysN * 24 * 60 * 60 * 1000);

    // Previous period for comparison (same duration before fromDate)
    const periodMs = toDate.getTime() - fromDate.getTime();
    const prevFrom = new Date(fromDate.getTime() - periodMs);
    const prevTo   = fromDate;

    const [membersRes, newMembersRes, prevMembersRes, txRes, prevTxRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM xish_members m
         JOIN crm_customers c ON c.id = m.crm_customer_id
         WHERE c.restaurant_id = $1`,
        [restaurantId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM xish_members m
         JOIN crm_customers c ON c.id = m.crm_customer_id
         WHERE c.restaurant_id = $1 AND m.joined_at BETWEEN $2 AND $3`,
        [restaurantId, fromDate, toDate]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM xish_members m
         JOIN crm_customers c ON c.id = m.crm_customer_id
         WHERE c.restaurant_id = $1 AND m.joined_at BETWEEN $2 AND $3`,
        [restaurantId, prevFrom, prevTo]
      ),
      pool.query(
        `SELECT
           COUNT(DISTINCT s.id)::int                                               AS transaction_count,
           COALESCE(SUM((COALESCE(s.amount_paid,0) * 100)::bigint), 0)            AS gross_cents,
           COALESCE(SUM((COALESCE(s.discount_applied,0) * 100)::bigint), 0)       AS discount_cents
         FROM table_sessions s
         WHERE s.restaurant_id = $1
           AND s.ended_at BETWEEN $2 AND $3
           AND s.ended_at IS NOT NULL`,
        [restaurantId, fromDate, toDate]
      ),
      pool.query(
        `SELECT
           COUNT(DISTINCT s.id)::int                                               AS transaction_count,
           COALESCE(SUM((COALESCE(s.amount_paid,0) * 100)::bigint), 0)            AS gross_cents
         FROM table_sessions s
         WHERE s.restaurant_id = $1
           AND s.ended_at BETWEEN $2 AND $3
           AND s.ended_at IS NOT NULL`,
        [restaurantId, prevFrom, prevTo]
      ),
    ]);

    const gross      = Number(txRes.rows[0].gross_cents);
    const prevGross  = Number(prevTxRes.rows[0].gross_cents);
    const discount   = Number(txRes.rows[0].discount_cents);
    const txCount    = txRes.rows[0].transaction_count;
    const prevTxCount= prevTxRes.rows[0].transaction_count;
    const newMembers = newMembersRes.rows[0].total;
    const prevMembers= prevMembersRes.rows[0].total;

    function pctChange(curr: number, prev: number): number | null {
      if (prev === 0) return curr > 0 ? 100 : null;
      return Math.round(((curr - prev) / prev) * 1000) / 10;
    }

    res.json({
      total_xish_members:  membersRes.rows[0].total,
      new_registrations:   newMembers,
      new_registrations_change_pct: pctChange(newMembers, prevMembers),
      gross_transacted_cents:       gross,
      gross_change_pct:             pctChange(gross, prevGross),
      total_discount_cents:         discount,
      net_sales_cents:              gross - discount,
      transaction_count:            txCount,
      transaction_change_pct:       pctChange(txCount, prevTxCount),
      avg_order_value_cents:        txCount > 0 ? Math.round(gross / txCount) : 0,
      period: { from: fromDate, to: toDate },
    });
  } catch (err) {
    console.error("[XISH analytics stats]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DISCOUNT SETTINGS ───────────────────────────────────────────────────────

router.get("/restaurants/:restaurantId/xish/discount-settings", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM xish_discount_settings WHERE restaurant_id = $1 ORDER BY tier, discount_percent DESC`,
      [req.params.restaurantId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/restaurants/:restaurantId/xish/discount-settings", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const {
      tier, discount_percent, usage_limit_per_member,
      valid_days_of_week, valid_from, valid_until, applicable_outlet_ids,
    } = req.body;

    const r = await pool.query(
      `INSERT INTO xish_discount_settings
         (restaurant_id, tier, discount_percent, usage_limit_per_member,
          valid_days_of_week, valid_from, valid_until, applicable_outlet_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        restaurantId, tier, discount_percent, usage_limit_per_member || null,
        JSON.stringify(valid_days_of_week ?? [0,1,2,3,4,5,6]),
        valid_from || null, valid_until || null,
        JSON.stringify(applicable_outlet_ids ?? []),
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/restaurants/:restaurantId/xish/discount-settings/:id", async (req, res) => {
  try {
    const fields = req.body;
    const allowed = [
      "tier","discount_percent","usage_limit_per_member",
      "valid_days_of_week","valid_from","valid_until",
      "applicable_outlet_ids","is_active"
    ];
    const sets: string[] = [];
    const vals: any[] = [req.params.id];
    let idx = 2;
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { sets.push(`${k} = $${idx++}`); vals.push(v); }
    }
    if (!sets.length) return res.status(400).json({ error: "No valid fields" });
    sets.push(`updated_at = NOW()`);
    const r = await pool.query(
      `UPDATE xish_discount_settings SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
      vals
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/restaurants/:restaurantId/xish/discount-settings/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM xish_discount_settings WHERE id = $1 AND restaurant_id = $2`,
      [req.params.id, req.params.restaurantId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GIFT SETTINGS ───────────────────────────────────────────────────────────

router.get("/restaurants/:restaurantId/xish/gift-settings", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT gs.*, mi.name AS menu_item_name
       FROM xish_gift_settings gs
       LEFT JOIN menu_items mi ON mi.id = gs.menu_item_id
       WHERE gs.restaurant_id = $1 ORDER BY gs.created_at DESC`,
      [req.params.restaurantId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/restaurants/:restaurantId/xish/gift-settings", async (req, res) => {
  try {
    const { item_name, menu_item_id, quantity, redemption_start, redemption_end } = req.body;
    const r = await pool.query(
      `INSERT INTO xish_gift_settings (restaurant_id, item_name, menu_item_id, quantity, redemption_start, redemption_end)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.restaurantId, item_name, menu_item_id || null, quantity || 1, redemption_start || null, redemption_end || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/restaurants/:restaurantId/xish/gift-settings/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM xish_gift_settings WHERE id = $1 AND restaurant_id = $2`,
      [req.params.id, req.params.restaurantId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── CAMPAIGNS (Notifications) ───────────────────────────────────────────────

router.get("/restaurants/:restaurantId/xish/campaigns", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM xish_campaigns WHERE restaurant_id = $1 ORDER BY created_at DESC`,
      [req.params.restaurantId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/restaurants/:restaurantId/xish/campaigns", async (req, res) => {
  try {
    const {
      title, body, target_previous_diners_only, filter_age_min, filter_age_max,
      filter_gender, filter_birthday_month, frequency_cooldown_hours,
      trigger_type, trigger_rule, action_deep_link, scheduled_at,
    } = req.body;
    const r = await pool.query(
      `INSERT INTO xish_campaigns
         (restaurant_id, title, body, target_previous_diners_only,
          filter_age_min, filter_age_max, filter_gender, filter_birthday_month,
          frequency_cooldown_hours, trigger_type, trigger_rule,
          action_deep_link, scheduled_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        req.params.restaurantId, title, body,
        target_previous_diners_only ?? true,
        filter_age_min || null, filter_age_max || null,
        filter_gender || null, filter_birthday_month || null,
        frequency_cooldown_hours ?? 24,
        trigger_type || "instant",
        JSON.stringify(trigger_rule ?? {}),
        action_deep_link || null,
        scheduled_at || null,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/restaurants/:restaurantId/xish/campaigns/:id/send
// Resolves target audience and marks sent_at (push delivery is a future integration)
router.post("/restaurants/:restaurantId/xish/campaigns/:id/send", async (req, res) => {
  try {
    const { restaurantId, id } = req.params;
    const campaignRes = await pool.query(
      `SELECT * FROM xish_campaigns WHERE id = $1 AND restaurant_id = $2`,
      [id, restaurantId]
    );
    if (!campaignRes.rows[0]) return res.status(404).json({ error: "Campaign not found" });
    const c = campaignRes.rows[0];

    // Build audience query
    const conditions: string[] = ["c.restaurant_id = $1"];
    const vals: any[] = [restaurantId];
    let idx = 2;

    if (c.target_previous_diners_only) conditions.push(`c.is_previous_diner = true`);
    if (c.filter_gender) { conditions.push(`c.gender = $${idx++}`); vals.push(c.filter_gender); }
    if (c.filter_birthday_month) {
      conditions.push(`EXTRACT(MONTH FROM c.date_of_birth) = $${idx++}`);
      vals.push(c.filter_birthday_month);
    }
    if (c.filter_age_min) {
      conditions.push(`DATE_PART('year', AGE(c.date_of_birth)) >= $${idx++}`);
      vals.push(c.filter_age_min);
    }
    if (c.filter_age_max) {
      conditions.push(`DATE_PART('year', AGE(c.date_of_birth)) <= $${idx++}`);
      vals.push(c.filter_age_max);
    }

    const audienceRes = await pool.query(
      `SELECT c.id, c.name, c.email, c.phone FROM crm_customers c WHERE ${conditions.join(" AND ")}`,
      vals
    );

    await pool.query(
      `UPDATE xish_campaigns SET sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );

    res.json({
      ok: true,
      audience_count: audienceRes.rows.length,
      campaign_id: id,
    });
  } catch (err) {
    console.error("[XISH campaign send]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── COUPON → XISH GIFT SYNC ─────────────────────────────────────────────────

// POST /api/restaurants/:restaurantId/xish/sync-coupon
// Converts a Chuio coupon into an XISH gift reward (idempotent: upsert by coupon_id)
router.post("/restaurants/:restaurantId/xish/sync-coupon", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { coupon_id } = req.body;
    if (!coupon_id) return res.status(400).json({ error: "coupon_id required" });

    // Fetch the coupon
    const couponRes = await pool.query(
      `SELECT id, code, discount_type, discount_value, description, valid_until, coupon_type
       FROM coupons WHERE id = $1 AND restaurant_id = $2`,
      [coupon_id, restaurantId]
    );
    if (!couponRes.rows.length) return res.status(404).json({ error: "Coupon not found" });
    const c = couponRes.rows[0];

    // Build a human-readable item name
    const discLabel = c.discount_type === 'percentage'
      ? `${c.discount_value}% off`
      : `$${c.discount_value} off`;
    const itemName = c.description
      ? `${c.description} (${discLabel})`
      : `Coupon ${c.code}: ${discLabel}`;

    // Upsert into xish_gift_settings using the coupon id stored in metadata
    const result = await pool.query(
      `INSERT INTO xish_gift_settings
         (restaurant_id, item_name, item_type, quantity, redemption_start, redemption_end, metadata)
       VALUES ($1, $2, 'coupon', 1, NOW(), $3, $4)
       ON CONFLICT (restaurant_id, item_name)
       DO UPDATE SET
         item_type = 'coupon',
         quantity = 1,
         redemption_end = EXCLUDED.redemption_end,
         metadata = EXCLUDED.metadata
       RETURNING *`,
      [
        restaurantId,
        itemName,
        c.valid_until || null,
        JSON.stringify({ source: 'chuio_coupon', coupon_id: c.id, coupon_code: c.code }),
      ]
    );

    res.json({ ok: true, gift: result.rows[0] });
  } catch (err) {
    console.error("[XISH sync-coupon]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── RECENT TRANSACTIONS (for admin dashboard) ───────────────────────────────

// GET /api/restaurants/:restaurantId/xish/recent-transactions
router.get("/restaurants/:restaurantId/xish/recent-transactions", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const result = await pool.query(
      `SELECT pt.id, pt.points_delta, pt.reason, pt.created_at,
              c.name AS member_name, m.xish_id
       FROM xish_point_transactions pt
       JOIN xish_members m ON m.id = pt.member_id
       JOIN crm_customers c ON c.id = m.crm_customer_id
       WHERE pt.restaurant_id = $1
       ORDER BY pt.created_at DESC
       LIMIT $2`,
      [restaurantId, limit]
    );

    res.json({ transactions: result.rows });
  } catch (err) {
    console.error("[XISH recent-tx]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── TIER SETTINGS ───────────────────────────────────────────────────────────

const DEFAULT_TIERS = [
  { tier: "basic",    points_threshold: 0,     discount_percent: 0  },
  { tier: "silver",   points_threshold: 500,   discount_percent: 5  },
  { tier: "gold",     points_threshold: 2000,  discount_percent: 10 },
  { tier: "platinum", points_threshold: 10000, discount_percent: 15 },
];

// GET /api/restaurants/:restaurantId/xish/tier-settings
router.get("/restaurants/:restaurantId/xish/tier-settings", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    let rows = (await pool.query(
      `SELECT tier, points_threshold, discount_percent, is_active
       FROM xish_tier_settings
       WHERE restaurant_id = $1
       ORDER BY points_threshold ASC`,
      [restaurantId]
    )).rows;

    // If no rows yet, seed defaults into DB and return them
    if (rows.length === 0) {
      await pool.query(
        `INSERT INTO xish_tier_settings (restaurant_id, tier, points_threshold, discount_percent)
         VALUES ($1,'basic',0,0), ($1,'silver',500,5), ($1,'gold',2000,10), ($1,'platinum',10000,15)
         ON CONFLICT (restaurant_id, tier) DO NOTHING`,
        [restaurantId]
      );
      rows = DEFAULT_TIERS.map(t => ({ ...t, is_active: true }));
    }

    // Load points_per_dollar from restaurant feature_flags (default 1)
    let points_per_dollar = 1;
    try {
      const rRes = await pool.query(
        `SELECT feature_flags FROM restaurants WHERE id = $1`,
        [restaurantId]
      );
      if (rRes.rows[0]?.feature_flags?.points_per_dollar !== undefined) {
        points_per_dollar = Number(rRes.rows[0].feature_flags.points_per_dollar) || 1;
      }
    } catch {}

    res.json({ tiers: rows, points_per_dollar });
  } catch (err) {
    console.error("[XISH tier-settings GET]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/restaurants/:restaurantId/xish/tier-settings
// Body: { tiers: [{ tier, points_threshold, discount_percent, is_active }], points_per_dollar? }
router.put("/restaurants/:restaurantId/xish/tier-settings", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { tiers, points_per_dollar } = req.body as { tiers: Array<{ tier: string; points_threshold: number; discount_percent: number; is_active?: boolean }>; points_per_dollar?: number };
    if (!Array.isArray(tiers) || tiers.length === 0) {
      return res.status(400).json({ error: "tiers array required" });
    }

    const validTiers = ["basic", "silver", "gold", "platinum"];
    for (const t of tiers) {
      if (!validTiers.includes(t.tier)) return res.status(400).json({ error: `Invalid tier: ${t.tier}` });
      if (typeof t.points_threshold !== "number" || t.points_threshold < 0)
        return res.status(400).json({ error: `Invalid points_threshold for ${t.tier}` });
      if (typeof t.discount_percent !== "number" || t.discount_percent < 0 || t.discount_percent > 100)
        return res.status(400).json({ error: `Invalid discount_percent for ${t.tier}` });
    }

    for (const t of tiers) {
      await pool.query(
        `INSERT INTO xish_tier_settings (restaurant_id, tier, points_threshold, discount_percent, is_active, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (restaurant_id, tier)
         DO UPDATE SET points_threshold = $3, discount_percent = $4, is_active = $5, updated_at = NOW()`,
        [restaurantId, t.tier, t.points_threshold, t.discount_percent, t.is_active !== false]
      );
    }

    // Persist points_per_dollar in feature_flags
    if (points_per_dollar !== undefined) {
      const ppd = Math.max(0.01, Number(points_per_dollar) || 1);
      await pool.query(
        `UPDATE restaurants
         SET feature_flags = COALESCE(feature_flags, '{}'::jsonb) || jsonb_build_object('points_per_dollar', $2::numeric)
         WHERE id = $1`,
        [restaurantId, ppd]
      );
    }

    const rows = (await pool.query(
      `SELECT tier, points_threshold, discount_percent, is_active
       FROM xish_tier_settings WHERE restaurant_id = $1 ORDER BY points_threshold ASC`,
      [restaurantId]
    )).rows;

    res.json({ ok: true, tiers: rows, points_per_dollar: points_per_dollar ?? 1 });
  } catch (err) {
    console.error("[XISH tier-settings PUT]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
