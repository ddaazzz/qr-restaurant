import { Router } from "express";
import pool from "../config/db";

const router = Router();

// Get full menu for a restaurant
router.get("/restaurants/:restaurantId/menu", async (req, res) => {
  const { restaurantId } = req.params;

  const categories = await pool.query(
    "SELECT * FROM menu_categories WHERE restaurant_id = $1 ORDER BY sort_order",
    [restaurantId]
  );

  // join mc.id = mi.category_id (foreign key)
  const items = await pool.query(
    `
    SELECT mi.*
    FROM menu_items mi
    JOIN menu_categories mc ON mc.id = mi.category_id 
    WHERE mc.restaurant_id = $1 AND mi.available = true
    `,
    [restaurantId]
  );

  res.json({
    categories: categories.rows,
    items: items.rows,
  });
});

// STAFF menu (see all items)
router.get("/restaurants/:restaurantId/menu/staff", async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const items = await pool.query(
      `
      SELECT
        mi.id,
        mi.name,
        mi.price_cents,
        mi.available,
        mc.name AS category_name
      FROM menu_items mi
      JOIN menu_categories mc ON mc.id = mi.category_id
      WHERE mc.restaurant_id = $1
      ORDER BY mc.sort_order, mi.id
      `,
      [restaurantId]
    );

    res.json(items.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load staff menu" });
  }
});

// STAFF toggle menu availability
router.patch("/menu-items/:id/availability", async (req, res) => {
  try {
    const { id } = req.params;
    const { available } = req.body;

    const result = await pool.query(
      `
      UPDATE menu_items
      SET available = $1
      WHERE id = $2
      RETURNING *
      `,
      [available, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update availability" });
  }
});


export default router;
