"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const router = (0, express_1.Router)();
// GET restaurant settings
router.get("/restaurants/:restaurantId/settings", async (req, res) => {
    try {
        // Try to select all columns first (with migration 074 applied)
        let result = await db_1.default.query(`SELECT id, name, address, phone, logo_url, background_url, theme_color, timezone,
              language_preference, service_charge_percent, qr_mode, booking_time_allowance_mins,
              active_payment_vendor, active_payment_terminal_id, payment_asia_order_pay_enabled,
              show_item_status_to_diners, feature_flags, ui_config, ui_mode, custom_frontend_url,
              custom_domain, is_customized
       FROM restaurants WHERE id = $1`, [req.params.restaurantId]).catch(async (err) => {
            // If columns don't exist yet, fetch without them
            if (err.message?.includes('feature_flags') || err.message?.includes('ui_mode') || err.message?.includes('ui_config')) {
                console.warn('[Settings] Migration 074 not yet applied, falling back to basic query');
                return db_1.default.query(`SELECT id, name, address, phone, logo_url, background_url, theme_color, timezone,
                  language_preference, service_charge_percent, qr_mode, booking_time_allowance_mins,
                  active_payment_vendor, active_payment_terminal_id, payment_asia_order_pay_enabled,
                  show_item_status_to_diners
           FROM restaurants WHERE id = $1`, [req.params.restaurantId]);
            }
            throw err;
        });
        if (result.rowCount === 0)
            return res.status(404).json({ error: "Not found" });
        const r = result.rows[0];
        // Derive order_pay_enabled: PA terminal is active AND feature not explicitly disabled
        r.order_pay_enabled =
            r.active_payment_vendor === 'payment-asia' &&
                r.active_payment_terminal_id != null &&
                r.payment_asia_order_pay_enabled !== false;
        // Provide defaults if columns weren't selected
        r.feature_flags = r.feature_flags || {};
        r.ui_config = r.ui_config || {};
        r.ui_mode = r.ui_mode || 'native';
        r.custom_frontend_url = r.custom_frontend_url || null;
        r.custom_domain = r.custom_domain || null;
        r.is_customized = r.is_customized || false;
        res.json(r);
    }
    catch (err) {
        console.error('[Settings] Error fetching settings:', err);
        res.status(500).json({ error: err.message });
    }
});
// GET payment settings (lightweight — called by customer menu on every order)
router.get("/restaurants/:restaurantId/payment-settings", async (req, res) => {
    try {
        const result = await db_1.default.query(`SELECT active_payment_vendor, active_payment_terminal_id, payment_asia_order_pay_enabled,
              show_item_status_to_diners, feature_flags
       FROM restaurants WHERE id = $1`, [req.params.restaurantId]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: "Not found" });
        const r = result.rows[0];
        const order_pay_enabled = r.active_payment_vendor === 'payment-asia' &&
            r.active_payment_terminal_id != null &&
            r.payment_asia_order_pay_enabled !== false;
        const flags = r.feature_flags || {};
        const service_requests_enabled = flags.service_requests === true;
        res.json({ order_pay_enabled, service_requests_enabled });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET restaurant config (lightweight — feature flags, ui config for mobile app)
router.get("/restaurants/:restaurantId/config", async (req, res) => {
    try {
        const result = await db_1.default.query(`SELECT feature_flags, ui_config, ui_mode, language_preference
       FROM restaurants WHERE id = $1`, [req.params.restaurantId]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: "Not found" });
        res.json(result.rows[0]);
    }
    catch (err) {
        // Graceful fallback if columns don't exist (e.g. production before migration)
        if (err.message?.includes("column")) {
            try {
                const fallback = await db_1.default.query(`SELECT ui_mode, language_preference FROM restaurants WHERE id = $1`, [req.params.restaurantId]);
                if (fallback.rowCount === 0)
                    return res.status(404).json({ error: "Not found" });
                res.json({ ...fallback.rows[0], feature_flags: {}, ui_config: {} });
            }
            catch (e2) {
                res.status(500).json({ error: e2.message });
            }
        }
        else {
            res.status(500).json({ error: err.message });
        }
    }
});
// PATCH restaurant settings
router.patch("/restaurants/:restaurantId/settings", async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { name, address, phone, language_preference, service_charge_percent, theme_color, logo_url, background_url, timezone, qr_mode, booking_time_allowance_mins, order_pay_enabled, show_item_status_to_diners, ui_config } = req.body;
        // Build dynamic UPDATE query
        const updates = [];
        const values = [];
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
        if (show_item_status_to_diners !== undefined) {
            updates.push(`show_item_status_to_diners = $${paramCount++}`);
            values.push(show_item_status_to_diners);
        }
        if (ui_config !== undefined) {
            // Merge with existing ui_config to avoid overwriting unrelated keys
            updates.push(`ui_config = COALESCE(ui_config, '{}'::jsonb) || $${paramCount++}::jsonb`);
            values.push(JSON.stringify(ui_config));
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }
        values.push(restaurantId);
        const result = await db_1.default.query(`UPDATE restaurants SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING id, name, address, phone, logo_url, background_url, theme_color, timezone, language_preference, service_charge_percent, qr_mode, booking_time_allowance_mins`, values);
        if (result.rowCount === 0)
            return res.status(404).json({ error: "Not found" });
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=settings.routes.js.map