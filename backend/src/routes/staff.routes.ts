import { Router } from "express";
import pool from "../config/db";

const router = Router();

/**
 * GET active sessions + orders + items (staff view)
 */
router.get(
  "/restaurants/:restaurantId/active-sessions-with-orders",
  async (req, res) => {
    const { restaurantId } = req.params;

    const result = await pool.query(`
      SELECT
        ts.id              AS session_id,
        t.id              AS table_id,
        t.name            AS table_name,

        o.id              AS order_id,
        o.status          AS order_status,
        o.created_at      AS order_created_at,

        oi.quantity,
        oi.price_cents,
        mi.name           AS item_name

      FROM table_sessions ts
      JOIN tables t ON t.id = ts.table_id

      LEFT JOIN orders o ON o.session_id = ts.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id

      WHERE
        ts.ended_at IS NULL
        AND t.restaurant_id = $1

      ORDER BY
        ts.id,
        o.created_at
    `, [restaurantId]);

    res.json(result.rows);
  }
);

export default router;
