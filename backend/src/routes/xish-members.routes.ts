import { Router } from "express";
import pool from "../config/db";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendPassUpdatePush } from "../utils/xish-apns";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "xish-secret-change-in-prod";

async function safeQuery(sql: string, params: any[] = []) {
  try {
    return await pool.query(sql, params);
  } catch (err) {
    console.error("[XISH safeQuery]", err);
    return { rows: [] as any[] };
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function generateXishId(): string {
  // 10-digit numeric ID, zero-padded, compatible with barcode scanners
  return String(Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000);
}

// ─── GET /api/restaurants/:restaurantId/xish/members ─────────────────────────
// List all XISH members for this restaurant (via crm_customers join)
router.get("/restaurants/:restaurantId/xish/members", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const {
      status,
      is_previous_diner,
      tier,
      page = "1",
      limit = "50",
      search,
    } = req.query as Record<string, string>;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions: string[] = ["c.restaurant_id = $1"];
    const values: any[] = [restaurantId];
    let idx = 2;

    if (status && status !== "all") {
      conditions.push(`c.xish_member_status = $${idx++}`);
      values.push(status);
    }
    if (is_previous_diner === "true") {
      conditions.push(`c.is_previous_diner = true`);
    }
    if (tier && tier !== "all") {
      conditions.push(`m.tier = $${idx++}`);
      values.push(tier);
    }
    if (search) {
      conditions.push(`(c.name ILIKE $${idx} OR c.phone ILIKE $${idx} OR c.email ILIKE $${idx} OR m.xish_id ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const where = conditions.join(" AND ");

    const result = await pool.query(
      `SELECT
         c.id                        AS crm_customer_id,
         c.name,
         c.phone,
         c.email,
         c.total_visits,
         c.total_spent_cents,
         c.last_visit_at,
         c.xish_member_status,
         c.is_previous_diner,
         c.xish_discount_usage_count,
         c.gender,
         c.date_of_birth,
         c.created_at                AS registered_at,
         m.id                        AS xish_member_id,
         m.points_balance,
         m.tier,
         m.xish_id,
         m.joined_at,
         (
           SELECT COUNT(*)::int
           FROM xish_gift_coupons gc
           WHERE gc.member_id = m.id
             AND gc.qty_remaining > 0
             AND (gc.valid_until IS NULL OR gc.valid_until > NOW())
         )                           AS active_coupons,
         (
           SELECT COALESCE(SUM(lc.balance_cents), 0)
           FROM xish_loyalty_cards lc
           WHERE lc.member_id = m.id
             AND lc.is_active = true
             AND lc.restaurant_id = c.restaurant_id
         )                           AS card_balance_cents
       FROM crm_customers c
       LEFT JOIN LATERAL (
         SELECT * FROM xish_members
         WHERE crm_customer_id = c.id
         ORDER BY id DESC
         LIMIT 1
       ) m ON true
       WHERE ${where}
       ORDER BY c.last_visit_at DESC NULLS LAST
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, parseInt(limit), offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(DISTINCT c.id)::int AS total
       FROM crm_customers c
       LEFT JOIN LATERAL (
         SELECT * FROM xish_members
         WHERE crm_customer_id = c.id
         ORDER BY id DESC
         LIMIT 1
       ) m ON true
       WHERE ${where}`,
      values
    );

    res.json({ members: result.rows, total: countRes.rows[0].total });
  } catch (err) {
    console.error("[XISH members list]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/xish/members/:memberId ─────────────────────────────────────────
router.get("/xish/members/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;
    if (!/^\d+$/.test(String(memberId))) {
      return res.status(400).json({ error: "Invalid member ID" });
    }

    const memberRes = await pool.query(
      `SELECT
         m.*,
         c.name, c.phone, c.email, c.restaurant_id,
         c.created_at AS registered_at
       FROM xish_members m
       JOIN crm_customers c ON c.id = m.crm_customer_id
       WHERE m.id = $1`,
      [memberId]
    );
    if (!memberRes.rows[0]) return res.status(404).json({ error: "Member not found" });

    const member = memberRes.rows[0];

    const [cardsRes, couponsRes, pointsRes] = await Promise.all([
      safeQuery(
        `SELECT * FROM xish_loyalty_cards WHERE member_id = $1 AND is_active = true ORDER BY issued_at DESC`,
        [memberId]
      ),
      safeQuery(
        `SELECT gc.*, gs.item_type AS setting_type
         FROM xish_gift_coupons gc
         LEFT JOIN xish_gift_settings gs ON gs.id = gc.gift_setting_id
         WHERE gc.member_id = $1
         ORDER BY gc.created_at DESC`,
        [memberId]
      ),
      safeQuery(
        `SELECT pt.*, r.name AS restaurant_name
         FROM xish_point_transactions pt
         JOIN restaurants r ON r.id = pt.restaurant_id
         WHERE pt.member_id = $1
         ORDER BY pt.created_at DESC LIMIT 50`,
        [memberId]
      ),
    ]);

    res.json({
      ...member,
      loyalty_cards: cardsRes.rows,
      gift_coupons: couponsRes.rows,
      point_history: pointsRes.rows,
    });
  } catch (err) {
    console.error("[XISH member detail]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/restaurants/:restaurantId/xish/members ────────────────────────
// Register a new XISH member (links to or creates a crm_customer)
router.post("/restaurants/:restaurantId/xish/members", async (req, res) => {
  const client = await pool.connect();
  try {
    const { restaurantId } = req.params;
    const { name, phone, email, wallet_id, wallet_type } = req.body;

    await client.query("BEGIN");

    // Upsert crm_customer
    let crmRes = await client.query(
      `SELECT id FROM crm_customers WHERE restaurant_id = $1 AND (phone = $2 OR (email IS NOT NULL AND email = $3))`,
      [restaurantId, phone || null, email || null]
    );

    let crmId: number;
    if (crmRes.rows.length > 0) {
      crmId = crmRes.rows[0].id;
      await client.query(
        `UPDATE crm_customers
         SET name = COALESCE($2, name), email = COALESCE($3, email),
             xish_member_status = 'basic', is_previous_diner = true, updated_at = NOW()
         WHERE id = $1`,
        [crmId, name, email]
      );
    } else {
      const ins = await client.query(
        `INSERT INTO crm_customers (restaurant_id, name, phone, email, xish_member_status, is_previous_diner)
         VALUES ($1, $2, $3, $4, 'basic', true) RETURNING id`,
        [restaurantId, name, phone, email]
      );
      crmId = ins.rows[0].id;
    }

    // Check if already an xish_member
    const existMember = await client.query(
      `SELECT id FROM xish_members WHERE crm_customer_id = $1`,
      [crmId]
    );
    if (existMember.rows.length > 0) {
      await client.query("COMMIT");
      return res.status(409).json({ error: "Already a XISH member", member_id: existMember.rows[0].id });
    }

    const xishId = generateXishId();
    const memberRes = await client.query(
      `INSERT INTO xish_members (crm_customer_id, wallet_id, wallet_type, xish_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [crmId, wallet_id || null, wallet_type || null, xishId]
    );

    await client.query("COMMIT");
    res.status(201).json(memberRes.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[XISH register member]", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// ─── POST /api/xish/members/:memberId/award-points ───────────────────────────
router.post("/xish/members/:memberId/award-points", async (req, res) => {
  const client = await pool.connect();
  try {
    const { memberId } = req.params;
    const { points_delta, restaurant_id, session_id, reason = "purchase" } = req.body;

    if (!points_delta || !restaurant_id) {
      return res.status(400).json({ error: "points_delta and restaurant_id required" });
    }

    await client.query("BEGIN");

    await client.query(
      `INSERT INTO xish_point_transactions (member_id, restaurant_id, session_id, points_delta, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [memberId, restaurant_id, session_id || null, points_delta, reason]
    );

    // Determine new tier from restaurant's configurable tier settings
    const updated = await client.query(
      `UPDATE xish_members
       SET points_balance = points_balance + $2,
           tier = COALESCE(
             (
               SELECT ts.tier
               FROM xish_tier_settings ts
               JOIN crm_customers c ON c.id = xish_members.crm_customer_id
               WHERE ts.restaurant_id = c.restaurant_id
                 AND ts.is_active = true
                 AND (xish_members.points_balance + $2) >= ts.points_threshold
               ORDER BY ts.points_threshold DESC
               LIMIT 1
             ),
             'basic'
           ),
           updated_at = NOW()
       WHERE id = $1
       RETURNING points_balance, tier`,
      [memberId, points_delta]
    );

    // Sync tier back to crm_customers
    if (updated.rows[0]) {
      await client.query(
        `UPDATE crm_customers c
         SET xish_member_status = $2, is_previous_diner = true, updated_at = NOW()
         FROM xish_members m
         WHERE m.id = $1 AND m.crm_customer_id = c.id`,
        [memberId, updated.rows[0].tier]
      );
    }

    await client.query("COMMIT");

    // Push updated pass to every registered device for this member (non-blocking)
    sendPassUpdatePush(parseInt(String(memberId))).catch(() => {});

    res.json(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[XISH award points]", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// ─── GET /api/xish/members/:memberId/wallet-token ────────────────────────────
// Short-lived JWT for smart bookmark auto-login
router.get("/xish/members/:memberId/wallet-token", async (req, res) => {
  try {
    const { memberId } = req.params;
    const memberRes = await pool.query(
      `SELECT m.id, m.crm_customer_id, c.restaurant_id
       FROM xish_members m
       JOIN crm_customers c ON c.id = m.crm_customer_id
       WHERE m.id = $1`,
      [memberId]
    );
    if (!memberRes.rows[0]) return res.status(404).json({ error: "Member not found" });
    const { id, restaurant_id } = memberRes.rows[0];

    const token = jwt.sign(
      { memberId: id, restaurantId: restaurant_id, type: "wallet" },
      JWT_SECRET,
      { expiresIn: "15m" }
    );
    res.json({ token });
  } catch (err) {
    console.error("[XISH wallet token]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/xish/tiers/:restaurantId ───────────────────────────────────────
// Public — returns tier thresholds so the menu can render a progress bar.
router.get("/xish/tiers/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    if (!/^\d+$/.test(String(restaurantId))) {
      return res.json([]);
    }

    const result = await pool.query(
      `SELECT tier, points_threshold, discount_percent
       FROM xish_tier_settings
       WHERE restaurant_id = $1 AND is_active = true
       ORDER BY points_threshold ASC`,
      [restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[XISH tiers]", err);
    res.json([]);
  }
});

// ─── GET /api/xish/gift-catalog/:restaurantId ────────────────────────────────
// Public — returns active gift rewards catalog for this restaurant.
router.get("/xish/gift-catalog/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    if (!/^\d+$/.test(String(restaurantId))) {
      return res.json([]);
    }

    const result = await pool.query(
      `SELECT id, item_name, item_type, points_cost, quantity, redemption_start, redemption_end, is_active, metadata
       FROM xish_gift_settings
       WHERE restaurant_id = $1
         AND is_active = true
         AND (redemption_start IS NULL OR redemption_start <= NOW())
         AND (redemption_end IS NULL OR redemption_end > NOW())
       ORDER BY item_type ASC, id ASC`,
      [restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[XISH gift catalog]", err);
    res.json([]);
  }
});

// ─── POST /api/xish/members/:memberId/redeem-catalog/:giftSettingId ──────────
// Authenticated member redeems a catalog item (gift or coupon) using their points.
router.post("/xish/members/:memberId/redeem-catalog/:giftSettingId", async (req, res) => {
  const client = await pool.connect();
  try {
    const memberId = parseInt(req.params.memberId);
    const giftSettingId = parseInt(req.params.giftSettingId);

    if (isNaN(memberId) || isNaN(giftSettingId)) {
      return res.status(400).json({ error: "Invalid parameters" });
    }

    await client.query("BEGIN");

    // Fetch the catalog item
    const giftRes = await client.query(
      `SELECT gs.*, r.id AS rest_id
       FROM xish_gift_settings gs
       JOIN restaurants r ON r.id = gs.restaurant_id
       WHERE gs.id = $1
         AND gs.is_active = true
         AND (gs.redemption_start IS NULL OR gs.redemption_start <= NOW())
         AND (gs.redemption_end IS NULL OR gs.redemption_end > NOW())`,
      [giftSettingId]
    );
    if (!giftRes.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Gift not available" });
    }
    const gift = giftRes.rows[0];

    // Verify member belongs to same restaurant
    const memberRes = await client.query(
      `SELECT m.id, m.points_balance, c.restaurant_id
       FROM xish_members m
       JOIN crm_customers c ON c.id = m.crm_customer_id
       WHERE m.id = $1`,
      [memberId]
    );
    if (!memberRes.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Member not found" });
    }
    const member = memberRes.rows[0];
    if (member.restaurant_id !== gift.rest_id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Not authorized" });
    }

    // Check points balance
    const pointsCost = gift.points_cost || 0;
    if (pointsCost > 0 && (member.points_balance || 0) < pointsCost) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient points", points_needed: pointsCost, points_balance: member.points_balance || 0 });
    }

    // Check if member already holds an active instance of this catalog item
    const existingRes = await client.query(
      `SELECT id FROM xish_gift_coupons
       WHERE member_id = $1 AND gift_setting_id = $2 AND qty_remaining > 0`,
      [memberId, giftSettingId]
    );
    if (existingRes.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "You already have this reward in your wallet" });
    }

    // Deduct points if there is a cost
    if (pointsCost > 0) {
      await client.query(
        `UPDATE xish_members SET points_balance = points_balance - $1 WHERE id = $2`,
        [pointsCost, memberId]
      );
      await client.query(
        `INSERT INTO xish_point_transactions (member_id, restaurant_id, points_delta, reason)
         VALUES ($1, $2, $3, $4)`,
        [memberId, gift.rest_id, -pointsCost, `Redeemed: ${gift.item_name}`]
      );
    }

    // Retrieve coupon_code from metadata if it's a coupon type
    const metadata = gift.metadata || {};
    const couponCode = metadata.coupon_code || null;

    // Issue the gift/coupon to the member's wallet
    const issued = await client.query(
      `INSERT INTO xish_gift_coupons
         (restaurant_id, member_id, name, item_reward, item_type, gift_setting_id, coupon_code,
          qty_remaining, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)
       RETURNING *`,
      [
        gift.rest_id,
        memberId,
        gift.item_name,
        gift.item_name,
        gift.item_type || 'gift',
        giftSettingId,
        couponCode,
        gift.redemption_end || null,
      ]
    );

    await client.query("COMMIT");
    res.json({ ok: true, reward: issued.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[XISH redeem-catalog]", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// PATCH /xish/members/:memberId — update name, phone, and/or points_balance
router.patch("/xish/members/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;
    const { name, phone, points_balance } = req.body;

    if (name !== undefined && !name?.trim()) {
      return res.status(400).json({ error: "Name cannot be empty" });
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name.trim()); }
    if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone || null); }

    // Update crm_customers
    if (fields.length > 0) {
      values.push(memberId);
      await pool.query(
        `UPDATE crm_customers c
         SET ${fields.join(", ")}, updated_at = NOW()
         FROM xish_members m
         WHERE m.id = $${idx} AND m.crm_customer_id = c.id`,
        values
      );
    }

    // Update points_balance on xish_members
    if (points_balance !== undefined && !isNaN(Number(points_balance))) {
      await pool.query(
        `UPDATE xish_members SET points_balance = $1, updated_at = NOW() WHERE id = $2`,
        [Math.max(0, Math.round(Number(points_balance))), memberId]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[XISH member PATCH]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /xish/members/:memberId — remove xish membership (and crm_customer if no other data)
router.delete("/xish/members/:memberId", async (req, res) => {
  const client = await pool.connect();
  try {
    const { memberId } = req.params;
    await client.query("BEGIN");

    // Get crm_customer_id before deleting
    const memberRes = await client.query(
      `SELECT crm_customer_id FROM xish_members WHERE id = $1`,
      [memberId]
    );
    if (memberRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Member not found" });
    }
    const crmCustomerId = memberRes.rows[0].crm_customer_id;

    // Delete xish_members row (cascades to wallet passes, gift coupons, loyalty cards via FK)
    await client.query(`DELETE FROM xish_members WHERE id = $1`, [memberId]);

    // Also remove the crm_customer record
    await client.query(`DELETE FROM crm_customers WHERE id = $1`, [crmCustomerId]);

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[XISH member DELETE]", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// ─── GET /api/xish/members/:memberId/wallet-coupons ──────────────────────────
// Returns all active (unredeemed) gift coupons in this member's wallet.
router.get("/xish/members/:memberId/wallet-coupons", async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    if (isNaN(memberId)) return res.status(400).json({ error: "Invalid memberId" });

    const result = await pool.query(
      `SELECT gc.id, gc.name, gc.item_type, gc.item_reward, gc.coupon_code,
              gc.qty_remaining, gc.valid_until, gc.redeemed_at,
              gs.discount_percent, gs.points_cost, gs.metadata
       FROM xish_gift_coupons gc
       LEFT JOIN xish_gift_settings gs ON gs.id = gc.gift_setting_id
       WHERE gc.member_id = $1
         AND gc.qty_remaining > 0
         AND gc.redeemed_at IS NULL
         AND (gc.valid_until IS NULL OR gc.valid_until > NOW())
       ORDER BY gc.id DESC`,
      [memberId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("[XISH wallet coupons]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/xish/checkout-preview ──────────────────────────────────────────
// Preview the XISH discounts that will be applied at checkout.
// Query params: member_id, restaurant_id, subtotal_cents, coupon_id (optional)
router.get("/xish/checkout-preview", async (req, res) => {
  try {
    const memberId    = parseInt(String(req.query.member_id || ""));
    const restaurantId = parseInt(String(req.query.restaurant_id || ""));
    const subtotalCents = parseInt(String(req.query.subtotal_cents || "0"));
    const couponId    = req.query.coupon_id ? parseInt(String(req.query.coupon_id)) : null;

    if (isNaN(memberId) || isNaN(restaurantId)) {
      return res.status(400).json({ error: "member_id and restaurant_id required" });
    }

    let tierDiscountCents = 0;
    let tierDiscountPercent = 0;
    let tier = 'basic';
    let couponDiscountCents = 0;
    let couponName: string | null = null;

    // Tier discount
    const tierRes = await pool.query(
      `SELECT m.tier, ts.discount_percent
       FROM xish_members m
       JOIN crm_customers c ON c.id = m.crm_customer_id
       JOIN xish_tier_settings ts ON ts.restaurant_id = c.restaurant_id AND ts.tier = m.tier
       WHERE m.id = $1 AND c.restaurant_id = $2 AND ts.is_active = true`,
      [memberId, restaurantId]
    );
    if (tierRes.rows[0]) {
      tier = tierRes.rows[0].tier;
      tierDiscountPercent = parseFloat(tierRes.rows[0].discount_percent) || 0;
      tierDiscountCents = Math.floor(subtotalCents * tierDiscountPercent / 100);
    }

    // Coupon discount
    if (couponId) {
      const couponRes = await pool.query(
        `SELECT gc.name, gc.item_type, gs.discount_percent
         FROM xish_gift_coupons gc
         LEFT JOIN xish_gift_settings gs ON gs.id = gc.gift_setting_id
         WHERE gc.id = $1 AND gc.member_id = $2 AND gc.restaurant_id = $3
           AND gc.qty_remaining > 0
           AND (gc.valid_until IS NULL OR gc.valid_until > NOW())`,
        [couponId, memberId, restaurantId]
      );
      if (couponRes.rows[0]) {
        couponName = couponRes.rows[0].name;
        if (couponRes.rows[0].item_type === 'coupon' && couponRes.rows[0].discount_percent) {
          couponDiscountCents = Math.floor(subtotalCents * parseFloat(couponRes.rows[0].discount_percent) / 100);
        }
      }
    }

    const totalDiscountCents = tierDiscountCents + couponDiscountCents;
    res.json({
      tier,
      tier_discount_percent: tierDiscountPercent,
      tier_discount_cents: tierDiscountCents,
      coupon_id: couponId,
      coupon_name: couponName,
      coupon_discount_cents: couponDiscountCents,
      total_xish_discount_cents: totalDiscountCents,
      total_after_discount_cents: Math.max(0, subtotalCents - totalDiscountCents),
    });
  } catch (err) {
    console.error("[XISH checkout-preview]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
