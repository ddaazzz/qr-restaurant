/**
 * xish-pos.routes.ts
 *
 * Phase 8 — XISH POS Real-Time Sync
 *
 * POST /api/xish/pos-webhook
 *   Called by an external POS when it scans a member's XISH barcode.
 *   Awards points proportional to the transaction amount, updates tier,
 *   then fires an APNs pass-update push so the lock screen updates instantly.
 *
 * Authentication: Bearer token matching restaurants.xish_pos_api_key
 */

import { Router } from "express";
import pool from "../config/db";
import { sendPassUpdatePush } from "../utils/xish-apns";

const router = Router();

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Award points to a member within a transaction client.
 * Updates tier using restaurant's xish_tier_settings.
 * Returns { points_awarded, new_balance, new_tier }.
 */
async function awardPointsInTx(
  client: any,
  memberId: number,
  restaurantId: number,
  pointsDelta: number,
  reason: string,
  sessionId?: number | null
) {
  await client.query(
    `INSERT INTO xish_point_transactions
       (member_id, restaurant_id, session_id, points_delta, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [memberId, restaurantId, sessionId ?? null, pointsDelta, reason]
  );

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
    [memberId, pointsDelta]
  );

  const row = updated.rows[0];
  if (row) {
    await client.query(
      `UPDATE crm_customers c
       SET xish_member_status = $2, is_previous_diner = true, updated_at = NOW()
       FROM xish_members m
       WHERE m.id = $1 AND m.crm_customer_id = c.id`,
      [memberId, row.tier]
    );
  }

  return row;
}

// ─── POST /api/xish/pos-webhook ───────────────────────────────────────────────
/**
 * Body:
 *   xish_id        — member's numeric XISH ID (barcode value)
 *   amount_cents   — transaction total in cents
 *   restaurant_id  — which restaurant's POS is calling
 *   session_id?    — optional table session link
 *   reference?     — POS transaction reference string
 *
 * Auth header: Authorization: Bearer <xish_pos_api_key>
 */
router.post("/xish/pos-webhook", async (req, res) => {
  const client = await pool.connect();
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Authorization required" });
    }

    const { xish_id, amount_cents, restaurant_id, session_id, reference } = req.body;

    if (!xish_id || !amount_cents || !restaurant_id) {
      return res.status(400).json({ error: "xish_id, amount_cents and restaurant_id are required" });
    }

    const amountCents = parseInt(String(amount_cents));
    const restaurantId = parseInt(String(restaurant_id));

    if (isNaN(amountCents) || amountCents <= 0 || isNaN(restaurantId)) {
      return res.status(400).json({ error: "Invalid amount_cents or restaurant_id" });
    }

    // Verify API key against restaurant
    const restaurantRes = await pool.query(
      `SELECT id, xish_enabled, xish_pos_api_key, xish_points_rate
       FROM restaurants
       WHERE id = $1`,
      [restaurantId]
    );
    const restaurant = restaurantRes.rows[0];

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }
    if (!restaurant.xish_enabled) {
      return res.status(400).json({ error: "XISH not enabled for this restaurant" });
    }
    if (!restaurant.xish_pos_api_key || restaurant.xish_pos_api_key !== token) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    // Look up member by xish_id scoped to this restaurant
    const memberRes = await pool.query(
      `SELECT m.id AS member_id, m.points_balance, m.tier, m.xish_id
       FROM xish_members m
       JOIN crm_customers c ON c.id = m.crm_customer_id
       WHERE m.xish_id = $1
         AND c.restaurant_id = $2`,
      [String(xish_id), restaurantId]
    );

    if (!memberRes.rows[0]) {
      return res.status(404).json({ error: "XISH member not found for this restaurant" });
    }
    const member = memberRes.rows[0];
    const memberId: number = member.member_id;

    // Calculate points to award: rate is points per dollar (100 cents = 1 dollar)
    const pointsRate = parseFloat(restaurant.xish_points_rate) || 1.0;
    const pointsToAward = Math.floor((amountCents / 100) * pointsRate);

    if (pointsToAward <= 0) {
      return res.json({
        ok: true,
        points_awarded: 0,
        points_balance: member.points_balance,
        tier: member.tier,
        message: "Amount too small to award points",
      });
    }

    await client.query("BEGIN");

    const updatedMember = await awardPointsInTx(
      client,
      memberId,
      restaurantId,
      pointsToAward,
      reference ? `pos-scan:${reference}` : "pos-scan",
      session_id ? parseInt(String(session_id)) : null
    );

    await client.query("COMMIT");

    // Non-blocking: push pass update so lock screen updates instantly
    sendPassUpdatePush(memberId).catch((err) => {
      console.warn("[XISH pos-webhook] APNs push failed:", err?.message);
    });

    res.json({
      ok: true,
      member_id: memberId,
      xish_id: member.xish_id,
      points_awarded: pointsToAward,
      points_balance: updatedMember?.points_balance ?? member.points_balance,
      tier: updatedMember?.tier ?? member.tier,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[XISH pos-webhook]", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// ─── GET /api/xish/pos-webhook/verify/:xishId ────────────────────────────────
/**
 * Quick lookup — POS calls this after a scan to show member info on screen
 * before confirming the transaction.
 * Auth: Bearer <xish_pos_api_key>
 */
router.get("/xish/pos-webhook/verify/:xishId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const restaurantId = parseInt(String(req.query.restaurant_id || ""));
    const { xishId } = req.params;

    if (!token || !restaurantId || isNaN(restaurantId)) {
      return res.status(400).json({ error: "Authorization and restaurant_id required" });
    }

    const restaurantRes = await pool.query(
      `SELECT id, xish_enabled, xish_pos_api_key FROM restaurants WHERE id = $1`,
      [restaurantId]
    );
    const restaurant = restaurantRes.rows[0];
    if (!restaurant || !restaurant.xish_enabled || restaurant.xish_pos_api_key !== token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const memberRes = await pool.query(
      `SELECT m.id, m.xish_id, m.points_balance, m.tier, c.name, c.phone
       FROM xish_members m
       JOIN crm_customers c ON c.id = m.crm_customer_id
       WHERE m.xish_id = $1
         AND c.restaurant_id = $2`,
      [xishId, restaurantId]
    );

    if (!memberRes.rows[0]) {
      return res.status(404).json({ error: "Member not found" });
    }
    const m = memberRes.rows[0];

    // Get tier discount for display
    const tierRes = await pool.query(
      `SELECT discount_percent FROM xish_tier_settings
       WHERE restaurant_id = $1 AND tier = $2 AND is_active = true`,
      [restaurantId, m.tier]
    );
    const discountPercent = parseFloat(tierRes.rows[0]?.discount_percent || "0");

    res.json({
      xish_id: m.xish_id,
      name: m.name,
      phone: m.phone,
      points_balance: m.points_balance,
      tier: m.tier,
      tier_discount_percent: discountPercent,
    });
  } catch (err) {
    console.error("[XISH pos verify]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
