import { Router } from "express";
import pool from "../config/db";
import {upload} from "../config/upload"
const router = Router();
/**
 * GET active sessions + orders + items (staff view)
 */
//Admin Settings (get)
router.get("/:id/settings", async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT 
         name,
         logo_url,
         address,
         phone,
         theme_color,
         service_charge_percent,
         regenerate_qr_per_session
       FROM restaurants
       WHERE id = $1`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Load settings failed:", err);
    res.status(500).json({ error: "Failed to load settings" });
  }
});


//Update Admin Settings (get)
router.patch("/:id/settings", async (req, res) => {
  const { id } = req.params;
  const {
    name,
    logo_url,
    address,
    phone,
    theme_color,
    service_charge_percent,
    regenerate_qr_per_session
  } = req.body;

  try {
    await pool.query(
      `UPDATE restaurants
       SET name = $1,
           logo_url = $2,
           address = $3,
           phone = $4,
           theme_color = $5,
           service_charge_percent = $6,
           regenerate_qr_per_session = $7
       WHERE id = $8`,
      [
        name,
        logo_url,
        address,
        phone,
        theme_color,
        service_charge_percent,
        regenerate_qr_per_session,
        id
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Update settings failed:", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

//Update Restaurant Logo
router.post("/:id/logo", upload.single("image"), async (req, res) => {
  console.log("REQ FILE:", req.file);
    console.log("REQ PARAM ID:", req.params.id);

  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: "Logo upload failed" });
  }

  const logoPath = `/uploads/restaurants/${req.file.filename}`;
  console.log(logoPath);
  console.log("Updating logo_url for restaurant ID:", id, "with path:", logoPath);

  try {
    await pool.query(
      `UPDATE restaurants SET logo_url = $1 WHERE id = $2`,
      [logoPath, id]
    );
console.log("Logo updated successfully for restaurant ID:", id);

    res.json({ logo_url: logoPath});
  } catch (err) {
    console.error("Error updating logo URL:", err);
    res.status(500).json({ error: "Failed to upload logo" });
  }
});



router.get("/restaurants/:restaurantId/active-sessions-with-orders",
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


// Get Restaurant Info
router.get("/restaurant/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT name, logo_url, address, phone FROM restaurants WHERE id = $1`,
      [id]
    );

    // Check if the restaurant exists
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const restaurant = result.rows[0];
    res.json(restaurant);
  } catch (err) {
    console.error("Failed to load restaurant info:", err);
    res.status(500).json({ error: "Failed to load restaurant info" });
  }
});

// Router to get the bill for a session
router.get("/:sessionId/bill", async (req, res) => {
  const { sessionId } = req.params;

  try {
    // Fetch orders and total for the session
    const result = await pool.query(`
      SELECT
        oi.quantity,
        oi.price_cents,
        mi.name AS item_name,
        o.created_at,
        o.id AS order_id
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.session_id = $1
    `, [sessionId]);

    const orders = result.rows.map(row => ({
      item_name: row.item_name,
      quantity: row.quantity,
      unit_price_cents: row.price_cents,
      total_price_cents: row.price_cents * row.quantity,
    }));

    const totalCents = orders.reduce((sum, order) => sum + order.total_price_cents, 0);

    // Fetch restaurant details
    const restaurantRes = await pool.query(`
      SELECT name, logo_url, address, phone FROM restaurants WHERE id = 1
    `);

    const restaurant = restaurantRes.rows[0];

    // Send the full bill data
    res.json({
      items: orders,
      total_cents: totalCents,
      restaurant,
    });
  } catch (err) {
    console.error("Failed to load session bill:", err);
    res.status(500).json({ error: "Failed to load bill" });
  }
});



export default router;
