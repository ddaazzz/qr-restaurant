import { Router } from "express";
import pool from "../config/db";
import crypto from "crypto";

const router = Router();

// POST /tables/:tableId/sessions
router.post("/tables/:tableId/sessions", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { tableId } = req.params;
    const { pax } = req.body;

    if (!pax || pax <= 0) {
      return res.status(400).json({ error: "Invalid pax" });
    }

    // 1️⃣ Load table with restaurant info
    const tableRes = await client.query(
      `SELECT t.id, t.seat_count, t.restaurant_id FROM tables t WHERE t.id = $1`,
      [tableId]
    );
    const table = tableRes.rows[0];
    if (!table) throw new Error("Table not found");

    // 2️⃣ Get restaurant QR preference
    const restaurantRes = await client.query(
      `SELECT regenerate_qr_per_session FROM restaurants WHERE id = $1`,
      [table.restaurant_id]
    );
    const restaurantSettings = restaurantRes.rows[0];
    const shouldRegenerateQR = restaurantSettings?.regenerate_qr_per_session !== false;

    // 3️⃣ Find all units for table
    const unitsRes = await client.query(
      `SELECT id FROM table_units WHERE table_id = $1 ORDER BY id`,
      [tableId]
    );

    // 4️⃣ Find used seats + used units
    const activeRes = await client.query(
      `
      SELECT table_unit_id, pax
      FROM table_sessions
      WHERE table_id = $1
        AND ended_at IS NULL
      `,
      [tableId]
    );

    const usedSeats = activeRes.rows.reduce(
      (s, r) => s + Number(r.pax),
      0
    );

    const remaining = table.seat_count - usedSeats;
    if (pax > remaining) {
      return res.status(400).json({ error: "Not enough seats" });
    }

    const usedUnitIds = activeRes.rows.map(r => r.table_unit_id);
    const freeUnit = unitsRes.rows.find(
      u => !usedUnitIds.includes(u.id)
    );

    if (!freeUnit) {
      return res.status(400).json({ error: "No free table units" });
    }

    // 5️⃣ Fetch the current QR token for the unit
    const unitRes = await client.query(
      `SELECT qr_token FROM table_units WHERE id = $1`,
      [freeUnit.id]
    );
    const currentUnit = unitRes.rows[0];

    // 6️⃣ Handle QR token based on mode:
    // Dynamic mode (regenerate_qr_per_session = true): Generate NEW QR token for each session
    // Static mode (regenerate_qr_per_session = false): Keep existing QR token (already created at table creation)
    if (shouldRegenerateQR) {
      // Dynamic mode: generate new QR for this session
      const newQRToken = crypto.randomBytes(16).toString("hex");
      await client.query(
        `UPDATE table_units SET qr_token = $1 WHERE id = $2`,
        [newQRToken, freeUnit.id]
      );
    }
    // Static mode: QR token was already generated at table creation, just use it

    // 7️⃣ Create session WITH unit
    const insertRes = await client.query(
      `
      INSERT INTO table_sessions (table_id, table_unit_id, pax, started_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
      `,
      [tableId, freeUnit.id, pax]
    );

    await client.query("COMMIT");
    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to start session" });
  } finally {
    client.release();
  }
});

router.patch("/table-sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { pax } = req.body;

    if (!pax || pax <= 0) return res.status(400).json({ error: "Invalid pax" });

    const result = await pool.query(
      `UPDATE table_sessions SET pax=$1 WHERE id=$2 RETURNING *`,
      [pax, sessionId]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ error: "Session not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update session" });
  }
});

// GET active sessions with tables and pax
router.get("/restaurants/:restaurantId/table-state", async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const result = await pool.query(
      `
      SELECT
        t.id            AS table_id,
        t.name          AS table_name,
        t.seat_count,
        t.category_id,

        tu.id           AS table_unit_id,
        tu.unit_code,
        tu.display_name AS unit_name,
        tu.qr_token,

        ts.id           AS session_id,
        ts.pax,
        ts.started_at,
        ts.ended_at

      FROM tables t
      JOIN table_units tu
        ON tu.table_id = t.id
      LEFT JOIN table_sessions ts
        ON ts.table_unit_id = tu.id
       AND ts.ended_at IS NULL

      WHERE t.restaurant_id = $1
      ORDER BY t.name, tu.unit_code
      `,
      [restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load table state" });
  }
});

