import { Router } from "express";
import pool from "../config/db";

const router = Router();

// GET restaurant settings
router.get("/restaurants/:restaurantId/settings", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, address, phone, logo_url, background_url, theme_color, timezone, language_preference, service_charge_percent, qr_mode, booking_time_allowance_mins FROM restaurants WHERE id = $1",
      [req.params.restaurantId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH restaurant settings
router.patch("/restaurants/:restaurantId/settings", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, address, phone, language_preference, service_charge_percent, logo_url, background_url, timezone, qr_mode, booking_time_allowance_mins } = req.body;
    
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
    }
    if (booking_time_allowance_mins !== undefined) {
      updates.push(`booking_time_allowance_mins = $${paramCount++}`);
      values.push(booking_time_allowance_mins);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(restaurantId);
    const result = await pool.query(
      `UPDATE restaurants SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING id, name, address, phone, logo_url, background_url, theme_color, timezone, language_preference, service_charge_percent, qr_mode, booking_time_allowance_mins`,
      values
    );
    
    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

