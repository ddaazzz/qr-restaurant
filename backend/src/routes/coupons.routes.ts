import express from "express";
import db from "../config/db";

const router = express.Router();

// Get all coupons for a restaurant (Admin only)
router.get("/restaurants/:restaurantId/coupons", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const result = await db.query(
      "SELECT * FROM coupons WHERE restaurant_id = $1 ORDER BY created_at DESC",
      [restaurantId]
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching coupons:", error.message);
    res.status(500).json({ error: "Failed to fetch coupons" });
  }
});

// Create a new coupon (Admin only)
router.post("/restaurants/:restaurantId/coupons", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { code, discount_type, discount_value, description, max_uses, valid_until, minimum_order_value } = req.body;

    if (!code || !discount_type || !discount_value) {
      return res.status(400).json({ error: "Code, discount_type, and discount_value are required" });
    }

    const result = await db.query(
      `INSERT INTO coupons (restaurant_id, code, discount_type, discount_value, description, max_uses, valid_until, minimum_order_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [restaurantId, code.toUpperCase(), discount_type, discount_value, description || null, max_uses || null, valid_until || null, minimum_order_value || 0]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error creating coupon:", error);
    if (error.code === "23505") {
      res.status(400).json({ error: "Coupon code already exists" });
    } else {
      res.status(500).json({ error: "Failed to create coupon" });
    }
  }
});

// Update a coupon (Admin only)
router.put("/coupons/:couponId", async (req, res) => {
  try {
    const { couponId } = req.params;
    const { code, discount_type, discount_value, description, is_active, max_uses, valid_until, minimum_order_value } = req.body;

    const result = await db.query(
      `UPDATE coupons SET code = COALESCE($1, code), discount_type = COALESCE($2, discount_type), discount_value = COALESCE($3, discount_value), description = COALESCE($4, description), is_active = COALESCE($5, is_active), max_uses = COALESCE($6, max_uses), valid_until = COALESCE($7, valid_until), minimum_order_value = COALESCE($8, minimum_order_value), updated_at = CURRENT_TIMESTAMP WHERE id = $9 RETURNING *`,
      [code ? code.toUpperCase() : null, discount_type, discount_value, description, is_active, max_uses, valid_until, minimum_order_value, couponId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating coupon:", error);
    res.status(500).json({ error: "Failed to update coupon" });
  }
});

// Delete a coupon (Admin only)
router.delete("/coupons/:couponId", async (req, res) => {
  try {
    const { couponId } = req.params;
    const result = await db.query("DELETE FROM coupons WHERE id = $1", [couponId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    res.json({ message: "Coupon deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({ error: "Failed to delete coupon" });
  }
});

// Apply coupon to session (Customer)
router.post("/sessions/:sessionId/apply-coupon", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { coupon_code } = req.body;

    if (!coupon_code) {
      return res.status(400).json({ error: "Coupon code is required" });
    }

    // Get session and restaurant info
    const sessionResult = await db.query(
      "SELECT id, restaurant_id, total_price_cents FROM sessions WHERE id = $1",
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    const session = sessionResult.rows[0];

    // Get coupon
    const couponResult = await db.query(
      "SELECT * FROM coupons WHERE code = $1 AND restaurant_id = $2 AND is_active = true",
      [coupon_code.toUpperCase(), session.restaurant_id]
    );

    if (couponResult.rows.length === 0) {
      return res.status(400).json({ error: "Coupon not found or inactive" });
    }

    const coupon = couponResult.rows[0];

    // Validate coupon
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return res.status(400).json({ error: "Coupon is not yet valid" });
    }

    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return res.status(400).json({ error: "Coupon has expired" });
    }

    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return res.status(400).json({ error: "Coupon usage limit reached" });
    }

    if (session.total_price_cents < coupon.minimum_order_value * 100) {
      return res.status(400).json({ error: `Minimum order value of $${coupon.minimum_order_value.toFixed(2)} required` });
    }

    // Calculate discount
    let discount_cents = 0;
    if (coupon.discount_type === "percentage") {
      discount_cents = Math.floor((session.total_price_cents * coupon.discount_value) / 100);
    } else {
      discount_cents = Math.floor(coupon.discount_value * 100);
    }

    discount_cents = Math.min(discount_cents, session.total_price_cents);

    // Apply coupon to session
    await db.query(
      "UPDATE sessions SET coupon_id = $1, discount_applied_cents = $2 WHERE id = $3",
      [coupon.id, discount_cents, sessionId]
    );

    // Increment coupon usage
    await db.query(
      "UPDATE coupons SET current_uses = current_uses + 1 WHERE id = $1",
      [coupon.id]
    );

    res.json({
      success: true,
      coupon_code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_applied_cents: discount_cents,
      message: `Discount of $${(discount_cents / 100).toFixed(2)} applied`
    });
  } catch (error: any) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ error: "Failed to apply coupon" });
  }
});

// Remove coupon from session (Customer)
router.post("/sessions/:sessionId/remove-coupon", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const sessionResult = await db.query(
      "SELECT coupon_id FROM sessions WHERE id = $1",
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    const couponId = sessionResult.rows[0].coupon_id;

    // Remove coupon from session
    await db.query(
      "UPDATE sessions SET coupon_id = NULL, discount_applied_cents = 0 WHERE id = $1",
      [sessionId]
    );

    // Decrement coupon usage if it was applied
    if (couponId) {
      await db.query(
        "UPDATE coupons SET current_uses = GREATEST(current_uses - 1, 0) WHERE id = $1",
        [couponId]
      );
    }

    res.json({ success: true, message: "Coupon removed" });
  } catch (error: any) {
    console.error("Error removing coupon:", error);
    res.status(500).json({ error: "Failed to remove coupon" });
  }
});

export default router;
