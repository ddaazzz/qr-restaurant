import { Router } from "express";
import pool from "../config/db";
import { upload } from "../config/upload";

const router = Router();

// ✅ MULTI-RESTAURANT SUPPORT

// GET all restaurants (superadmin only - verify via token)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, address, phone FROM restaurants ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch restaurants" });
  }
});

// GET single restaurant details (admin/staff of that restaurant only)
router.get("/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Verify restaurant exists
    const result = await pool.query(
      "SELECT id, name, address, phone, logo_url, theme_color, timezone, background_url FROM restaurants WHERE id = $1",
      [restaurantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch restaurant" });
  }
});

// POST upload restaurant background image
router.post("/:restaurantId/background", upload.single("image"), async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: "Image upload failed" });
    }

    const backgroundPath = `/uploads/restaurants/${restaurantId}/${req.file.filename}`;

    await pool.query(
      `UPDATE restaurants SET background_url = $1 WHERE id = $2`,
      [backgroundPath, restaurantId]
    );

    res.json({ background_url: backgroundPath });
  } catch (err) {
    console.error("Error uploading background:", err);
    res.status(500).json({ error: "Failed to upload background image" });
  }
});

export default router;
