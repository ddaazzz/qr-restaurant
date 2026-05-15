import { Router } from "express";
import pool from "../config/db";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// Generate a random gift card code: GC-XXXX-XXXX
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let part1 = "";
  let part2 = "";
  for (let i = 0; i < 4; i++) part1 += chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 4; i++) part2 += chars[Math.floor(Math.random() * chars.length)];
  return `GC-${part1}-${part2}`;
}

// GET /api/restaurants/:restaurantId/gift-cards
router.get("/restaurants/:restaurantId/gift-cards", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM gift_cards WHERE restaurant_id = $1 ORDER BY issued_at DESC`,
      [req.params.restaurantId]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error("[Gift Cards] GET error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/gift-cards/lookup?code=GC-XXXX-XXXX&restaurantId=1
// Used at POS / checkout to look up a card by code
router.get("/gift-cards/lookup", requireAuth, async (req, res) => {
  const { code, restaurantId } = req.query as { code: string; restaurantId: string };
  if (!code || !restaurantId) return res.status(400).json({ error: "code and restaurantId required" });
  try {
    const result = await pool.query(
      `SELECT * FROM gift_cards WHERE UPPER(code) = UPPER($1) AND restaurant_id = $2`,
      [code.trim(), restaurantId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Gift card not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error("[Gift Cards] Lookup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/restaurants/:restaurantId/gift-cards
// Issue a new gift card
router.post("/restaurants/:restaurantId/gift-cards", requireAuth, async (req, res) => {
  try {
    const { original_value_cents, purchaser_name, purchaser_email, purchaser_phone, note, expires_at } = req.body;
    if (!original_value_cents || original_value_cents <= 0) {
      return res.status(400).json({ error: "original_value_cents must be a positive integer" });
    }

    // Generate a unique code (retry up to 5 times on collision)
    let code = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateCode();
      const existing = await pool.query(
        `SELECT id FROM gift_cards WHERE restaurant_id = $1 AND code = $2`,
        [req.params.restaurantId, candidate]
      );
      if (existing.rowCount === 0) { code = candidate; break; }
    }
    if (!code) return res.status(500).json({ error: "Could not generate unique code, please try again" });

    const result = await pool.query(
      `INSERT INTO gift_cards
         (restaurant_id, code, original_value_cents, balance_cents, purchaser_name, purchaser_email, purchaser_phone, note, expires_at)
       VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        req.params.restaurantId,
        code,
        original_value_cents,
        purchaser_name || null,
        purchaser_email || null,
        purchaser_phone || null,
        note || null,
        expires_at || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error("[Gift Cards] POST error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/restaurants/:restaurantId/gift-cards/:cardId
// Update balance (redemption), note, or active status
router.patch("/restaurants/:restaurantId/gift-cards/:cardId", requireAuth, async (req, res) => {
  try {
    const { balance_cents, note, is_active, expires_at } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (balance_cents !== undefined) { updates.push(`balance_cents = $${i++}`); values.push(balance_cents); }
    if (note !== undefined)          { updates.push(`note = $${i++}`);          values.push(note); }
    if (is_active !== undefined)     { updates.push(`is_active = $${i++}`);     values.push(is_active); }
    if (expires_at !== undefined)    { updates.push(`expires_at = $${i++}`);    values.push(expires_at); }

    if (updates.length === 0) return res.status(400).json({ error: "Nothing to update" });

    updates.push(`updated_at = NOW()`);
    values.push(req.params.cardId, req.params.restaurantId);

    const result = await pool.query(
      `UPDATE gift_cards SET ${updates.join(", ")} WHERE id = $${i++} AND restaurant_id = $${i} RETURNING *`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Gift card not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error("[Gift Cards] PATCH error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
