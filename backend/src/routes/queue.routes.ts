import { Router } from "express";
import pool from "../config/db";
import crypto from "crypto";

const router = Router();

/* ──────────────────────────────────────────────────────────────
   HELPERS
────────────────────────────────────────────────────────────── */

/** Upsert queue_settings for a restaurant, returning the row */
async function ensureQueueSettings(restaurantId: string | number) {
  const existing = await pool.query(
    `SELECT * FROM queue_settings WHERE restaurant_id = $1`,
    [restaurantId]
  );
  if ((existing.rowCount ?? 0) > 0) return existing.rows[0];
  const token = crypto.randomBytes(24).toString("hex");
  const res = await pool.query(
    `INSERT INTO queue_settings (restaurant_id, queue_qr_token)
     VALUES ($1, $2) ON CONFLICT (restaurant_id) DO NOTHING
     RETURNING *`,
    [restaurantId, token]
  );
  if ((res.rowCount ?? 0) > 0) return res.rows[0];
  // race: another insert won
  const again = await pool.query(
    `SELECT * FROM queue_settings WHERE restaurant_id = $1`,
    [restaurantId]
  );
  return again.rows[0];
}

/* ──────────────────────────────────────────────────────────────
   SETTINGS
────────────────────────────────────────────────────────────── */

// GET /restaurants/:restaurantId/queue/settings
router.get("/restaurants/:restaurantId/queue/settings", async (req, res) => {
  try {
    const settings = await ensureQueueSettings(req.params.restaurantId);
    res.json(settings);
  } catch (err) {
    console.error("[Queue] GET settings:", err);
    res.status(500).json({ error: "Failed to fetch queue settings" });
  }
});

