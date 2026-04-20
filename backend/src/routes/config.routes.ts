import { Router } from "express";
import pool from "../config/db";
import jwt from "jsonwebtoken";
import { DEFAULT_FEATURE_FLAGS, DEFAULT_UI_CONFIG, mergeFeatureFlags, mergeUiConfig } from "../config/restaurantDefaults";

const router = Router();

/**
 * GET /api/restaurants/:restaurantId/config
 * 
 * Returns the full configuration for a restaurant.
 * This is the single source of truth that frontends and mobile use
 * to decide how to render and what features to show.
 *
 * - Standard restaurants get defaults merged with any overrides
 * - Custom restaurants get their full custom config
 * - Mobile uses ui_mode to decide native vs webview rendering
 */
router.get("/restaurants/:restaurantId/config", async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const result = await pool.query(
      `SELECT
        id, name, logo_url, background_url, theme_color,
        address, phone, timezone, language_preference,
        service_charge_percent, qr_mode,
        is_customized, app_version,
        custom_domain, ui_mode, custom_frontend_url,
        feature_flags, ui_config,
        active_payment_vendor, active_payment_terminal_id,
        payment_asia_order_pay_enabled, show_item_status_to_diners
      FROM restaurants WHERE id = $1`,
      [restaurantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const r = result.rows[0];

    const featureFlags = mergeFeatureFlags(r.feature_flags, r);
    const uiConfig = mergeUiConfig(r.ui_config);

    res.json({
      id: r.id,
      name: r.name,
      logo_url: r.logo_url,
      background_url: r.background_url,
      theme_color: r.theme_color,
      address: r.address,
      phone: r.phone,
      timezone: r.timezone,
      language: r.language_preference,
      service_charge_percent: r.service_charge_percent,
      qr_mode: r.qr_mode,

      // Customization state
      is_customized: r.is_customized || false,
      app_version: r.app_version,
      custom_domain: r.custom_domain,

      // How to render
      ui_mode: r.ui_mode || "native",
      custom_frontend_url: r.custom_frontend_url,

      // Feature flags — what's enabled
      feature_flags: featureFlags,

      // UI config — how it looks
      ui_config: uiConfig,
    });
  } catch (err: any) {
    console.error("Config endpoint error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/restaurants/:restaurantId/config
 * 
 * Update feature flags, UI config, and customization settings.
 * Superadmin or restaurant admin only.
 */
router.patch("/restaurants/:restaurantId/config", async (req, res) => {
  try {
    // Auth: require admin or superadmin
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Authentication required" });
    let caller: any;
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
      const userResult = await pool.query("SELECT id, role, restaurant_id FROM users WHERE id = $1", [decoded.id]);
      caller = userResult.rows[0];
    } catch { return res.status(401).json({ error: "Invalid token" }); }
    if (!caller || (caller.role !== "admin" && caller.role !== "superadmin")) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { restaurantId } = req.params;

    // Admin can only edit their own restaurant
    if (caller.role !== "superadmin" && String(caller.restaurant_id) !== restaurantId) {
      return res.status(403).json({ error: "Cannot edit another restaurant" });
    }

    const { feature_flags, ui_config, ui_mode, custom_frontend_url, custom_domain, is_customized } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (feature_flags !== undefined) {
      // Merge with existing flags (don't replace entirely)
      updates.push(`feature_flags = COALESCE(feature_flags, '{}') || $${paramCount++}::jsonb`);
      values.push(JSON.stringify(feature_flags));
    }
    if (ui_config !== undefined) {
      // Merge with existing config
      updates.push(`ui_config = COALESCE(ui_config, '{}') || $${paramCount++}::jsonb`);
      values.push(JSON.stringify(ui_config));
    }
    if (ui_mode !== undefined) {
      updates.push(`ui_mode = $${paramCount++}`);
      values.push(ui_mode);
    }
    if (custom_frontend_url !== undefined) {
      updates.push(`custom_frontend_url = $${paramCount++}`);
      values.push(custom_frontend_url);
    }
    if (custom_domain !== undefined) {
      updates.push(`custom_domain = $${paramCount++}`);
      values.push(custom_domain);
    }
    if (is_customized !== undefined) {
      updates.push(`is_customized = $${paramCount++}`);
      values.push(is_customized);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(restaurantId);
    const result = await pool.query(
      `UPDATE restaurants SET ${updates.join(", ")} WHERE id = $${paramCount}
       RETURNING id, feature_flags, ui_config, ui_mode, custom_frontend_url, custom_domain, is_customized`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error("Config update error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
