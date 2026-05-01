import { Router } from "express";
import pool from "../config/db";
import { upload } from "../config/upload";
import { isR2Configured, uploadToR2, getR2Folder } from "../config/storage";

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

// POST verify Apple receipt and update subscription
router.post("/:restaurantId/subscription/verify-receipt", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { receipt } = req.body;

    if (!receipt) {
      return res.status(400).json({ error: "receipt is required" });
    }

    // Verify with Apple's receipt validation API
    const APPLE_VERIFY_URL = process.env.NODE_ENV === 'production'
      ? 'https://buy.itunes.apple.com/verifyReceipt'
      : 'https://sandbox.itunes.apple.com/verifyReceipt';

    const appleSharedSecret = process.env.APPLE_IAP_SHARED_SECRET;
    if (!appleSharedSecret) {
      return res.status(500).json({ error: "Server not configured for IAP verification" });
    }

    const appleResponse = await fetch(APPLE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'receipt-data': receipt, password: appleSharedSecret, 'exclude-old-transactions': true }),
    });

    const appleData = await appleResponse.json() as any;

    // status 0 = valid, 21007 = sandbox receipt sent to production
    if (appleData.status === 21007) {
      // Retry with sandbox
      const sandboxResponse = await fetch('https://sandbox.itunes.apple.com/verifyReceipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'receipt-data': receipt, password: appleSharedSecret, 'exclude-old-transactions': true }),
      });
      const sandboxData = await sandboxResponse.json() as any;
      if (sandboxData.status !== 0) {
        return res.status(400).json({ error: "Invalid receipt", status: sandboxData.status });
      }
      Object.assign(appleData, sandboxData);
    } else if (appleData.status !== 0) {
      return res.status(400).json({ error: "Invalid receipt", status: appleData.status });
    }

    // Find the latest active subscription in latest_receipt_info
    const latestReceipts: any[] = appleData.latest_receipt_info || [];
    const now = Date.now();
    const activeReceipt = latestReceipts
      .filter((r: any) => parseInt(r.expires_date_ms) > now)
      .sort((a: any, b: any) => parseInt(b.expires_date_ms) - parseInt(a.expires_date_ms))[0];

    if (!activeReceipt) {
      // No active subscription — downgrade to free
      await pool.query(
        "UPDATE restaurants SET subscription_tier = 'free', subscription_trial_end = NULL WHERE id = $1",
        [restaurantId]
      );
      return res.json({ tier: 'free', trial_end_date: null });
    }

    const expiresDate = new Date(parseInt(activeReceipt.expires_date_ms));
    const isTrialPeriod = activeReceipt.is_trial_period === 'true';
    const trialEndDate = isTrialPeriod ? expiresDate.toISOString() : null;

    await pool.query(
      "UPDATE restaurants SET subscription_tier = 'premium', subscription_trial_end = $1 WHERE id = $2",
      [trialEndDate, restaurantId]
    );

    res.json({ tier: 'premium', trial_end_date: trialEndDate });
  } catch (err) {
    console.error("Error verifying receipt:", err);
    res.status(500).json({ error: "Failed to verify receipt" });
  }
});

export default router;