// PUT /restaurants/:restaurantId/queue/settings
router.put("/restaurants/:restaurantId/queue/settings", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { enabled, pax_bands } = req.body;

    // Validate pax_bands if provided
    if (pax_bands !== undefined) {
      if (!Array.isArray(pax_bands) || pax_bands.some(
        (b: any) => typeof b.min !== "number" || typeof b.max !== "number" || !b.label
      )) {
        return res.status(400).json({ error: "pax_bands must be array of {min, max, label}" });
      }
    }

    await ensureQueueSettings(restaurantId);

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (enabled !== undefined) { updates.push(`enabled = $${idx++}`); values.push(!!enabled); }
    if (pax_bands !== undefined) { updates.push(`pax_bands = $${idx++}`); values.push(JSON.stringify(pax_bands)); }

    if (updates.length === 0) {
      const settings = await ensureQueueSettings(restaurantId);
      return res.json(settings);
    }

    values.push(restaurantId);
    const result = await pool.query(
      `UPDATE queue_settings SET ${updates.join(", ")} WHERE restaurant_id = $${idx} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[Queue] PUT settings:", err);
    res.status(500).json({ error: "Failed to update queue settings" });
  }
});

/* ──────────────────────────────────────────────────────────────
   QUEUE STATUS (public — for customer-facing page)
────────────────────────────────────────────────────────────── */

// GET /queue/:queueToken/status — by queue QR token (public)
router.get("/queue/:queueToken/status", async (req, res) => {
  try {
    const { queueToken } = req.params;
    const settingsRes = await pool.query(
      `SELECT qs.*, r.name AS restaurant_name, r.logo_url, r.theme_color
       FROM queue_settings qs
       JOIN restaurants r ON r.id = qs.restaurant_id
       WHERE qs.queue_qr_token = $1`,
      [queueToken]
    );
    if ((settingsRes.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: "Invalid queue token" });
    }
    const settings = settingsRes.rows[0];
    if (!settings.enabled) {
      return res.json({ enabled: false });
    }

    // Count waiting entries
    const countRes = await pool.query(
      `SELECT COUNT(*) AS total FROM queue_entries
       WHERE restaurant_id = $1 AND status = 'waiting'`,
      [settings.restaurant_id]
    );

    // Band breakdown
    const bandsRes = await pool.query(
      `SELECT pax_band_label, COUNT(*) AS cnt
       FROM queue_entries
       WHERE restaurant_id = $1 AND status = 'waiting'
       GROUP BY pax_band_label`,
      [settings.restaurant_id]
    );

    // Next number to be issued
    const nextRes = await pool.query(
      `SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_number
       FROM queue_entries WHERE restaurant_id = $1
         AND created_at > NOW() - INTERVAL '8 hours'`,
      [settings.restaurant_id]
    );

    res.json({
      enabled: true,
      restaurant_id: settings.restaurant_id,
      restaurant_name: settings.restaurant_name,
      logo_url: settings.logo_url,
      theme_color: settings.theme_color,
      pax_bands: settings.pax_bands,
      waiting_total: parseInt(countRes.rows[0].total, 10),
      band_counts: bandsRes.rows,
      next_number: parseInt(nextRes.rows[0].next_number, 10),
    });
  } catch (err) {
    console.error("[Queue] GET status:", err);
    res.status(500).json({ error: "Failed to fetch queue status" });
  }
});

/* ──────────────────────────────────────────────────────────────
   JOIN QUEUE (public — customer action)
────────────────────────────────────────────────────────────── */

// POST /queue/:queueToken/join
router.post("/queue/:queueToken/join", async (req, res) => {
  try {
    const { queueToken } = req.params;
    const { pax } = req.body;

    if (!pax || typeof pax !== "number" || pax < 1) {
      return res.status(400).json({ error: "pax must be a positive number" });
    }

    const settingsRes = await pool.query(
      `SELECT * FROM queue_settings WHERE queue_qr_token = $1`,
      [queueToken]
    );
    if ((settingsRes.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: "Invalid queue token" });
    }
    const settings = settingsRes.rows[0];
    if (!settings.enabled) {
      return res.status(400).json({ error: "Queue is not active" });
    }

    // Determine pax band label
    const bands: Array<{ min: number; max: number; label: string }> = settings.pax_bands;
    const band = bands.find(b => pax >= b.min && pax <= b.max) || null;
    const paxBandLabel = band ? band.label : `${pax} pax`;

    // Assign next queue number (within today's queue, reset daily)
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const numRes = await client.query(
        `SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_number
         FROM queue_entries WHERE restaurant_id = $1
           AND created_at > NOW() - INTERVAL '8 hours'`,
        [settings.restaurant_id]
      );
      const queueNumber = parseInt(numRes.rows[0].next_number, 10);

      const entry = await client.query(
        `INSERT INTO queue_entries (restaurant_id, queue_number, pax, pax_band_label)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [settings.restaurant_id, queueNumber, pax, paxBandLabel]
      );

      // Count how many are ahead (same or earlier number, still waiting)
      const aheadRes = await client.query(
        `SELECT COUNT(*) AS ahead FROM queue_entries
         WHERE restaurant_id = $1 AND status = 'waiting'
           AND queue_number < $2`,
        [settings.restaurant_id, queueNumber]
      );

      await client.query("COMMIT");
      res.status(201).json({
        entry: entry.rows[0],
        groups_ahead: parseInt(aheadRes.rows[0].ahead, 10),
      });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[Queue] POST join:", err);
    res.status(500).json({ error: "Failed to join queue" });
  }
});

/* ──────────────────────────────────────────────────────────────
   ENTRY STATUS (public — customer polls their position)
────────────────────────────────────────────────────────────── */

// GET /queue/entry/:entryId — check individual entry
router.get("/queue/entry/:entryId", async (req, res) => {
  try {
    const { entryId } = req.params;
    const entryRes = await pool.query(
      `SELECT * FROM queue_entries WHERE id = $1`,
      [entryId]
    );
    if ((entryRes.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: "Entry not found" });
    }
    const entry = entryRes.rows[0];
    // Count groups ahead
    const aheadRes = await pool.query(
      `SELECT COUNT(*) AS ahead FROM queue_entries
       WHERE restaurant_id = $1 AND status = 'waiting'
         AND queue_number < $2`,
      [entry.restaurant_id, entry.queue_number]
    );
    res.json({ entry, groups_ahead: parseInt(aheadRes.rows[0].ahead, 10) });
  } catch (err) {
    console.error("[Queue] GET entry:", err);
    res.status(500).json({ error: "Failed to fetch entry" });
  }
});

