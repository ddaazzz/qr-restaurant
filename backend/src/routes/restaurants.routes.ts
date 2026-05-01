import { Router } from "express";
import pool from "../config/db";
import { upload } from "../config/upload";
import { isR2Configured, uploadToR2, getR2Folder } from "../config/storage";
import jwt from "jsonwebtoken";

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
    const restaurantId = req.params.restaurantId as string;

    if (!req.file) {
      return res.status(400).json({ error: "Image upload failed" });
    }

    let backgroundPath: string;
    if (isR2Configured() && req.file!.buffer) {
      backgroundPath = await uploadToR2(req.file!.buffer, req.file!.originalname, getR2Folder("background", restaurantId), req.file!.mimetype);
    } else {
      backgroundPath = `/uploads/restaurants/${restaurantId}/${req.file!.filename}`;
    }

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

// ==================== SUBSCRIPTION ====================

// GET subscription tier for a restaurant
router.get("/:restaurantId/subscription", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const result = await pool.query(
      "SELECT subscription_tier, subscription_trial_end FROM restaurants WHERE id = $1",
      [restaurantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }
    const row = result.rows[0];
    res.json({
      tier: row.subscription_tier || 'free',
      trial_end_date: row.subscription_trial_end || null,
    });
  } catch (err) {
    console.error("Error fetching subscription:", err);
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

// POST update subscription tier — superadmin only (called from web dashboard)
router.post("/:restaurantId/subscription", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Authentication required" });
    let caller: any;
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
      const userResult = await pool.query("SELECT id, role FROM users WHERE id = $1", [decoded.id]);
      caller = userResult.rows[0];
    } catch { return res.status(401).json({ error: "Invalid token" }); }
    if (!caller || caller.role !== "superadmin") {
      return res.status(403).json({ error: "Superadmin access required" });
    }

    const { restaurantId } = req.params;
    const { tier, trial_end_date } = req.body as { tier: 'free' | 'premium'; trial_end_date?: string | null };

    if (!tier || !['free', 'premium'].includes(tier)) {
      return res.status(400).json({ error: "tier must be 'free' or 'premium'" });
    }

    await pool.query(
      "UPDATE restaurants SET subscription_tier = $1, subscription_trial_end = $2 WHERE id = $3",
      [tier, trial_end_date ?? null, restaurantId]
    );

    res.json({ tier, trial_end_date: trial_end_date ?? null });
  } catch (err) {
    console.error("Error updating subscription:", err);
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

export default router;
