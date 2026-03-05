import { Router } from "express";
import pool from "../config/db";

const router = Router();

// GET restaurant settings
router.get("/restaurants/:restaurantId/settings", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, theme_color, timezone, language_preference, service_charge_percent, regenerate_qr_per_session FROM restaurants WHERE id = $1",
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
    const { 
      language_preference,
      service_charge_percent,
      theme_color,
      timezone,
      name,
      phone,
      address
    } = req.body;
    
    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

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
    if (timezone !== undefined) {
      updates.push(`timezone = $${paramCount++}`);
      values.push(timezone);
    }
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    if (address !== undefined) {
      updates.push(`address = $${paramCount++}`);
      values.push(address);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(restaurantId);
    const query = `
      UPDATE restaurants 
      SET ${updates.join(", ")}
      WHERE id = $${paramCount}
      RETURNING id, name, theme_color, timezone, language_preference, service_charge_percent, regenerate_qr_per_session
    `;

    const result = await pool.query(query, values);
    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error("Settings update error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

