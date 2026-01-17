import { Router } from "express";
import pool from "../config/db";

const router = Router();

/**
 * GET active sessions + orders + items (staff view)
 */
router.get(
  "/restaurants/:restaurantId/active-sessions-with-orders",
  async (req, res) => {
    try {
      const { restaurantId } = req.params;

      const result = await pool.query(
        `
        SELECT
          ts.id            AS session_id,
          t.id             AS table_id,
          t.name           AS table_name,

          o.id             AS order_id,

          oi.id            AS order_item_id,
          oi.quantity,
          oi.status        AS item_status,

          mi.name          AS item_name,
          mi.price_cents   AS price_cents,

          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'variant', v.name,
                'option', vo.name
              )
            ) FILTER (WHERE v.id IS NOT NULL),
            '[]'
          ) AS variants

        FROM table_sessions ts
        JOIN tables t
          ON t.id = ts.table_id

        LEFT JOIN orders o
          ON o.session_id = ts.id

        LEFT JOIN order_items oi
          ON oi.order_id = o.id

        LEFT JOIN menu_items mi
          ON mi.id = oi.menu_item_id

        -- ✅ SAME VARIANT JOINS AS orders.routes.ts
        LEFT JOIN order_item_variants oiv
          ON oiv.order_item_id = oi.id

        LEFT JOIN menu_item_variant_options vo
          ON vo.id = oiv.variant_option_id

        LEFT JOIN menu_item_variants v
          ON v.id = vo.variant_id

        WHERE t.restaurant_id = $1
          AND ts.ended_at IS NULL 

        GROUP BY
          ts.id, t.id, t.name,
          o.id,
          oi.id, oi.quantity, oi.status,
          mi.name, mi.price_cents

        ORDER BY t.id, ts.id, o.id, oi.id
        `,
        [restaurantId]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("Staff dashboard query failed:", err);
      res.status(500).json([]);
    }
  }
);






export default router;
