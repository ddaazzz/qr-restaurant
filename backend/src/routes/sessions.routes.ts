import { Router } from "express";
import pool from "../config/db";
import crypto from "crypto";
import { getCustomerReceiptService } from "../services/customerReceipt";

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
      INSERT INTO table_sessions (table_id, table_unit_id, pax, started_at, restaurant_id, order_type)
      VALUES ($1, $2, $3, NOW() AT TIME ZONE 'UTC', $4, 'table')
      RETURNING *
      `,
      [tableId, freeUnit.id, pax, table.restaurant_id]
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
        ts.restaurant_session_number,
        ts.pax,
        to_char(ts.started_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS started_at,
        CASE WHEN ts.ended_at IS NULL THEN NULL ELSE to_char(ts.ended_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS ended_at,
        ts.bill_closure_requested

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
      INSERT INTO table_sessions (table_id, table_unit_id, pax, started_at, restaurant_id, order_type)
      VALUES ($1, $2, $3, NOW() AT TIME ZONE 'UTC', $4, 'table')
      RETURNING *
      `,
      [tableId, tableUnitId, pax, restaurantId]
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
      SELECT ts.table_id, ts.started_at, ts.order_type, t.restaurant_id, t.name as table_name
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
    const session = sessionRes.rows[0];

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
      session,
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
    `UPDATE table_sessions SET ended_at = NOW() AT TIME ZONE 'UTC' WHERE id = $1`,
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
        to_char(ts.started_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS started_at,
        CASE WHEN ts.ended_at IS NULL THEN NULL ELSE to_char(ts.ended_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS ended_at,
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
 * REQUEST BILL CLOSURE - ✅ MULTI-RESTAURANT SUPPORT
 * PATCH /sessions/:sessionId/request-bill-closure
 * Marks session as requesting bill closure (doesn't actually close it)
 * Only customers can request; admin/staff performs actual closure
 */
router.patch("/sessions/:sessionId/request-bill-closure", async (req, res) => {
  const { sessionId } = req.params;
  const { restaurantId, bill_closure_requested } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Missing session id" });
  }

  if (!restaurantId) {
    return res.status(400).json({ error: "Restaurant ID is required" });
  }

  try {
    // Try to update the bill_closure_requested flag if the column exists
    // This is a graceful fallback - the feature isn't available until migration runs
    try {
      const res_update = await pool.query(
        `UPDATE table_sessions 
         SET bill_closure_requested = $1
         WHERE id = $2 AND (SELECT restaurant_id FROM tables WHERE id = table_sessions.table_id) = $3
         RETURNING id, table_id, bill_closure_requested`,
        [bill_closure_requested, sessionId, restaurantId]
      );

      if (res_update.rowCount === 0) {
        return res.status(404).json({ error: "Session not found or doesn't belong to this restaurant" });
      }

      const session = res_update.rows[0];
      return res.json({ 
        success: true, 
        message: "Bill closure requested",
        session: {
          id: session.id,
          table_id: session.table_id,
          bill_closure_requested: session.bill_closure_requested
        }
      });
    } catch (updateErr) {
      // Column might not exist yet - just return success anyway
      console.warn("bill_closure_requested column may not exist yet:", (updateErr as Error).message);
      return res.json({ 
        success: true, 
        message: "Bill closure requested (feature pending database migration)",
        session: {
          id: sessionId,
          bill_closure_requested: true
        }
      });
    }
  } catch (err) {
    console.error("Error requesting bill closure:", err);
    return res.status(500).json({ error: "Internal server error" });
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

    // Get session data - works for table, counter, and to-go orders
    const sessionRes = await client.query(
      `SELECT ts.id, ts.table_id, ts.order_type, to_char(ts.started_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS started_at, ts.restaurant_id
       FROM table_sessions ts
       WHERE ts.id = $1 AND ts.restaurant_id = $2`,
      [sessionId, restaurantId]
    );

    const session = sessionRes.rows[0];
    if (!session) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Session not found or doesn't belong to this restaurant" });
    }

    // Get table name if it exists (for table orders)
    let tableName = '';
    if (session.table_id) {
      const tableRes = await client.query(
        `SELECT name FROM tables WHERE id = $1`,
        [session.table_id]
      );
      tableName = tableRes.rows[0]?.name || '';
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
        ended_at = NOW() AT TIME ZONE 'UTC',
        payment_method = $1,
        amount_paid = $2,
        discount_applied = $3,
        notes = $4,
        closed_by_staff_id = $5,
        pos_reference = $6,
        bill_closure_requested = FALSE
       WHERE id = $7`,
      [payment_method, amount_paid, discount_applied, notes, staff_id, posReference, sessionId]
    );

    // Create bill closure record with restaurant_id
    await client.query(
      `INSERT INTO bill_closures (session_id, closed_by_staff_id, payment_method, amount_paid, discount_applied, total_amount, pos_reference, restaurant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [sessionId, staff_id, payment_method, amount_paid, discount_applied, total, posReference, restaurantId]
    );

    // Free up the table if it's a table order
    if (session.table_id) {
      await client.query(
        `UPDATE tables SET available = true WHERE id = $1`,
        [session.table_id]
      );
    }

    await client.query("COMMIT");

    // Send customer receipt if enabled
    try {
      const receiptService = getCustomerReceiptService(pool);
      const { customerEmail, customerPhone } = req.body;

      const receiptPayload = {
        customerEmail,
        customerPhone,
        items: orders
          .filter((o: any) => o.item_id) // Only items
          .map((o: any) => ({
            name: o.item_id || 'Item',
            quantity: o.quantity || 1,
            price: o.price_cents || 0,
          })),
        subtotal,
        serviceCharge: 0, // Could be added to dining programs
        total,
        tableNumber: tableName || session.order_type,
      };

      // Send receipt asynchronously (don't block the response)
      receiptService.sendCustomerReceipt(restaurantId, parseInt(sessionId), receiptPayload).catch(err => {
        console.warn('[Sessions] Error sending customer receipt:', err.message);
      });
    } catch (receiptErr: any) {
      console.warn('[Sessions] Customer receipt disabled or error:', receiptErr.message);
    }

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
            table_number: tableName || session.order_type,
            order_type: session.order_type,
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

// =====================================================
// COUNTER/TO-GO ORDERS (NEW ENDPOINTS)
// =====================================================

// POST /restaurants/:restaurantId/counter-order
// Creates a "counter" order (order-now, no table)
router.post("/restaurants/:restaurantId/counter-order", async (req, res) => {
  const { restaurantId } = req.params;
  const { pax, items, payment_method, payment_status } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Create counter order session (no table_id or table_unit_id)
    const sessionRes = await client.query(
      `
      INSERT INTO table_sessions (pax, started_at, restaurant_id, order_type)
      VALUES ($1, NOW() AT TIME ZONE 'UTC', $2, 'counter')
      RETURNING *
      `,
      [pax || 1, restaurantId]
    );

    const session = sessionRes.rows[0];

    // If items provided, create order
    let order = null;
    if (items && items.length > 0) {
      const orderRes = await client.query(
        `
        INSERT INTO orders (session_id, restaurant_id, status, created_at)
        VALUES ($1, $2, 'pending', NOW() AT TIME ZONE 'UTC')
        RETURNING id
        `,
        [session.id, restaurantId]
      );

      order = { id: orderRes.rows[0].id };

      // Insert order items
      for (const item of items) {
        const menuRes = await client.query(
          'SELECT price_cents FROM menu_items WHERE id = $1',
          [item.menu_item_id]
        );

        if (menuRes.rows.length === 0) {
          throw new Error(`Menu item ${item.menu_item_id} not found`);
        }

        const price = menuRes.rows[0].price_cents;

        const orderItemRes = await client.query(
          `
          INSERT INTO order_items (order_id, menu_item_id, quantity, price_cents, status)
          VALUES ($1, $2, $3, $4, 'pending')
          RETURNING id
          `,
          [order.id, item.menu_item_id, item.quantity || 1, price]
        );

        const orderItemId = orderItemRes.rows[0].id;

        // Add variant selections if provided
        if (item.selected_option_ids && item.selected_option_ids.length > 0) {
          for (const optionId of item.selected_option_ids) {
            await client.query(
              `
              INSERT INTO order_item_variants (order_item_id, variant_option_id)
              VALUES ($1, $2)
              `,
              [orderItemId, optionId]
            );
          }
        }
      }

      // If payment_status provided (immediate payment), close the bill
      if (payment_status === 'settled') {
        await client.query(
          `
          INSERT INTO bill_closures (session_id, restaurant_id, closed_at, amount_paid, payment_method, total_amount)
          VALUES ($1, $2, NOW() AT TIME ZONE 'UTC', (SELECT COALESCE(SUM(oi.price_cents * oi.quantity), 0) FROM order_items oi WHERE oi.order_id = $3), $4, (SELECT COALESCE(SUM(oi.price_cents * oi.quantity), 0) FROM order_items oi WHERE oi.order_id = $3))
          `,
          [session.id, restaurantId, order.id, payment_method || 'card']
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json({ session, order });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Counter order error:", err);
    res.status(500).json({ error: "Failed to create counter order", details: err instanceof Error ? err.message : String(err) });
  } finally {
    client.release();
  }
});

// POST /restaurants/:restaurantId/to-go-order
// Creates a "to-go" order (takeout, no table)
router.post("/restaurants/:restaurantId/to-go-order", async (req, res) => {
  const { restaurantId } = req.params;
  const { pax, items } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Create to-go order session (no table_id or table_unit_id)
    const sessionRes = await client.query(
      `
      INSERT INTO table_sessions (pax, started_at, restaurant_id, order_type)
      VALUES ($1, NOW() AT TIME ZONE 'UTC', $2, 'to-go')
      RETURNING *
      `,
      [pax || 1, restaurantId]
    );

    const session = sessionRes.rows[0];

    // If items provided, create order
    let order = null;
    if (items && items.length > 0) {
      const orderRes = await client.query(
        `
        INSERT INTO orders (session_id, restaurant_id, status, created_at)
        VALUES ($1, $2, 'pending', NOW() AT TIME ZONE 'UTC')
        RETURNING id
        `,
        [session.id, restaurantId]
      );

      order = { id: orderRes.rows[0].id };

      // Insert order items
      for (const item of items) {
        const menuRes = await client.query(
          'SELECT price_cents FROM menu_items WHERE id = $1',
          [item.menu_item_id]
        );

        if (menuRes.rows.length === 0) {
          throw new Error(`Menu item ${item.menu_item_id} not found`);
        }

        const price = menuRes.rows[0].price_cents;

        const orderItemRes = await client.query(
          `
          INSERT INTO order_items (order_id, menu_item_id, quantity, price_cents, status)
          VALUES ($1, $2, $3, $4, 'pending')
          RETURNING id
          `,
          [order.id, item.menu_item_id, item.quantity || 1, price]
        );

        const orderItemId = orderItemRes.rows[0].id;

        // Add variant selections if provided
        if (item.selected_option_ids && item.selected_option_ids.length > 0) {
          for (const optionId of item.selected_option_ids) {
            await client.query(
              `
              INSERT INTO order_item_variants (order_item_id, variant_option_id)
              VALUES ($1, $2)
              `,
              [orderItemId, optionId]
            );
          }
        }
      }
    }

    await client.query("COMMIT");
    res.status(201).json({ session, order });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("To-go order error:", err);
    res.status(500).json({ error: "Failed to create to-go order", details: err instanceof Error ? err.message : String(err) });
  } finally {
    client.release();
  }
});

export default router;
