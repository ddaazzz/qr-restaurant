import { Router } from "express";
import pool from "../config/db";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "xish-secret-change-in-prod";

// ─── POST /api/xish/auth/qr-login ────────────────────────────────────────────
// Called when customer scans a table QR that includes a wallet_id or auth token.
// Returns a short-lived member JWT if the wallet is recognised.
router.post("/xish/auth/qr-login", async (req, res) => {
  try {
    const { restaurant_id, table_id, wallet_id } = req.body;

    if (!restaurant_id) {
      return res.status(400).json({ error: "restaurant_id required" });
    }

    // If no wallet_id provided → guest mode
    if (!wallet_id) {
      return res.json({ mode: "guest", restaurant_id, table_id });
    }

    const memberRes = await pool.query(
      `SELECT m.id AS member_id, m.points_balance, m.tier, m.xish_id,
              c.name, c.restaurant_id, c.xish_member_status,
              ds.discount_percent
       FROM xish_members m
       JOIN crm_customers c ON c.id = m.crm_customer_id
       LEFT JOIN LATERAL (
         SELECT discount_percent FROM xish_discount_settings
         WHERE restaurant_id = $2
           AND tier = m.tier
           AND is_active = true
           AND (valid_from IS NULL OR valid_from <= NOW())
           AND (valid_until IS NULL OR valid_until > NOW())
         ORDER BY discount_percent DESC
         LIMIT 1
       ) ds ON true
       WHERE m.wallet_id = $1`,
      [wallet_id, restaurant_id]
    );

    if (!memberRes.rows[0]) {
      return res.json({ mode: "guest", restaurant_id, table_id });
    }

    const member = memberRes.rows[0];
    const token = jwt.sign(
      {
        memberId: member.member_id,
        restaurantId: restaurant_id,
        tableId: table_id,
        type: "qr",
      },
      JWT_SECRET,
      { expiresIn: "4h" }
    );

    // Mark as previous diner
    await pool.query(
      `UPDATE crm_customers SET is_previous_diner = true, last_visit_at = NOW(), updated_at = NOW()
       WHERE id = (SELECT crm_customer_id FROM xish_members WHERE id = $1)`,
      [member.member_id]
    );

    res.json({
      mode: "member",
      token,
      member: {
        member_id: member.member_id,
        name: member.name,
        tier: member.tier,
        points_balance: member.points_balance,
        xish_id: member.xish_id,
        discount_percent: member.discount_percent || 0,
      },
    });
  } catch (err) {
    console.error("[XISH qr-login]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/xish/auth/wallet-login ────────────────────────────────────────
// Validates a JWT from a Wallet smart bookmark URL
router.post("/xish/auth/wallet-login", async (req, res) => {
  try {
    const { token, restaurant_id } = req.body;
    if (!token) return res.status(400).json({ error: "token required" });

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    if (payload.type !== "wallet" && payload.type !== "qr") {
      return res.status(401).json({ error: "Invalid token type" });
    }

    const memberRes = await pool.query(
      `SELECT m.id, m.points_balance, m.tier, m.xish_id,
              c.name, c.restaurant_id
       FROM xish_members m
       JOIN crm_customers c ON c.id = m.crm_customer_id
       WHERE m.id = $1`,
      [payload.memberId]
    );
    if (!memberRes.rows[0]) return res.status(404).json({ error: "Member not found" });

    const member = memberRes.rows[0];
    const restaurantId = restaurant_id || payload.restaurantId;

    // Issue a new session token
    const newToken = jwt.sign(
      { memberId: member.id, restaurantId, type: "wallet" },
      JWT_SECRET,
      { expiresIn: "4h" }
    );

    res.json({
      mode: "member",
      token: newToken,
      member: {
        member_id: member.id,
        name: member.name,
        tier: member.tier,
        points_balance: member.points_balance,
        xish_id: member.xish_id,
      },
    });
  } catch (err) {
    console.error("[XISH wallet-login]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/xish/auth/verify ──────────────────────────────────────────────
// Verify an existing XISH JWT (used by menu.js on page load)
router.post("/xish/auth/verify", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token required" });

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const memberRes = await pool.query(
      `SELECT m.id, m.points_balance, m.tier, m.xish_id, c.name,
              ds.discount_percent
       FROM xish_members m
       JOIN crm_customers c ON c.id = m.crm_customer_id
       LEFT JOIN LATERAL (
         SELECT discount_percent FROM xish_discount_settings
         WHERE restaurant_id = $2
           AND tier = m.tier
           AND is_active = true
           AND (valid_from IS NULL OR valid_from <= NOW())
           AND (valid_until IS NULL OR valid_until > NOW())
         ORDER BY discount_percent DESC
         LIMIT 1
       ) ds ON true
       WHERE m.id = $1`,
      [payload.memberId, payload.restaurantId]
    );

    if (!memberRes.rows[0]) return res.status(404).json({ error: "Member not found" });

    res.json({ valid: true, member: memberRes.rows[0], payload });
  } catch (err) {
    console.error("[XISH verify]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

// ─── POST /api/xish/auth/xish-id-login ───────────────────────────────────────
// Auto-login returning members who have previously joined (stored xish_id in localStorage).
// No password required — xish_id is the "credential" for low-stakes loyalty display only.
router.post("/xish/auth/xish-id-login", async (req, res) => {
  try {
    const { xish_id, restaurant_id } = req.body;
    if (!xish_id || !restaurant_id) {
      return res.status(400).json({ error: "xish_id and restaurant_id required" });
    }

    const memberRes = await pool.query(
      `SELECT m.id AS member_id, m.points_balance, m.tier, m.xish_id,
              c.name, c.restaurant_id,
              (SELECT COUNT(*)::int FROM xish_gift_coupons gc
               WHERE gc.member_id = m.id AND gc.qty_remaining > 0
                 AND (gc.valid_until IS NULL OR gc.valid_until > NOW())) AS active_coupons,
              ds.discount_percent
       FROM xish_members m
       JOIN crm_customers c ON c.id = m.crm_customer_id
       LEFT JOIN LATERAL (
         SELECT discount_percent FROM xish_discount_settings
         WHERE restaurant_id = $2
           AND tier = m.tier
           AND is_active = true
           AND (valid_from IS NULL OR valid_from <= NOW())
           AND (valid_until IS NULL OR valid_until > NOW())
         ORDER BY discount_percent DESC
         LIMIT 1
       ) ds ON true
       WHERE m.xish_id = $1 AND c.restaurant_id = $2`,
      [xish_id, restaurant_id]
    );

    if (!memberRes.rows[0]) {
      return res.json({ mode: "guest" });
    }

    const member = memberRes.rows[0];
    const token = jwt.sign(
      { memberId: member.member_id, restaurantId: parseInt(restaurant_id), type: "xish_id" },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Update last_visit_at
    await pool.query(
      `UPDATE crm_customers SET last_visit_at = NOW(), updated_at = NOW()
       WHERE id = (SELECT crm_customer_id FROM xish_members WHERE id = $1)`,
      [member.member_id]
    );

    res.json({
      mode: "member",
      token,
      member: {
        member_id: member.member_id,
        name: member.name,
        tier: member.tier,
        points_balance: member.points_balance,
        xish_id: member.xish_id,
        discount_percent: member.discount_percent || 0,
        active_coupons: member.active_coupons || 0,
      },
    });
  } catch (err) {
    console.error("[XISH xish-id-login]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
