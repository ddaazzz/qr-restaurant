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
  const again = await pool.query(
    `SELECT * FROM queue_settings WHERE restaurant_id = $1`,
    [restaurantId]
  );
  return again.rows[0];
}

/** Determine which group (A/B/C) a pax count falls into */
function resolveGroup(
  groups: Array<{ letter: string; label: string; pax_min: number; pax_max: number; active: boolean }>,
  pax: number
): { letter: string; label: string } | null {
  const active = groups.filter(g => g.active !== false);
  const match = active.find(g => pax >= g.pax_min && pax <= g.pax_max);
  if (match) return { letter: match.letter, label: match.label };
  return active.length > 0 ? { letter: active[active.length - 1].letter, label: active[active.length - 1].label } : null;
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
    const { enabled, pax_bands, groups, collect_name, collect_phone, collect_email, max_pax } = req.body;

    if (groups !== undefined) {
      if (!Array.isArray(groups) || groups.some(
        (g: any) => !g.letter || typeof g.pax_min !== "number" || typeof g.pax_max !== "number"
      )) {
        return res.status(400).json({ error: "groups must be array of {letter, label, pax_min, pax_max}" });
      }
    }

    await ensureQueueSettings(restaurantId);

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (enabled !== undefined)       { updates.push(`enabled = $${idx++}`);       values.push(!!enabled); }
    if (groups !== undefined)         { updates.push(`groups = $${idx++}`);         values.push(JSON.stringify(groups)); }
    if (pax_bands !== undefined)      { updates.push(`pax_bands = $${idx++}`);      values.push(JSON.stringify(pax_bands)); }
    if (collect_name !== undefined)   { updates.push(`collect_name = $${idx++}`);   values.push(!!collect_name); }
    if (collect_phone !== undefined)  { updates.push(`collect_phone = $${idx++}`);  values.push(!!collect_phone); }
    if (collect_email !== undefined)  { updates.push(`collect_email = $${idx++}`);  values.push(!!collect_email); }
    if (max_pax !== undefined)        { updates.push(`max_pax = $${idx++}`);        values.push(Number(max_pax) || 20); }

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
   QUEUE STATUS (public)
────────────────────────────────────────────────────────────── */

// GET /queue/:queueToken/status
router.get("/queue/:queueToken/status", async (req, res) => {
  try {
    const { queueToken } = req.params;
    const settingsRes = await pool.query(
      `SELECT qs.*, r.name AS restaurant_name, r.logo_url, r.background_url, r.theme_color
       FROM queue_settings qs
       JOIN restaurants r ON r.id = qs.restaurant_id
       WHERE qs.queue_qr_token = $1`,
      [queueToken]
    );
    if ((settingsRes.rowCount ?? 0) === 0) return res.status(404).json({ error: "Invalid queue token" });
    const settings = settingsRes.rows[0];
    if (!settings.enabled) return res.json({ enabled: false });

    const groupCountsRes = await pool.query(
      `SELECT group_letter, COUNT(*) AS cnt
       FROM queue_entries
       WHERE restaurant_id = $1 AND status = 'waiting'
         AND created_at > NOW() - INTERVAL '8 hours'
       GROUP BY group_letter`,
      [settings.restaurant_id]
    );
    const groupCounts: Record<string, number> = {};
    groupCountsRes.rows.forEach((r: any) => {
      if (r.group_letter) groupCounts[r.group_letter] = parseInt(r.cnt, 10);
    });

    const calledRes = await pool.query(
      `SELECT DISTINCT ON (group_letter) group_letter, group_number, queue_number
       FROM queue_entries
       WHERE restaurant_id = $1 AND status = 'called'
         AND created_at > NOW() - INTERVAL '8 hours'
       ORDER BY group_letter, called_at DESC NULLS LAST`,
      [settings.restaurant_id]
    );
    const currentCalled: Record<string, string> = {};
    calledRes.rows.forEach((r: any) => {
      if (r.group_letter && r.group_number != null) {
        currentCalled[r.group_letter] = r.group_letter + String(r.group_number).padStart(3, "0");
      }
    });

    const totalRes = await pool.query(
      `SELECT COUNT(*) AS total FROM queue_entries
       WHERE restaurant_id = $1 AND status = 'waiting'
         AND created_at > NOW() - INTERVAL '8 hours'`,
      [settings.restaurant_id]
    );

    res.json({
      enabled: true,
      restaurant_id: settings.restaurant_id,
      restaurant_name: settings.restaurant_name,
      logo_url: settings.logo_url,
      background_url: settings.background_url,
      theme_color: settings.theme_color,
      groups: settings.groups || [],
      collect_name: settings.collect_name || false,
      collect_phone: settings.collect_phone || false,
      collect_email: settings.collect_email || false,
      max_pax: settings.max_pax || 20,
      waiting_total: parseInt(totalRes.rows[0].total, 10),
      group_counts: groupCounts,
      current_called: currentCalled,
    });
  } catch (err) {
    console.error("[Queue] GET status:", err);
    res.status(500).json({ error: "Failed to fetch queue status" });
  }
});

/* ──────────────────────────────────────────────────────────────
   JOIN QUEUE (public)
────────────────────────────────────────────────────────────── */

// POST /queue/:queueToken/join
router.post("/queue/:queueToken/join", async (req, res) => {
  try {
    const { queueToken } = req.params;
    const { pax, contact_name, contact_phone, contact_email } = req.body;

    if (!pax || typeof pax !== "number" || pax < 1) {
      return res.status(400).json({ error: "pax must be a positive number" });
    }

    const settingsRes = await pool.query(
      `SELECT * FROM queue_settings WHERE queue_qr_token = $1`,
      [queueToken]
    );
    if ((settingsRes.rowCount ?? 0) === 0) return res.status(404).json({ error: "Invalid queue token" });
    const settings = settingsRes.rows[0];
    if (!settings.enabled) return res.status(400).json({ error: "Queue is not active" });

    const groups: Array<{ letter: string; label: string; pax_min: number; pax_max: number; active: boolean }> =
      settings.groups || [
        { letter: "A", label: "A", pax_min: 1, pax_max: 2, active: true },
        { letter: "B", label: "B", pax_min: 3, pax_max: 4, active: true },
        { letter: "C", label: "C", pax_min: 5, pax_max: 20, active: true },
      ];
    const group = resolveGroup(groups, pax);
    const groupLetter = group?.letter || "A";
    const groupLabel  = group?.label  || groupLetter;

    const bands: Array<{ min: number; max: number; label: string }> = settings.pax_bands || [];
    const band = bands.find(b => pax >= b.min && pax <= b.max) || null;
    const paxBandLabel = band ? band.label : `${pax} pax`;

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

      const groupNumRes = await client.query(
        `SELECT COALESCE(MAX(group_number), 0) + 1 AS next_group_number
         FROM queue_entries WHERE restaurant_id = $1
           AND group_letter = $2
           AND created_at > NOW() - INTERVAL '8 hours'`,
        [settings.restaurant_id, groupLetter]
      );
      const groupNumber = parseInt(groupNumRes.rows[0].next_group_number, 10);

      let crmCustomerId: number | null = null;
      const hasContact = contact_name || contact_phone || contact_email;
      if (hasContact && (settings.collect_name || settings.collect_phone || settings.collect_email)) {
        let existingCrm = null;
        if (contact_phone) {
          const crmRes = await client.query(
            `SELECT id FROM crm_customers WHERE restaurant_id = $1 AND phone = $2 LIMIT 1`,
            [settings.restaurant_id, contact_phone]
          );
          if ((crmRes.rowCount ?? 0) > 0) existingCrm = crmRes.rows[0];
        }
        if (!existingCrm && contact_email) {
          const crmRes = await client.query(
            `SELECT id FROM crm_customers WHERE restaurant_id = $1 AND email = $2 LIMIT 1`,
            [settings.restaurant_id, contact_email]
          );
          if ((crmRes.rowCount ?? 0) > 0) existingCrm = crmRes.rows[0];
        }
        if (existingCrm) {
          crmCustomerId = existingCrm.id;
        } else {
          const newCrm = await client.query(
            `INSERT INTO crm_customers (restaurant_id, name, phone, email, total_visits, notes)
             VALUES ($1, $2, $3, $4, 0, 'Joined via queue') RETURNING id`,
            [settings.restaurant_id, contact_name || null, contact_phone || null, contact_email || null]
          );
          crmCustomerId = newCrm.rows[0].id;
        }
      }

      const entry = await client.query(
        `INSERT INTO queue_entries
           (restaurant_id, queue_number, pax, pax_band_label,
            group_letter, group_number, contact_name, contact_phone, contact_email, crm_customer_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          settings.restaurant_id, queueNumber, pax, paxBandLabel,
          groupLetter, groupNumber,
          contact_name || null, contact_phone || null, contact_email || null, crmCustomerId,
        ]
      );

      const aheadRes = await client.query(
        `SELECT COUNT(*) AS ahead FROM queue_entries
         WHERE restaurant_id = $1 AND status = 'waiting'
           AND group_letter = $2 AND group_number < $3`,
        [settings.restaurant_id, groupLetter, groupNumber]
      );

      await client.query("COMMIT");
      res.status(201).json({
        entry: entry.rows[0],
        group_letter: groupLetter,
        group_label: groupLabel,
        group_number: groupNumber,
        display_number: groupLetter + String(groupNumber).padStart(3, "0"),
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
   ENTRY STATUS (public)
────────────────────────────────────────────────────────────── */

router.get("/queue/entry/:entryId", async (req, res) => {
  try {
    const { entryId } = req.params;
    const entryRes = await pool.query(`SELECT * FROM queue_entries WHERE id = $1`, [entryId]);
    if ((entryRes.rowCount ?? 0) === 0) return res.status(404).json({ error: "Entry not found" });
    const entry = entryRes.rows[0];

    const aheadRes = await pool.query(
      `SELECT COUNT(*) AS ahead FROM queue_entries
       WHERE restaurant_id = $1 AND status = 'waiting'
         AND group_letter = $2 AND group_number < $3`,
      [entry.restaurant_id, entry.group_letter, entry.group_number]
    );
    const calledRes = await pool.query(
      `SELECT group_number FROM queue_entries
       WHERE restaurant_id = $1 AND status = 'called'
         AND group_letter = $2
         AND created_at > NOW() - INTERVAL '8 hours'
       ORDER BY called_at DESC NULLS LAST LIMIT 1`,
      [entry.restaurant_id, entry.group_letter]
    );
    const currentCalled = calledRes.rows.length > 0 && entry.group_letter
      ? entry.group_letter + String(calledRes.rows[0].group_number).padStart(3, "0")
      : null;

    res.json({
      entry,
      display_number: entry.group_letter
        ? entry.group_letter + String(entry.group_number).padStart(3, "0")
        : "#" + entry.queue_number,
      groups_ahead: parseInt(aheadRes.rows[0].ahead, 10),
      current_called: currentCalled,
    });
  } catch (err) {
    console.error("[Queue] GET entry:", err);
    res.status(500).json({ error: "Failed to fetch entry" });
  }
});

/* ──────────────────────────────────────────────────────────────
   CANCEL (customer)
────────────────────────────────────────────────────────────── */

router.post("/queue/entry/:entryId/cancel", async (req, res) => {
  try {
    const { entryId } = req.params;
    const result = await pool.query(
      `UPDATE queue_entries SET status = 'cancelled'
       WHERE id = $1 AND status IN ('waiting','called') RETURNING *`,
      [entryId]
    );
    if ((result.rowCount ?? 0) === 0) return res.status(400).json({ error: "Cannot cancel entry" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[Queue] cancel:", err);
    res.status(500).json({ error: "Failed to cancel" });
  }
});

/* ──────────────────────────────────────────────────────────────
   LINK TABLE (customer scans table QR → attaches order)
────────────────────────────────────────────────────────────── */

router.post("/queue/entry/:entryId/link-table", async (req, res) => {
  try {
    const { entryId } = req.params;
    const { qr_token, pre_order_items } = req.body;
    if (!qr_token) return res.status(400).json({ error: "qr_token required" });

    const entryRes = await pool.query(`SELECT * FROM queue_entries WHERE id = $1`, [entryId]);
    if ((entryRes.rowCount ?? 0) === 0) return res.status(404).json({ error: "Queue entry not found" });
    const entry = entryRes.rows[0];
    if (entry.status === "seated" || entry.linked_table_unit_id) return res.status(400).json({ error: "Entry already seated" });

    const unitRes = await pool.query(
      `SELECT tu.id AS table_unit_id, tu.display_name, t.id AS table_id, t.restaurant_id
       FROM table_units tu JOIN tables t ON t.id = tu.table_id WHERE tu.qr_token = $1`,
      [qr_token]
    );
    if ((unitRes.rowCount ?? 0) === 0) return res.status(404).json({ error: "Invalid table QR" });
    const unit = unitRes.rows[0];
    if (unit.restaurant_id !== entry.restaurant_id) return res.status(403).json({ error: "Table belongs to a different restaurant" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existingSession = await client.query(
        `SELECT id FROM table_sessions WHERE table_unit_id = $1 AND ended_at IS NULL`,
        [unit.table_unit_id]
      );
      let sessionId: number;
      if ((existingSession.rowCount ?? 0) > 0) {
        sessionId = existingSession.rows[0].id;
      } else {
        const sessionRes = await client.query(
          `INSERT INTO table_sessions (table_unit_id, restaurant_id, pax) VALUES ($1,$2,$3) RETURNING id`,
          [unit.table_unit_id, entry.restaurant_id, entry.pax]
        );
        sessionId = sessionRes.rows[0].id;
      }

      let orderId: number | null = null;
      if (Array.isArray(pre_order_items) && pre_order_items.length > 0) {
        const existingOrder = await client.query(
          `SELECT id FROM orders WHERE session_id = $1 AND status <> 'completed' LIMIT 1`,
          [sessionId]
        );
        if ((existingOrder.rowCount ?? 0) > 0) {
          orderId = existingOrder.rows[0].id;
        } else {
          const orderRes = await client.query(
            `INSERT INTO orders (session_id, restaurant_id, is_takeaway, placed_by) VALUES ($1,$2,false,'queue') RETURNING id`,
            [sessionId, entry.restaurant_id]
          );
          orderId = orderRes.rows[0].id;
        }
        for (const item of pre_order_items) {
          const itemRes = await client.query(
            `SELECT price_cents, name, name_zh FROM menu_items WHERE id = $1`,
            [item.menu_item_id]
          );
          if ((itemRes.rowCount ?? 0) === 0) continue;
          const menuItem = itemRes.rows[0];
          let priceCents = menuItem.price_cents;
          let variantLabel: string | null = null;
          if (item.variant_id) {
            const varRes = await client.query(
              `SELECT price_cents, label FROM item_variants WHERE id = $1`,
              [item.variant_id]
            );
            if ((varRes.rowCount ?? 0) > 0) { priceCents = varRes.rows[0].price_cents; variantLabel = varRes.rows[0].label; }
          }
          await client.query(
            `INSERT INTO order_items (order_id, menu_item_id, quantity, price_cents, snapshot_name, snapshot_name_zh, variant_id, variant_label)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [orderId, item.menu_item_id, Math.max(1, parseInt(item.quantity, 10) || 1), priceCents,
             menuItem.name, menuItem.name_zh || null, item.variant_id || null, variantLabel]
          );
        }
      }
      await client.query(
        `UPDATE queue_entries SET status='seated', seated_at=NOW(), linked_table_unit_id=$1, pre_order_session_id=$2 WHERE id=$3`,
        [unit.table_unit_id, sessionId, entryId]
      );
      await client.query("COMMIT");
      res.json({ session_id: sessionId, order_id: orderId, table_name: unit.display_name, table_unit_id: unit.table_unit_id });
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
   ADMIN: LIST, CALL-NEXT, CALL, SEAT, REMOVE, CLEAR
────────────────────────────────────────────────────────────── */

// GET /restaurants/:restaurantId/queue — admin list
router.get("/restaurants/:restaurantId/queue", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { status } = req.query as { status?: string };
    const statuses = (status || "waiting,called").split(",").map(s => s.trim()).filter(Boolean);
    const result = await pool.query(
      `SELECT * FROM queue_entries
       WHERE restaurant_id = $1 AND status = ANY($2::text[])
         AND created_at > NOW() - INTERVAL '8 hours'
       ORDER BY group_letter ASC NULLS LAST, group_number ASC NULLS LAST, queue_number ASC`,
      [restaurantId, statuses]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[Queue] admin list:", err);
    res.status(500).json({ error: "Failed to list queue" });
  }
});

// POST /restaurants/:restaurantId/queue/call-next/:groupLetter — call next in group
router.post("/restaurants/:restaurantId/queue/call-next/:groupLetter", async (req, res) => {
  try {
    const { restaurantId, groupLetter } = req.params;
    const result = await pool.query(
      `UPDATE queue_entries SET status = 'called', called_at = NOW()
       WHERE id = (
         SELECT id FROM queue_entries
         WHERE restaurant_id = $1 AND group_letter = $2 AND status = 'waiting'
           AND created_at > NOW() - INTERVAL '8 hours'
         ORDER BY group_number ASC NULLS LAST, queue_number ASC LIMIT 1
       ) RETURNING *`,
      [restaurantId, groupLetter.toUpperCase()]
    );
    if ((result.rowCount ?? 0) === 0) return res.status(400).json({ error: "No waiting entries in this group" });
    const entry = result.rows[0];
    res.json({
      entry,
      display_number: entry.group_letter + String(entry.group_number).padStart(3, "0"),
    });
  } catch (err) {
    console.error("[Queue] call-next:", err);
    res.status(500).json({ error: "Failed to call next" });
  }
});

// POST /restaurants/:restaurantId/queue/:entryId/call — call specific entry
router.post("/restaurants/:restaurantId/queue/:entryId/call", async (req, res) => {
  try {
    const { entryId } = req.params;
    const result = await pool.query(
      `UPDATE queue_entries SET status = 'called', called_at = NOW()
       WHERE id = $1 AND status = 'waiting' RETURNING *`,
      [entryId]
    );
    if ((result.rowCount ?? 0) === 0) return res.status(400).json({ error: "Cannot call entry (not waiting)" });
    const entry = result.rows[0];
    res.json({
      entry,
      display_number: entry.group_letter
        ? entry.group_letter + String(entry.group_number).padStart(3, "0")
        : "#" + entry.queue_number,
    });
  } catch (err) {
    console.error("[Queue] call:", err);
    res.status(500).json({ error: "Failed to call entry" });
  }
});

// POST /restaurants/:restaurantId/queue/:entryId/seat
router.post("/restaurants/:restaurantId/queue/:entryId/seat", async (req, res) => {
  try {
    const { entryId } = req.params;
    const result = await pool.query(
      `UPDATE queue_entries SET status = 'seated', seated_at = NOW()
       WHERE id = $1 AND status IN ('waiting','called') RETURNING *`,
      [entryId]
    );
    if ((result.rowCount ?? 0) === 0) return res.status(400).json({ error: "Cannot seat entry" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[Queue] seat:", err);
    res.status(500).json({ error: "Failed to seat entry" });
  }
});

// DELETE /restaurants/:restaurantId/queue/:entryId — cancel single entry
router.delete("/restaurants/:restaurantId/queue/:entryId", async (req, res) => {
  try {
    const { entryId, restaurantId } = req.params;
    await pool.query(
      `UPDATE queue_entries SET status = 'cancelled' WHERE id = $1 AND restaurant_id = $2`,
      [entryId, restaurantId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[Queue] delete:", err);
    res.status(500).json({ error: "Failed to remove entry" });
  }
});

// DELETE /restaurants/:restaurantId/queue — clear entire active queue
router.delete("/restaurants/:restaurantId/queue", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const result = await pool.query(
      `UPDATE queue_entries SET status = 'cancelled'
       WHERE restaurant_id = $1 AND status IN ('waiting','called')
         AND created_at > NOW() - INTERVAL '8 hours' RETURNING id`,
      [restaurantId]
    );
    res.json({ cleared: result.rowCount ?? 0 });
  } catch (err) {
    console.error("[Queue] clear:", err);
    res.status(500).json({ error: "Failed to clear queue" });
  }
});

export default router;