/* ──────────────────────────────────────────────────────────────
   LINK TABLE (customer scans table QR → attaches order)
────────────────────────────────────────────────────────────── */

// POST /queue/entry/:entryId/link-table
// Body: { qr_token, pre_order_items }
// pre_order_items: Array<{ menu_item_id, quantity, variant_id?, addons? }>
router.post("/queue/entry/:entryId/link-table", async (req, res) => {
  try {
    const { entryId } = req.params;
    const { qr_token, pre_order_items } = req.body;

    if (!qr_token) {
      return res.status(400).json({ error: "qr_token required" });
    }

    const entryRes = await pool.query(
      `SELECT * FROM queue_entries WHERE id = $1`,
      [entryId]
    );
    if ((entryRes.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: "Queue entry not found" });
    }
    const entry = entryRes.rows[0];
    if (entry.status === "seated" || entry.linked_table_unit_id) {
      return res.status(400).json({ error: "Entry already seated" });
    }

    // Resolve table unit from QR token
    const unitRes = await pool.query(
      `SELECT tu.id AS table_unit_id, tu.display_name, t.id AS table_id, t.restaurant_id
       FROM table_units tu JOIN tables t ON t.id = tu.table_id
       WHERE tu.qr_token = $1`,
      [qr_token]
    );
    if ((unitRes.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: "Invalid table QR" });
    }
    const unit = unitRes.rows[0];
    if (unit.restaurant_id !== entry.restaurant_id) {
      return res.status(403).json({ error: "Table belongs to a different restaurant" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Create or get active table session
      const existingSession = await client.query(
        `SELECT id FROM table_sessions WHERE table_unit_id = $1 AND ended_at IS NULL`,
        [unit.table_unit_id]
      );
      let sessionId: number;
      if ((existingSession.rowCount ?? 0) > 0) {
        sessionId = existingSession.rows[0].id;
      } else {
        const sessionRes = await client.query(
          `INSERT INTO table_sessions (table_unit_id, restaurant_id, pax)
           VALUES ($1, $2, $3) RETURNING id`,
          [unit.table_unit_id, entry.restaurant_id, entry.pax]
        );
        sessionId = sessionRes.rows[0].id;
      }

      // If there are pre-ordered items, create an order
      let orderId: number | null = null;
      if (Array.isArray(pre_order_items) && pre_order_items.length > 0) {
        // Check for existing open order on session
        const existingOrder = await client.query(
          `SELECT id FROM orders WHERE session_id = $1 AND status <> 'completed' LIMIT 1`,
          [sessionId]
        );
        if ((existingOrder.rowCount ?? 0) > 0) {
          orderId = existingOrder.rows[0].id;
        } else {
          const orderRes = await client.query(
            `INSERT INTO orders (session_id, restaurant_id, is_takeaway, placed_by)
             VALUES ($1, $2, false, 'queue') RETURNING id`,
            [sessionId, entry.restaurant_id]
          );
          orderId = orderRes.rows[0].id;
        }

        // Insert order items
        for (const item of pre_order_items) {
          // Fetch price snapshot
          const itemRes = await client.query(
            `SELECT price_cents, name, name_zh FROM menu_items WHERE id = $1`,
            [item.menu_item_id]
          );
          if ((itemRes.rowCount ?? 0) === 0) continue;
          const menuItem = itemRes.rows[0];

          // Variant price override
          let priceCents = menuItem.price_cents;
          let variantLabel: string | null = null;
          if (item.variant_id) {
            const varRes = await client.query(
              `SELECT price_cents, label FROM item_variants WHERE id = $1`,
              [item.variant_id]
            );
            if ((varRes.rowCount ?? 0) > 0) {
              priceCents = varRes.rows[0].price_cents;
              variantLabel = varRes.rows[0].label;
            }
          }

          const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
          await client.query(
            `INSERT INTO order_items
               (order_id, menu_item_id, quantity, price_cents,
                snapshot_name, snapshot_name_zh, variant_id, variant_label)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              orderId, item.menu_item_id, qty, priceCents,
              menuItem.name, menuItem.name_zh || null,
              item.variant_id || null, variantLabel
            ]
          );
        }
      }

      // Update queue entry
      await client.query(
        `UPDATE queue_entries SET status = 'seated', seated_at = NOW(),
         linked_table_unit_id = $1, pre_order_session_id = $2
         WHERE id = $3`,
        [unit.table_unit_id, sessionId, entryId]
      );

      await client.query("COMMIT");

      res.json({
        session_id: sessionId,
        order_id: orderId,
        table_name: unit.display_name,
        table_unit_id: unit.table_unit_id,
      });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[Queue] link-table:", err);
    res.status(500).json({ error: "Failed to link table" });
  }
});

/* ──────────────────────────────────────────────────────────────
   CANCEL (customer)
────────────────────────────────────────────────────────────── */

// POST /queue/entry/:entryId/cancel
router.post("/queue/entry/:entryId/cancel", async (req, res) => {
  try {
    const { entryId } = req.params;
    const result = await pool.query(
      `UPDATE queue_entries SET status = 'cancelled'
       WHERE id = $1 AND status IN ('waiting','called') RETURNING *`,
      [entryId]
    );
    if ((result.rowCount ?? 0) === 0) {
      return res.status(400).json({ error: "Cannot cancel entry" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[Queue] cancel:", err);
    res.status(500).json({ error: "Failed to cancel" });
  }
});

/* ──────────────────────────────────────────────────────────────
   ADMIN: LIST + CALL + SEAT + REMOVE (requires auth token check)
────────────────────────────────────────────────────────────── */

// GET /restaurants/:restaurantId/queue — admin list
router.get("/restaurants/:restaurantId/queue", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { status } = req.query as { status?: string };

    const statusFilter = status || "waiting,called";
    const statuses = statusFilter.split(",").map(s => s.trim()).filter(Boolean);

    const result = await pool.query(
      `SELECT * FROM queue_entries
       WHERE restaurant_id = $1
         AND status = ANY($2::text[])
         AND created_at > NOW() - INTERVAL '8 hours'
       ORDER BY queue_number ASC`,
      [restaurantId, statuses]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[Queue] admin list:", err);
    res.status(500).json({ error: "Failed to list queue" });
  }
});

// POST /restaurants/:restaurantId/queue/:entryId/call — mark as called
router.post("/restaurants/:restaurantId/queue/:entryId/call", async (req, res) => {
  try {
    const { entryId } = req.params;
    const result = await pool.query(
      `UPDATE queue_entries SET status = 'called', called_at = NOW()
       WHERE id = $1 AND status = 'waiting' RETURNING *`,
      [entryId]
    );
    if ((result.rowCount ?? 0) === 0) {
      return res.status(400).json({ error: "Cannot call entry (not waiting)" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[Queue] call:", err);
    res.status(500).json({ error: "Failed to call entry" });
  }
});

// POST /restaurants/:restaurantId/queue/:entryId/seat — mark seated
router.post("/restaurants/:restaurantId/queue/:entryId/seat", async (req, res) => {
  try {
    const { entryId } = req.params;
    const result = await pool.query(
      `UPDATE queue_entries SET status = 'seated', seated_at = NOW()
       WHERE id = $1 AND status IN ('waiting','called') RETURNING *`,
      [entryId]
    );
    if ((result.rowCount ?? 0) === 0) {
      return res.status(400).json({ error: "Cannot seat entry" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[Queue] seat:", err);
    res.status(500).json({ error: "Failed to seat entry" });
  }
});

// DELETE /restaurants/:restaurantId/queue/:entryId — remove
router.delete("/restaurants/:restaurantId/queue/:entryId", async (req, res) => {
  try {
    const { entryId, restaurantId } = req.params;
    await pool.query(
      `UPDATE queue_entries SET status = 'cancelled'
       WHERE id = $1 AND restaurant_id = $2`,
      [entryId, restaurantId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[Queue] delete:", err);
    res.status(500).json({ error: "Failed to remove entry" });
  }
});

export default router;