// Start Sessions
router.post("/table-units/:tableUnitId/sessions", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { tableUnitId } = req.params;
    const { pax } = req.body;

    if (!pax || pax <= 0) {
      return res.status(400).json({ error: "Invalid pax" });
    }

    const unitRes = await client.query(
      `
      SELECT tu.table_id, t.seat_count, t.restaurant_id
      FROM table_units tu
      JOIN tables t ON t.id = tu.table_id
      WHERE tu.id = $1
      `,
      [tableUnitId]
    );

    if (unitRes.rowCount === 0) {
      return res.status(404).json({ error: "Table unit not found" });
    }

    const tableId = unitRes.rows[0].table_id;
    const restaurantId = unitRes.rows[0].restaurant_id;

    // Get restaurant QR preference
    const restaurantRes = await client.query(
      `SELECT regenerate_qr_per_session FROM restaurants WHERE id = $1`,
      [restaurantId]
    );
    const restaurantSettings = restaurantRes.rows[0];
    const shouldRegenerateQR = restaurantSettings?.regenerate_qr_per_session !== false;

    // Handle QR token based on mode:
    // Dynamic mode (regenerate_qr_per_session = true): Generate NEW QR token for each session
    // Static mode (regenerate_qr_per_session = false): Keep existing QR token (already created at table creation)
    if (shouldRegenerateQR) {
      // Dynamic mode: generate new QR for this session
      const newQRToken = crypto.randomBytes(16).toString("hex");
      await client.query(
        `UPDATE table_units SET qr_token = $1 WHERE id = $2`,
        [newQRToken, tableUnitId]
      );
    }
    // Static mode: QR token was already generated at table creation, just use it

    const insert = await client.query(
      `
      INSERT INTO table_sessions (table_id, table_unit_id, pax, started_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
      `,
      [tableId, tableUnitId, pax]
    );

    await client.query("COMMIT");
    res.status(201).json(insert.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to start session" });
  } finally {
    client.release();
  }
});

/**
 * GET /sessions/:sessionId/bill
 * Returns aggregated bill for a session
 */
router.get("/sessions/:sessionId/bill", async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  if (!sessionId) {
    return res.status(400).json({ error: "Invalid session id" });
  }

  try {
    // Get session details to find restaurant_id
    const sessionRes = await pool.query(
      `
      SELECT ts.table_id, t.restaurant_id
      FROM table_sessions ts
      JOIN tables t ON t.id = ts.table_id
      WHERE ts.id = $1
      `,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    const restaurantId = sessionRes.rows[0].restaurant_id;

    // Get restaurant info
    const restaurantRes = await pool.query(
      `
      SELECT id, name, address, phone, logo_url, service_charge_percent
      FROM restaurants
      WHERE id = $1
      `,
      [restaurantId]
    );

    const restaurant = restaurantRes.rows[0];

    // Get order items
    const { rows } = await pool.query(
      `
      SELECT
        mi.name,
        oi.quantity,
        oi.price_cents
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.session_id = $1
        AND o.status <> 'cancelled'
      `,
      [sessionId]
    );

    const subtotal_cents = rows.reduce(
      (sum, r) => sum + r.quantity * r.price_cents,
      0
    );

    const serviceChargePercent = restaurant?.service_charge_percent || 0;
    const service_charge_cents = Math.round(subtotal_cents * serviceChargePercent / 100);
    const total_cents = subtotal_cents + service_charge_cents;

    res.json({
      restaurant,
      items: rows,
      subtotal_cents,
      service_charge_cents,
      total_cents
    });
  } catch (err) {
    console.error("Print bill failed", err);
    res.status(500).json({ error: "Failed to generate bill" });
  }
});

/**
 * END session (staff only)
 */
router.post("/table-sessions/:sessionId/end", async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({ error: "Missing session id" });
  }

  await pool.query(
    `UPDATE table_sessions SET ended_at = NOW() WHERE id = $1`,
    [sessionId]
  );

  res.json({ success: true });
});

// GET all sessions for a restaurant (for reports)
router.get("/restaurants/:restaurantId/sessions", async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const result = await pool.query(
      `
      SELECT
        ts.id AS session_id,
        ts.started_at,
        ts.ended_at,
        ts.pax,
        t.id AS table_id,
        t.name AS table_name,
        t.restaurant_id
      FROM table_sessions ts
      JOIN tables t ON t.id = ts.table_id
      WHERE t.restaurant_id = $1
      ORDER BY ts.started_at DESC
      `,
      [restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load sessions" });
  }
});

