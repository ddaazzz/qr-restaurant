import { Router } from "express";
import pool from "../config/db";

const router = Router();

/**
 * ==========================
 * ADDON ROUTES
 * ==========================
 */

/**
 * GET all addons for a restaurant
 * GET /api/restaurants/:restaurantId/addons
 */
router.get("/restaurants/:restaurantId/addons", async (req, res) => {
  const { restaurantId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT 
        a.id,
        a.menu_item_id,
        a.addon_item_id,
        a.addon_name,
        a.addon_description,
        a.regular_price_cents,
        a.addon_discount_price_cents,
        a.is_available,
        a.created_at,
        mi.name AS menu_item_name,
        ai.name AS addon_item_name,
        ai.image_url AS addon_item_image,
        mc.id AS addon_category_id,
        mc.name AS addon_category_name
      FROM addons a
      JOIN menu_items mi ON a.menu_item_id = mi.id
      JOIN menu_items ai ON a.addon_item_id = ai.id
      JOIN menu_categories mc ON ai.category_id = mc.id
      WHERE a.restaurant_id = $1
      ORDER BY a.menu_item_id, a.addon_name
      `,
      [restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Failed to fetch addons:", err);
    res.status(500).json({ error: "Failed to fetch addons" });
  }
});

/**
 * GET addons for a specific menu item
 * GET /api/restaurants/:restaurantId/menu-items/:menuItemId/addons
 */
router.get(
  "/restaurants/:restaurantId/menu-items/:menuItemId/addons",
  async (req, res) => {
    const { restaurantId, menuItemId } = req.params;

    try {
      const result = await pool.query(
        `
        SELECT 
          a.id,
          a.addon_item_id,
          a.addon_name,
          a.addon_description,
          a.regular_price_cents,
          a.addon_discount_price_cents,
          a.is_available,
          ai.name AS addon_item_name,
          ai.image_url AS addon_item_image,
          mc.id AS addon_category_id,
          mc.name AS addon_category_name
        FROM addons a
        JOIN menu_items ai ON a.addon_item_id = ai.id
        JOIN menu_categories mc ON ai.category_id = mc.id
        WHERE a.restaurant_id = $1 AND a.menu_item_id = $2 AND a.is_available = true
        ORDER BY a.addon_name
        `,
        [restaurantId, menuItemId]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("❌ Failed to fetch menu item addons:", err);
      res.status(500).json({ error: "Failed to fetch addons" });
    }
  }
);

/**
 * CREATE an addon
 * POST /api/restaurants/:restaurantId/addons
 * 
 * Body:
 * {
 *   menu_item_id: number,
 *   addon_item_id: number,
 *   addon_name: string,
 *   addon_description?: string,
 *   regular_price_cents: number,
 *   addon_discount_price_cents: number
 * }
 */
router.post("/restaurants/:restaurantId/addons", async (req, res) => {
  const { restaurantId } = req.params;
  const {
    menu_item_id,
    addon_item_id,
    addon_name,
    addon_description,
    regular_price_cents,
    addon_discount_price_cents,
  } = req.body;

  if (!menu_item_id || !addon_item_id || !addon_name || regular_price_cents == null || addon_discount_price_cents == null) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Verify both menu items belong to this restaurant
    const menuItemRes = await pool.query(
      `
      SELECT mc.restaurant_id 
      FROM menu_items mi
      JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE mi.id = $1
      `,
      [menu_item_id]
    );

    if (menuItemRes.rowCount === 0) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    if (menuItemRes.rows[0].restaurant_id !== parseInt(restaurantId)) {
      return res.status(403).json({ error: "Menu item doesn't belong to this restaurant" });
    }

    const addonItemRes = await pool.query(
      `
      SELECT mc.restaurant_id 
      FROM menu_items mi
      JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE mi.id = $1
      `,
      [addon_item_id]
    );

    if (addonItemRes.rowCount === 0) {
      return res.status(404).json({ error: "Addon item not found" });
    }

    if (addonItemRes.rows[0].restaurant_id !== parseInt(restaurantId)) {
      return res.status(403).json({ error: "Addon item doesn't belong to this restaurant" });
    }

    // Create the addon
    const result = await pool.query(
      `
      INSERT INTO addons (
        restaurant_id,
        menu_item_id,
        addon_item_id,
        addon_name,
        addon_description,
        regular_price_cents,
        addon_discount_price_cents,
        is_available
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      ON CONFLICT (restaurant_id, menu_item_id, addon_item_id) DO NOTHING
      RETURNING *
      `,
      [
        restaurantId,
        menu_item_id,
        addon_item_id,
        addon_name,
        addon_description || null,
        regular_price_cents,
        addon_discount_price_cents,
      ]
    );

    if (result.rowCount === 0) {
      // Addon already exists — return the existing one
      const existing = await pool.query(
        `SELECT * FROM addons WHERE restaurant_id = $1 AND menu_item_id = $2 AND addon_item_id = $3`,
        [restaurantId, menu_item_id, addon_item_id]
      );
      return res.status(200).json(existing.rows[0]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Failed to create addon:", err);
    res.status(500).json({ error: "Failed to create addon" });
  }
});

/**
 * UPDATE an addon
 * PATCH /api/restaurants/:restaurantId/addons/:addonId
 */
router.patch("/restaurants/:restaurantId/addons/:addonId", async (req, res) => {
  const { restaurantId, addonId } = req.params;
  const {
    addon_name,
    addon_description,
    regular_price_cents,
    addon_discount_price_cents,
    is_available,
  } = req.body;

  try {
    // Verify addon belongs to restaurant
    const addonRes = await pool.query(
      `SELECT * FROM addons WHERE id = $1 AND restaurant_id = $2`,
      [addonId, restaurantId]
    );

    if (addonRes.rowCount === 0) {
      return res.status(404).json({ error: "Addon not found" });
    }

    // Update only provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (addon_name !== undefined) {
      updates.push(`addon_name = $${paramCount++}`);
      values.push(addon_name);
    }
    if (addon_description !== undefined) {
      updates.push(`addon_description = $${paramCount++}`);
      values.push(addon_description);
    }
    if (regular_price_cents !== undefined) {
      updates.push(`regular_price_cents = $${paramCount++}`);
      values.push(regular_price_cents);
    }
    if (addon_discount_price_cents !== undefined) {
      updates.push(`addon_discount_price_cents = $${paramCount++}`);
      values.push(addon_discount_price_cents);
    }
    if (is_available !== undefined) {
      updates.push(`is_available = $${paramCount++}`);
      values.push(is_available);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 1) {
      // No updates provided
      return res.json(addonRes.rows[0]);
    }

    values.push(addonId);
    values.push(restaurantId);

    const result = await pool.query(
      `
      UPDATE addons
      SET ${updates.join(", ")}
      WHERE id = $${paramCount++} AND restaurant_id = $${paramCount++}
      RETURNING *
      `,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Failed to update addon:", err);
    res.status(500).json({ error: "Failed to update addon" });
  }
});

/**
 * DELETE an addon
 * DELETE /api/restaurants/:restaurantId/addons/:addonId
 */
router.delete("/restaurants/:restaurantId/addons/:addonId", async (req, res) => {
  const { restaurantId, addonId } = req.params;

  try {
    const result = await pool.query(
      `
      DELETE FROM addons
      WHERE id = $1 AND restaurant_id = $2
      RETURNING id
      `,
      [addonId, restaurantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Addon not found" });
    }

    res.json({ success: true, id: addonId });
  } catch (err) {
    console.error("❌ Failed to delete addon:", err);
    res.status(500).json({ error: "Failed to delete addon" });
  }
});

export default router;
