import { Router } from "express";
import pool from "../config/db";

const router = Router();

// GET restaurant settings
router.get("/restaurants/:restaurantId/settings", async (req, res) => {
  try {
    // Try to select all columns first (with migration 074 applied)
    let result = await pool.query(
      `SELECT id, name, address, phone, logo_url, background_url, theme_color, timezone,
              language_preference, service_charge_percent, qr_mode, booking_time_allowance_mins,
              active_payment_vendor, active_payment_terminal_id, payment_asia_order_pay_enabled,
              force_pay_on_phone,
              show_item_status_to_diners, feature_flags, ui_config, ui_mode, custom_frontend_url,
              custom_domain, is_customized, xish_enabled, lat, lng,
              venue_type, has_table_service, operating_hours, featured_item_ids, featured_banners,
              service_request_types
       FROM restaurants WHERE id = $1`,
      [req.params.restaurantId]
    ).catch(async (err: any) => {
      // If newer columns don't exist yet, progressively fall back
      if (err.message?.includes('featured_banners') || err.message?.includes('operating_hours') || err.message?.includes('featured_item_ids') || err.message?.includes('service_request_types')) {
        // Migration 117 not applied — try without those two columns
        return pool.query(
          `SELECT id, name, address, phone, logo_url, background_url, theme_color, timezone,
                  language_preference, service_charge_percent, qr_mode, booking_time_allowance_mins,
                  active_payment_vendor, active_payment_terminal_id, payment_asia_order_pay_enabled,
                  show_item_status_to_diners, feature_flags, ui_config, ui_mode, custom_frontend_url,
                  custom_domain, is_customized, xish_enabled, lat, lng,
                  venue_type, has_table_service, operating_hours, featured_item_ids
           FROM restaurants WHERE id = $1`,
          // NOTE: featured_banners intentionally omitted from fallback query (migration 119)
          [req.params.restaurantId]
        ).catch(async (err2: any) => {
          // Migration 074 also not applied — fetch only base columns
          if (err2.message?.includes('feature_flags') || err2.message?.includes('ui_mode') || err2.message?.includes('ui_config')) {
            console.warn('[Settings] Migrations 074+117 not applied, falling back to base query');
            return pool.query(
              `SELECT id, name, address, phone, logo_url, background_url, theme_color, timezone,
                      language_preference, service_charge_percent, qr_mode, booking_time_allowance_mins,
                      active_payment_vendor, active_payment_terminal_id, payment_asia_order_pay_enabled,
                      show_item_status_to_diners
               FROM restaurants WHERE id = $1`,
              [req.params.restaurantId]
            );
          }
          throw err2;
        });
      }
      // Migration 074 not applied
      if (err.message?.includes('feature_flags') || err.message?.includes('ui_mode') || err.message?.includes('ui_config')) {
        console.warn('[Settings] Migration 074 not yet applied, falling back to basic query');
        return pool.query(
          `SELECT id, name, address, phone, logo_url, background_url, theme_color, timezone,
                  language_preference, service_charge_percent, qr_mode, booking_time_allowance_mins,
                  active_payment_vendor, active_payment_terminal_id, payment_asia_order_pay_enabled,
                  show_item_status_to_diners
           FROM restaurants WHERE id = $1`,
          [req.params.restaurantId]
        );
      }
      throw err;
    });
    
    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const r = result.rows[0];
    // Derive order_pay_enabled: online payment configured AND force_pay_on_phone toggle is ON
    r.order_pay_enabled =
      r.active_payment_vendor === 'payment-asia' &&
      r.active_payment_terminal_id != null &&
      r.force_pay_on_phone === true;
    r.force_pay_on_phone = r.force_pay_on_phone === true;
    // Provide defaults if columns weren't selected
    r.feature_flags = r.feature_flags || {};
    r.ui_config = r.ui_config || {};
    r.ui_mode = r.ui_mode || 'native';
    r.custom_frontend_url = r.custom_frontend_url || null;
    r.custom_domain = r.custom_domain || null;
    r.is_customized = r.is_customized || false;
    r.venue_type = r.venue_type || 'restaurant';
    r.has_table_service = r.has_table_service !== false; // default true
    r.operating_hours = r.operating_hours || '';
    r.featured_item_ids = r.featured_item_ids || [];
    r.featured_banners = r.featured_banners || [];
    r.service_request_types = r.service_request_types || [];
    // Extract loyalty_pass from ui_config so frontend can read it directly
    r.loyalty_pass = r.ui_config.loyalty_pass || {};
    res.json(r);
  } catch (err: any) {
    console.error('[Settings] Error fetching settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET payment settings (lightweight — called by customer menu on every order)
router.get("/restaurants/:restaurantId/payment-settings", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT active_payment_vendor, active_payment_terminal_id, payment_asia_order_pay_enabled,
              force_pay_on_phone, show_item_status_to_diners, feature_flags
       FROM restaurants WHERE id = $1`,
      [req.params.restaurantId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const r = result.rows[0];
    const order_pay_enabled =
      r.active_payment_vendor === 'payment-asia' &&
      r.active_payment_terminal_id != null &&
      r.force_pay_on_phone === true;
    const flags = r.feature_flags || {};
    const service_requests_enabled = flags.service_requests === true;
    res.json({ order_pay_enabled, service_requests_enabled, show_item_status_to_diners: r.show_item_status_to_diners !== false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET restaurant config (lightweight — feature flags, ui config for mobile app)
router.get("/restaurants/:restaurantId/config", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT feature_flags, ui_config, ui_mode, language_preference
       FROM restaurants WHERE id = $1`,
      [req.params.restaurantId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    // Graceful fallback if columns don't exist (e.g. production before migration)
    if (err.message?.includes("column")) {
      try {
        const fallback = await pool.query(
          `SELECT ui_mode, language_preference FROM restaurants WHERE id = $1`,
          [req.params.restaurantId]
        );
        if (fallback.rowCount === 0) return res.status(404).json({ error: "Not found" });
        res.json({ ...fallback.rows[0], feature_flags: {}, ui_config: {} });
      } catch (e2: any) {
        res.status(500).json({ error: e2.message });
      }
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// PATCH restaurant settings
router.patch("/restaurants/:restaurantId/settings", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, address, phone, language_preference, service_charge_percent, theme_color, logo_url, background_url, timezone, qr_mode, booking_time_allowance_mins, order_pay_enabled, force_pay_on_phone, show_item_status_to_diners, ui_config, feature_flags, xish_enabled, lat, lng, venue_type, has_table_service, operating_hours, featured_item_ids, featured_banners, service_request_types } = req.body;
    
    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (address !== undefined) {
      updates.push(`address = $${paramCount++}`);
      values.push(address);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    if (language_preference !== undefined) {
      updates.push(`language_preference = $${paramCount++}`);
      values.push(language_preference);
    }
    if (service_charge_percent !== undefined) {
      updates.push(`service_charge_percent = $${paramCount++}`);
      values.push(service_charge_percent);
    }
    if (theme_color !== undefined) {
      updates.push(`theme_color = $${paramCount++}`);
      values.push(theme_color);
    }
    if (logo_url !== undefined) {
      updates.push(`logo_url = $${paramCount++}`);
      values.push(logo_url);
    }
    if (background_url !== undefined) {
      updates.push(`background_url = $${paramCount++}`);
      values.push(background_url);
    }
    if (timezone !== undefined) {
      updates.push(`timezone = $${paramCount++}`);
      values.push(timezone);
    }
    if (qr_mode !== undefined) {
      updates.push(`qr_mode = $${paramCount++}`);
      values.push(qr_mode);
      // Sync regenerate_qr_per_session: regenerate = true, static modes = false
      updates.push(`regenerate_qr_per_session = $${paramCount++}`);
      values.push(qr_mode === 'regenerate');
    }
    if (booking_time_allowance_mins !== undefined) {
      updates.push(`booking_time_allowance_mins = $${paramCount++}`);
      values.push(booking_time_allowance_mins);
    }
    if (order_pay_enabled !== undefined) {
      updates.push(`payment_asia_order_pay_enabled = $${paramCount++}`);
      values.push(order_pay_enabled);
    }
    if (force_pay_on_phone !== undefined) {
      updates.push(`force_pay_on_phone = $${paramCount++}`);
      values.push(force_pay_on_phone);
    }
    if (show_item_status_to_diners !== undefined) {
      updates.push(`show_item_status_to_diners = $${paramCount++}`);
      values.push(show_item_status_to_diners);
    }
    if (ui_config !== undefined) {
      // Merge with existing ui_config to avoid overwriting unrelated keys
      updates.push(`ui_config = COALESCE(ui_config, '{}'::jsonb) || $${paramCount++}::jsonb`);
      values.push(JSON.stringify(ui_config));
    }
    if (feature_flags !== undefined) {
      // Merge with existing feature_flags to avoid overwriting unrelated flags
      updates.push(`feature_flags = COALESCE(feature_flags, '{}'::jsonb) || $${paramCount++}::jsonb`);
      values.push(JSON.stringify(feature_flags));
      // Sync xish feature flag to the dedicated xish_enabled column
      if (typeof feature_flags.xish === 'boolean') {
        updates.push(`xish_enabled = $${paramCount++}`);
        values.push(feature_flags.xish);
      }
    }
    if (xish_enabled !== undefined) {
      updates.push(`xish_enabled = $${paramCount++}`);
      values.push(xish_enabled);
    }
    if (lat !== undefined) {
      updates.push(`lat = $${paramCount++}`);
      values.push(lat);
    }
    if (lng !== undefined) {
      updates.push(`lng = $${paramCount++}`);
      values.push(lng);
    }
    if (venue_type !== undefined) {
      updates.push(`venue_type = $${paramCount++}`);
      values.push(venue_type);
    }
    if (has_table_service !== undefined) {
      updates.push(`has_table_service = $${paramCount++}`);
      values.push(has_table_service);
    }
    if (operating_hours !== undefined) {
      updates.push(`operating_hours = $${paramCount++}`);
      values.push(operating_hours);
    }
    if (featured_item_ids !== undefined) {
      updates.push(`featured_item_ids = $${paramCount++}`);
      values.push(featured_item_ids);
    }
    if (featured_banners !== undefined) {
      updates.push(`featured_banners = $${paramCount++}`);
      values.push(JSON.stringify(featured_banners));
    }

    // loyalty_pass is stored as a nested key inside ui_config
    const loyalty_pass = req.body.loyalty_pass;
    if (loyalty_pass !== undefined) {
      updates.push(`ui_config = jsonb_set(COALESCE(ui_config, '{}'::jsonb), '{loyalty_pass}', $${paramCount++}::jsonb, true)`);
      values.push(JSON.stringify(loyalty_pass));
    }
    if (service_request_types !== undefined) {
      updates.push(`service_request_types = $${paramCount++}::jsonb`);
      values.push(JSON.stringify(service_request_types));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(restaurantId);
    const result = await pool.query(
      `UPDATE restaurants SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING id, name, address, phone, logo_url, background_url, theme_color, timezone, language_preference, service_charge_percent, qr_mode, booking_time_allowance_mins, xish_enabled, venue_type, has_table_service`,
      values
    );
    
    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