/**
 * CLOSE BILL - ✅ MULTI-RESTAURANT SUPPORT
 * POST /sessions/:sessionId/close-bill
 * Supports POS integration via webhooks
 */
router.post("/sessions/:sessionId/close-bill", async (req, res) => {
  const { sessionId } = req.params;
  const { 
    payment_method = 'cash', 
    amount_paid = 0, 
    discount_applied = 0, 
    notes = '',
    send_to_pos = false,
    pos_system = null,
    staff_id = null,
    restaurantId
  } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Missing session id" });
  }

  if (!restaurantId) {
    return res.status(400).json({ error: "Restaurant ID is required" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get session and bill data - VALIDATE RESTAURANT_ID
    const sessionRes = await client.query(
      `SELECT ts.id, ts.table_id, t.name as table_name, ts.started_at, 
              t.restaurant_id FROM table_sessions ts
       JOIN tables t ON t.id = ts.table_id
       WHERE ts.id = $1 AND t.restaurant_id = $2`,
      [sessionId, restaurantId]
    );

    const session = sessionRes.rows[0];
    if (!session) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Session not found or doesn't belong to this restaurant" });
    }

    // Get all orders with items for this session
    const ordersRes = await client.query(
      `SELECT o.id, oi.id as item_id, oi.quantity, oi.price_cents
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.session_id = $1 AND o.status <> 'cancelled'
       AND (oi.removed IS FALSE OR oi.removed IS NULL)`,
      [sessionId]
    );

    // Calculate totals from order items
    const orders = ordersRes.rows;
    let subtotal = 0;
    orders.forEach(item => {
      if (item.quantity && item.price_cents) {
        subtotal += item.quantity * item.price_cents;
      }
    });

    const total = subtotal - discount_applied;
    const posReference = `CHUIO-${Date.now()}-${sessionId}`;

    // Update session status
    await client.query(
      `UPDATE table_sessions SET 
        ended_at = NOW(),
        payment_method = $1,
        amount_paid = $2,
        discount_applied = $3,
        notes = $4,
        closed_by_staff_id = $5,
        pos_reference = $6
       WHERE id = $7`,
      [payment_method, amount_paid, discount_applied, notes, staff_id, posReference, sessionId]
    );

    // Free up the table
    await client.query(
      `UPDATE tables SET available = true WHERE id = $1`,
      [session.table_id]
    );

    await client.query("COMMIT");

    // Send to POS if requested
    let webhookSent = false;
    let webhookError = null;

    if (send_to_pos && pos_system) {
      try {
        // Get restaurant POS webhook URL from settings
        const settingsRes = await pool.query(
          `SELECT pos_webhook_url, pos_api_key FROM restaurants WHERE id = $1`,
          [session.restaurant_id]
        );

        const settings = settingsRes.rows[0];
        if (settings?.pos_webhook_url) {
          const billData = {
            external_id: posReference,
            session_id: sessionId,
            table_number: session.table_name,
            payment_method,
            amount_paid,
            discount_applied,
            subtotal,
            total,
            items: orders,
            timestamp: new Date().toISOString(),
            notes
          };

          // Send webhook
          const webhookRes = await fetch(settings.pos_webhook_url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${settings.pos_api_key}`,
              'X-Webhook-Signature': `chuio-v1=${posReference}`
            },
            body: JSON.stringify(billData)
          });

          webhookSent = webhookRes.ok;
          if (!webhookSent) {
            webhookError = `POS webhook failed: ${webhookRes.status}`;
            console.error(webhookError);
          }
        }
      } catch (err) {
        webhookError = err instanceof Error ? err.message : String(err);
        console.error("Error sending to POS:", err);
        // Don't fail the bill closure if webhook fails
      }
    }

    res.json({
      success: true,
      session_id: sessionId,
      pos_reference: posReference,
      total_cents: total,
      payment_method,
      closed_at: new Date().toISOString(),
      webhook_sent: webhookSent,
      webhook_error: webhookError
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error closing bill:", err);
    res.status(500).json({ error: "Failed to close bill" });
  } finally {
    client.release();
  }
});

export default router;
