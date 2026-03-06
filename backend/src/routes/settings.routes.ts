import { Router } from "express";
import pool from "../config/db";

const router = Router();

// GET restaurant settings
router.get("/restaurants/:restaurantId/settings", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, theme_color, timezone, language_preference FROM restaurants WHERE id = $1",
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
    const { language_preference } = req.body;
    
    if (!language_preference) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const result = await pool.query(
      "UPDATE restaurants SET language_preference = $1 WHERE id = $2 RETURNING id, name, theme_color, timezone, language_preference",
      [language_preference, restaurantId]
    );
    
    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

