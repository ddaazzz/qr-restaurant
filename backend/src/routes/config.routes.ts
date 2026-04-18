import { Router } from "express";
import pool from "../config/db";

const router = Router();

// Default feature flags for standard restaurants
const DEFAULT_FEATURE_FLAGS: Record<string, boolean> = {
  bookings: true,
  waitlist: true,
  order_pay: false,
  coupons: true,
  addons: true,
  variants: true,
  item_status_visible: false,
  staff_timekeeping: true,
  kitchen_display: true,
  printer_support: true,
  crm: true,
  multi_language: true,
};

// Default UI config for standard restaurants
const DEFAULT_UI_CONFIG: Record<string, any> = {
  layout: "list",
  menu_style: "photo_cards",
  show_prices: true,
  show_descriptions: true,
  show_category_images: false,
  header_style: "banner",
  cart_style: "bottom_sheet",
  custom_css: null,
};

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
        is_customized, app_version, custom_branch,
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

    // Merge stored flags with defaults (stored values override defaults)
    const featureFlags = {
      ...DEFAULT_FEATURE_FLAGS,
      ...(r.feature_flags || {}),
      // Derive order_pay from existing payment config for backward compat
      order_pay:
        r.active_payment_vendor === "payment-asia" &&
        r.active_payment_terminal_id != null &&
        r.payment_asia_order_pay_enabled !== false,
      item_status_visible: r.show_item_status_to_diners || false,
    };

    // Merge stored UI config with defaults
    const uiConfig = {
      ...DEFAULT_UI_CONFIG,
      ...(r.ui_config || {}),
      // Always include current theme values
      primary_color: r.theme_color || DEFAULT_UI_CONFIG.primary_color,
    };

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
    const { restaurantId } = req.params;
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
