import { Router } from "express";
import pool from "../config/db";

const router = Router();

/**
 * @route POST /scan/:qrToken
 * @desc Retrieve table info and active session for staff - ✅ MULTI-RESTAURANT SUPPORT
 *       Do NOT create a session automatically — session must be started by staff/admin
 */
router.post("/scan/:qrToken", async (req, res) => {
  try {
    const { qrToken } = req.params;

    // 1️⃣ Find table unit by QR
    const unitResult = await pool.query(
      `
      SELECT
        tu.id AS table_unit_id,
        tu.display_name,
        t.id AS table_id,
        t.restaurant_id
      FROM table_units tu
      JOIN tables t ON t.id = tu.table_id
      WHERE tu.qr_token = $1
      `,
      [qrToken]
    );

    if (unitResult.rowCount === 0) {
      return res.status(404).json({ error: "Invalid QR" });
    }

    const unit = unitResult.rows[0];

    // 2️⃣ Retrieve any active session for THIS UNIT
    const sessionResult = await pool.query(
      `
      SELECT *
      FROM table_sessions
      WHERE table_unit_id = $1
        AND ended_at IS NULL
      `,
      [unit.table_unit_id]
    );

    let session = ((sessionResult.rowCount ?? 0) > 0) ? sessionResult.rows[0] : null;
    console.log("Restaurant ID:", unit.restaurant_id);

    // 3️⃣ Get restaurant details (logo, address, phone, etc) + config
    const restaurantResult = await pool.query(
      `SELECT id, name, address, phone, logo_url, background_url, theme_color,
              service_charge_percent, feature_flags, ui_config, ui_mode, custom_frontend_url
       FROM restaurants WHERE id = $1`,
      [unit.restaurant_id]
    );
    const restaurant = restaurantResult.rows[0];

    // 4️⃣ Return table info, restaurant info, config, and session (if exists)
    res.json({
      table_unit_id: unit.table_unit_id,
      table_id: unit.table_id,
      table_name: unit.display_name,
      restaurant_id: unit.restaurant_id,
      restaurant_name: restaurant?.name || "",
      logo_url: restaurant?.logo_url || "",
      background_url: restaurant?.background_url || "",
      theme_color: restaurant?.theme_color || "",
      address: restaurant?.address || "",
      phone: restaurant?.phone || "",
      service_charge_percent: restaurant?.service_charge_percent || 0,
      session_id: session?.id || null,
      pax: session?.pax || null,
      // Config for rendering
      feature_flags: restaurant?.feature_flags || {},
      ui_config: restaurant?.ui_config || {},
      ui_mode: restaurant?.ui_mode || "native",
      custom_frontend_url: restaurant?.custom_frontend_url || null,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to retrieve table info" });
  }
});

export default router;
