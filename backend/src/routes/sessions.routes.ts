import { Router } from "express";
import pool from "../config/db";
import crypto from "crypto";
import { getCustomerReceiptService } from "../services/customerReceipt";
import * as paymentTerminalService from "../services/paymentTerminalService";
import { upsertCrmCustomer } from "../utils/upsertCrmCustomer";

const router = Router();

// POST /tables/:tableId/sessions
router.post("/tables/:tableId/sessions", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { tableId } = req.params;
    const { pax, booking_id, unit_ids, customer_name, customer_phone } = req.body;

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
      `SELECT regenerate_qr_per_session, qr_mode FROM restaurants WHERE id = $1`,
      [table.restaurant_id]
    );
    const restaurantSettings = restaurantRes.rows[0];
    const shouldRegenerateQR = restaurantSettings?.regenerate_qr_per_session !== false;
    const qrMode = restaurantSettings?.qr_mode || 'regenerate';

    // 3️⃣ Find all units for table
    const unitsRes = await client.query(
      `SELECT id, display_name FROM table_units WHERE table_id = $1 ORDER BY id`,
      [tableId]
    );

    // 4️⃣ Find used seats + used units
    const activeRes = await client.query(
      `
      SELECT id, table_unit_id, pax
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

    // Enforce static_table mode: only one session per table at a time
    if (qrMode === 'static_table' && activeRes.rows.length > 0) {
      // If a booking, link to existing session
      if (booking_id) {
        await client.query("ROLLBACK");
        const existingSessionId = activeRes.rows[0].id;
        await pool.query(
          `UPDATE bookings SET session_id = $1, updated_at = NOW() WHERE id = $2`,
          [existingSessionId, booking_id]
        );
        const linkedSession = await pool.query(
          `SELECT * FROM table_sessions WHERE id = $1`, [existingSessionId]
        );
        return res.status(200).json({ ...linkedSession.rows[0], linked: true });
      }
      return res.status(400).json({ error: "Static QR per table mode: only one session allowed per table. End the current session first." });
    }

    const remaining = table.seat_count - usedSeats;
    if (pax > remaining) {
      // If a booking_id was supplied and the table is full, auto-link the booking
      // to the existing active session (covers the case where the session was
      // started manually before the booking Start button was clicked).
      if (booking_id && activeRes.rows.length > 0) {
        await client.query("ROLLBACK");
        const existingSessionId = activeRes.rows[0].id;
        await pool.query(
          `UPDATE bookings SET session_id = $1, updated_at = NOW() WHERE id = $2`,
          [existingSessionId, booking_id]
        );
        const linkedSession = await pool.query(
          `SELECT * FROM table_sessions WHERE id = $1`, [existingSessionId]
        );
        return res.status(200).json({ ...linkedSession.rows[0], linked: true });
      }
      return res.status(400).json({ error: "Not enough seats" });
    }

    const usedUnitIds = activeRes.rows.map(r => r.table_unit_id);

    // For static_seat mode with unit_ids specified, validate the chosen seats
    let assignedUnit;
    if (qrMode === 'static_seat' && unit_ids && Array.isArray(unit_ids) && unit_ids.length > 0) {
      // Validate all specified units belong to this table and are free
      const tableUnitIds = unitsRes.rows.map(u => u.id);
      for (const uid of unit_ids) {
        if (!tableUnitIds.includes(uid)) {
          return res.status(400).json({ error: `Unit ${uid} does not belong to this table` });
        }
        if (usedUnitIds.includes(uid)) {
          const unitName = unitsRes.rows.find(u => u.id === uid)?.display_name || uid;
          return res.status(400).json({ error: `Seat ${unitName} is already occupied` });
        }
      }
      // Use the first specified unit as the primary session unit
      assignedUnit = unitsRes.rows.find(u => u.id === unit_ids[0]);
    } else {
      assignedUnit = unitsRes.rows.find(u => !usedUnitIds.includes(u.id));
    }

    if (!assignedUnit) {
      return res.status(400).json({ error: "No free table units" });
    }

    // 5️⃣ Fetch the current QR token for the unit
    const unitRes = await client.query(
      `SELECT qr_token FROM table_units WHERE id = $1`,
      [assignedUnit.id]
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
        [newQRToken, assignedUnit.id]
      );
    }
    // Static mode: QR token was already generated at table creation, just use it

    // Resolve customer info: explicit params > booking data > null
    let finalCustomerName = customer_name || null;
    let finalCustomerPhone = customer_phone || null;
    if (booking_id && (!finalCustomerName || !finalCustomerPhone)) {
      const bookingRes = await client.query(
        `SELECT guest_name, phone FROM bookings WHERE id = $1`,
        [booking_id]
      );
      if (bookingRes.rows.length > 0) {
        if (!finalCustomerName) finalCustomerName = bookingRes.rows[0].guest_name || null;
        if (!finalCustomerPhone) finalCustomerPhone = bookingRes.rows[0].phone || null;
      }
    }

    // 7️⃣ Create session WITH unit
    const insertRes = await client.query(
      `
      INSERT INTO table_sessions (table_id, table_unit_id, pax, started_at, restaurant_id, order_type, customer_name, customer_phone)
      VALUES ($1, $2, $3, NOW() AT TIME ZONE 'UTC', $4, 'table', $5, $6)
      RETURNING *
      `,
      [tableId, assignedUnit.id, pax, table.restaurant_id, finalCustomerName, finalCustomerPhone]
    );

    // Auto-create a blank order for this session
    const orderRes = await client.query(
      `INSERT INTO orders (session_id, restaurant_id) VALUES ($1, $2) RETURNING id, restaurant_order_number`,
      [insertRes.rows[0].id, table.restaurant_id]
    );
    console.log(`[Sessions] ✨ Auto-created order ${orderRes.rows[0].id} (restaurant #${orderRes.rows[0].restaurant_order_number}) for session ${insertRes.rows[0].id}`);

    await client.query("COMMIT");

    // If a booking_id was provided, link this session to the booking
    if (booking_id) {
      await pool.query(
        `UPDATE bookings SET session_id = $1, updated_at = NOW() WHERE id = $2`,
        [insertRes.rows[0].id, booking_id]
      );
    }

    res.status(201).json({ ...insertRes.rows[0], order_id: orderRes.rows[0].id, restaurant_order_number: orderRes.rows[0].restaurant_order_number });
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
    const { pax, restaurantId } = req.body;

    if (!pax || pax <= 0) return res.status(400).json({ error: "Invalid pax" });
    if (!restaurantId) return res.status(400).json({ error: "Restaurant ID is required" });

    // Verify session belongs to restaurant
    const sessionCheck = await pool.query(
      `SELECT id FROM table_sessions WHERE id = $1 AND restaurant_id = $2`,
      [sessionId, restaurantId]
    );

    if (sessionCheck.rowCount === 0) {
      return res.status(403).json({ error: "Session not found or doesn't belong to this restaurant" });
    }

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
        ts.bill_closure_requested,
        ts.call_staff_requested,

        o.id            AS order_id,
        o.restaurant_order_number,

        b.guest_name    AS booking_guest_name

      FROM tables t
      JOIN table_units tu
        ON tu.table_id = t.id
      LEFT JOIN table_sessions ts
        ON ts.table_unit_id = tu.id
       AND ts.ended_at IS NULL
      LEFT JOIN orders o
        ON o.session_id = ts.id
       AND o.status <> 'completed'
      LEFT JOIN bookings b
        ON b.session_id = ts.id

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

/**
 * GET /sessions/:sessionId
 * Returns session details (table, pax, started/ended, payment info)
 */
router.get("/sessions/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  try {
    const result = await pool.query(
      `SELECT ts.id, ts.pax, ts.restaurant_session_number,
              to_char(ts.started_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS started_at,
              CASE WHEN ts.ended_at IS NULL THEN NULL ELSE to_char(ts.ended_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS ended_at,
              ts.payment_method,
              t.name AS table_name, t.id AS table_id
       FROM table_sessions ts
       LEFT JOIN tables t ON ts.table_id = t.id
       WHERE ts.id = $1`,
      [sessionId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Session not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load session' });
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
      SELECT ts.table_id, ts.started_at, ts.order_type, ts.pax, t.restaurant_id, t.name as table_name
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
        oi.id,
        mi.name,
        oi.quantity,
        oi.price_cents,
        oi.is_addon,
        oi.parent_order_item_id
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.session_id = $1
        AND o.status <> 'cancelled'
      ORDER BY oi.parent_order_item_id ASC NULLS FIRST, oi.id ASC
      `,
      [sessionId]
    );

    // Group addon items under their parent items
    const mainItems: any[] = [];
    const itemsById: Record<number, any> = {};
    for (const row of rows) {
      const itemObj = { ...row, addons: [] as any[] };
      itemsById[row.id] = itemObj;
      if (!row.is_addon) {
        mainItems.push(itemObj);
      }
    }
    for (const row of rows) {
      if (row.is_addon && row.parent_order_item_id && itemsById[row.parent_order_item_id]) {
        itemsById[row.parent_order_item_id].addons.push({
          name: row.name,
          quantity: row.quantity,
          price_cents: row.price_cents,
          is_addon: true,
        });
      }
    }

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
      items: mainItems,
      subtotal_cents,
      service_charge_cents,
      total_cents
    });
  } catch (err) {
    console.error("Print bill failed", err);
    res.status(500).json({ error: "Failed to generate bill" });
  }
});

// NOTE: GET /sessions/:sessionId/orders is handled by orders.routes.ts (mounted first in app.ts).
// The duplicate handler was removed from here to avoid confusion.

/**
 * PATCH /table-sessions/:sessionId/move-table
 * Move an active session to a different (empty) table.
 * Body: { new_table_id: number }
 */
router.patch("/table-sessions/:sessionId/move-table", async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  const { new_table_id } = req.body;

  if (!sessionId || isNaN(sessionId)) return res.status(400).json({ error: "Invalid session ID" });
  if (!new_table_id) return res.status(400).json({ error: "new_table_id is required" });

  try {
    // Look up session and derive restaurant_id from its current table
    const sessionRes = await pool.query(
      `SELECT ts.id, ts.ended_at, t.restaurant_id
       FROM table_sessions ts
       JOIN tables t ON t.id = ts.table_id
       WHERE ts.id = $1`,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) return res.status(404).json({ error: "Session not found" });

    const session = sessionRes.rows[0];
    if (session.ended_at) return res.status(400).json({ error: "Session has already ended" });

    const restaurantId = session.restaurant_id;

    // Verify target table belongs to the same restaurant
    const targetRes = await pool.query(
      `SELECT id FROM tables WHERE id = $1 AND restaurant_id = $2`,
      [new_table_id, restaurantId]
    );
    if (targetRes.rowCount === 0) {
      return res.status(404).json({ error: "Target table not found" });
    }

    // Verify target table has no active sessions
    const occupiedRes = await pool.query(
      `SELECT id FROM table_sessions WHERE table_id = $1 AND ended_at IS NULL`,
      [new_table_id]
    );
    if ((occupiedRes.rowCount ?? 0) > 0) {
      return res.status(409).json({ error: "Target table already has an active session" });
    }

    // Move the session to the new table
    const result = await pool.query(
      `UPDATE table_sessions SET table_id = $1 WHERE id = $2 RETURNING id, table_id`,
      [new_table_id, sessionId]
    );

    res.json({ success: true, session: result.rows[0] });
  } catch (err) {
    console.error("[move-table]", err);
    res.status(500).json({ error: "Failed to move table" });
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

  // Close any pending orders and mark as unpaid (no payment was made)
  await pool.query(
    `UPDATE orders SET status = 'closed', payment_status = 'unpaid', payment_method = NULL
     WHERE session_id = $1 AND status IN ('pending', 'confirmed')`,
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
 * CALL STAFF — customer-triggered notification
 * PATCH /sessions/:sessionId/call-staff
 * Body: { restaurantId, call_staff_requested: boolean }
 */
router.patch("/sessions/:sessionId/call-staff", async (req, res) => {
  const { sessionId } = req.params;
  const { restaurantId, call_staff_requested } = req.body;

  if (!sessionId) return res.status(400).json({ error: "Missing session id" });
  if (!restaurantId) return res.status(400).json({ error: "Restaurant ID is required" });

  try {
    const result = await pool.query(
      `UPDATE table_sessions
         SET call_staff_requested = $1
         WHERE id = $2
         RETURNING id, table_id, call_staff_requested`,
      [call_staff_requested, sessionId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Session not found or access denied" });
    }

    const s = result.rows[0];
    return res.json({ success: true, session: { id: s.id, table_id: s.table_id, call_staff_requested: s.call_staff_requested } });
  } catch (err: any) {
    // Graceful fallback if column doesn't exist yet (before migration runs)
    if (err.message?.includes("column") && err.message?.includes("call_staff_requested")) {
      return res.json({ success: true, message: "pending migration" });
    }
    console.error("Error calling staff:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * CLOSE BILL - Cash & Credit Card only
 * POST /sessions/:sessionId/close-bill
 */
router.post("/sessions/:sessionId/close-bill", async (req, res) => {
  const { sessionId } = req.params;
  const { 
    payment_method = 'cash', 
    amount_paid = 0, 
    discount_applied = 0,
    service_charge = 0,
    notes = '',
    staff_id = null,
    restaurantId,
    kpay_reference_id = null,
    cp_vendor_ref = null,       // PA Offline sends this; alias for kpay_reference_id
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

    // Get session
    const sessionRes = await client.query(
      `SELECT id, table_id, order_type FROM table_sessions WHERE id = $1 AND restaurant_id = $2`,
      [sessionId, restaurantId]
    );
    if (sessionRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Session not found" });
    }
    const session = sessionRes.rows[0];

    // Get orders and calculate total
    const ordersRes = await client.query(
      `SELECT o.id, oi.id as item_id, oi.quantity, oi.price_cents
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.session_id = $1 AND o.status <> 'cancelled'
       AND (oi.removed IS FALSE OR oi.removed IS NULL)`,
      [sessionId]
    );

    const orders = ordersRes.rows;
    let subtotal = 0;
    orders.forEach(item => {
      if (item.quantity && item.price_cents) {
        subtotal += item.quantity * item.price_cents;
      }
    });

    const total = subtotal - discount_applied + service_charge;
    const posReference = `CHUIO-${Date.now()}-${sessionId}`;
    const finalAmountPaid = amount_paid || total;

    // Update session - CLOSE IT
    await client.query(
      `UPDATE table_sessions SET 
        ended_at = NOW() AT TIME ZONE 'UTC',
        payment_method = $1,
        amount_paid = $2,
        discount_applied = $3,
        notes = $4,
        closed_by_staff_id = $5
       WHERE id = $6`,
      [payment_method, finalAmountPaid, discount_applied, notes, staff_id, sessionId]
    );

    // Mark orders as completed
    await client.query(
      `UPDATE orders 
       SET payment_method = $1,
           status = 'completed',
           payment_status = 'paid'
       WHERE session_id = $2`,
      [payment_method, sessionId]
    );

    // If KPay: mark transaction as completed and store reference on orders
    if (payment_method === 'kpay' && kpay_reference_id) {
      await client.query(
        `UPDATE kpay_transactions
         SET status = 'completed', completed_at = NOW() AT TIME ZONE 'UTC'
         WHERE kpay_reference_id = $1 AND restaurant_id = $2`,
        [kpay_reference_id, restaurantId]
      );
      await client.query(
        `UPDATE orders SET chuio_order_reference = $1 WHERE session_id = $2`,
        [kpay_reference_id, sessionId]
      );
    }

    // If PA Offline: mark transaction as completed in its own table
    // Accept either kpay_reference_id or cp_vendor_ref (mobile sends cp_vendor_ref for PA Offline)
    const paOfflineRef = (payment_method === 'payment-asia-offline') ? (cp_vendor_ref || kpay_reference_id) : null;
    if (paOfflineRef) {
      // Resolve the order_id for this session so we can link it
      const paOrderRes = await client.query(
        `SELECT id FROM orders WHERE session_id = $1 AND restaurant_id = $2 ORDER BY created_at DESC LIMIT 1`,
        [sessionId, restaurantId]
      );
      const paOrderId = paOrderRes.rows[0]?.id ?? null;

      // Upsert so device-direct payments (that never went through /test endpoint) are also recorded
      await client.query(
        `INSERT INTO pa_offline_transactions
           (restaurant_id, session_id, order_id, pa_order_id, amount_cents, status, completed_at)
         VALUES ($1, $2, $3, $4, $5, 'completed', NOW() AT TIME ZONE 'UTC')
         ON CONFLICT DO NOTHING`,
        [restaurantId, sessionId, paOrderId, paOfflineRef, amount_paid || total]
      );
      const paDet = (req.body.pa_terminal_details as any) || {};
      // Also update if row already existed (and capture payment details sent from device)
      await client.query(
        `UPDATE pa_offline_transactions
         SET status = 'completed', completed_at = NOW() AT TIME ZONE 'UTC',
             order_id = COALESCE(order_id, $3), session_id = COALESCE(session_id, $2),
             payment_method = COALESCE($5, payment_method),
             provider = COALESCE($6, provider),
             provider_reference = COALESCE($7, provider_reference),
             request_reference = COALESCE($8, request_reference),
             pa_created_time = COALESCE($9::bigint, pa_created_time),
             pa_completed_time = COALESCE($10::bigint, pa_completed_time)
         WHERE pa_order_id = $1 AND restaurant_id = $4`,
        [paOfflineRef, sessionId, paOrderId, restaurantId,
         paDet.payment_method || null,
         paDet.provider || null,
         paDet.provider_reference || null,
         paDet.request_reference || null,
         paDet.pa_created_time || null,
         paDet.pa_completed_time || null]
      );
      await client.query(
        `UPDATE orders SET chuio_order_reference = $1 WHERE session_id = $2`,
        [paOfflineRef, sessionId]
      );
    }

    // Free up table
    if (session.table_id) {
      await client.query(
        `UPDATE tables SET available = true WHERE id = $1`,
        [session.table_id]
      );
    }

    // Mark linked bookings as completed (keep session_id so order history is still accessible)
    await client.query(
      `UPDATE bookings SET status = 'completed' WHERE session_id = $1 AND status = 'confirmed'`,
      [sessionId]
    );

    await client.query("COMMIT");

    // Fire-and-forget: upsert CRM customer and refresh their stats from this session
    pool.query(
      `SELECT customer_name, customer_phone, customer_email, restaurant_id
       FROM table_sessions WHERE id = $1`,
      [sessionId]
    ).then(async (sessionCustomer) => {
      const sc = sessionCustomer.rows[0];
      if (!sc || !sc.customer_name) return;

      // Ensure the customer record exists
      await upsertCrmCustomer({
        restaurantId: sc.restaurant_id,
        name:  sc.customer_name,
        phone: sc.customer_phone,
        email: sc.customer_email,
      });

      // Refresh total_visits, total_spent_cents and last_visit_at for this customer
      await pool.query(
        `UPDATE crm_customers c
         SET
           total_visits       = sub.visit_count,
           total_spent_cents  = sub.spent_cents,
           last_visit_at      = sub.last_visit,
           updated_at         = NOW()
         FROM (
           SELECT
             cc.id AS customer_id,
             COUNT(DISTINCT ts2.id)::int AS visit_count,
             COALESCE(SUM(oi.price_cents * oi.quantity) FILTER (WHERE oi.removed = false), 0) AS spent_cents,
             MAX(ts2.ended_at) AS last_visit
           FROM crm_customers cc
           JOIN table_sessions ts2 ON ts2.restaurant_id = cc.restaurant_id
             AND ts2.ended_at IS NOT NULL
             AND (
               (ts2.customer_phone IS NOT NULL AND ts2.customer_phone <> '' AND ts2.customer_phone = cc.phone)
               OR (ts2.customer_name IS NOT NULL AND ts2.customer_name = cc.name AND (cc.phone IS NULL OR cc.phone = ''))
             )
           JOIN orders o ON o.session_id = ts2.id AND o.restaurant_id = cc.restaurant_id
           LEFT JOIN order_items oi ON oi.order_id = o.id
           WHERE cc.restaurant_id = $1
             AND (
               (cc.phone IS NOT NULL AND cc.phone = $2)
               OR (cc.name = $3 AND (cc.phone IS NULL OR cc.phone = ''))
             )
           GROUP BY cc.id
         ) sub
         WHERE c.id = sub.customer_id`,
        [sc.restaurant_id, sc.customer_phone || null, sc.customer_name]
      );
    }).catch((err) => {
      console.warn("[CRM] close-bill stats update failed silently:", err.message);
    });

    // Success response
    res.json({
      success: true,
      session_id: sessionId,
      pos_reference: posReference,
      subtotal_cents: subtotal,
      discount_applied,
      service_charge,
      total_cents: total,
      payment_method,
      message: 'Bill closed successfully'
    });

    console.log(`[CloseBill] ✅ Bill closed for session ${sessionId} (${payment_method})`);

  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[CloseBill] ❌ Error:`, errorMessage);
    res.status(500).json({ error: "Failed to close bill", details: errorMessage });
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
  const { pax, items, payment_method, payment_status, placed_by_user_id } = req.body;

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
        INSERT INTO orders (session_id, restaurant_id, status, created_at, placed_by_user_id)
        VALUES ($1, $2, 'pending', NOW() AT TIME ZONE 'UTC', $3)
        RETURNING id
        `,
        [session.id, restaurantId, placed_by_user_id || null]
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

      // If payment_status provided (immediate payment), close the session and mark order complete
      if (payment_status === 'settled') {
        const totalRes = await client.query(
          `SELECT COALESCE(SUM(oi.price_cents * oi.quantity), 0) AS total FROM order_items oi WHERE oi.order_id = $1`,
          [order.id]
        );
        const total = totalRes.rows[0].total;
        await client.query(
          `UPDATE table_sessions SET ended_at = NOW() AT TIME ZONE 'UTC', payment_method = $1, amount_paid = $2 WHERE id = $3`,
          [payment_method || 'cash', total, session.id]
        );
        await client.query(
          `UPDATE orders SET status = 'completed', payment_method = $1, payment_status = 'paid' WHERE id = $2`,
          [payment_method || 'cash', order.id]
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
  const { pax, items, customer_name, customer_phone } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Create to-go order session (no table_id or table_unit_id)
    const sessionRes = await client.query(
      `
      INSERT INTO table_sessions (pax, started_at, restaurant_id, order_type, customer_name, customer_phone)
      VALUES ($1, NOW() AT TIME ZONE 'UTC', $2, 'to-go', $3, $4)
      RETURNING *
      `,
      [pax || 1, restaurantId, customer_name || null, customer_phone || null]
    );

    const session = sessionRes.rows[0];

    // If items provided, create order
    let order = null;
    if (items && items.length > 0) {
      const orderRes = await client.query(
        `
        INSERT INTO orders (session_id, restaurant_id, status, created_at)
        VALUES ($1, $2, 'pending', NOW() AT TIME ZONE 'UTC')
        RETURNING id, restaurant_order_number
        `,
        [session.id, restaurantId]
      );

      order = { id: orderRes.rows[0].id, restaurant_order_number: orderRes.rows[0].restaurant_order_number };

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

// =====================================================
// SPLIT BILL
// =====================================================

/**
 * POST /sessions/:sessionId/split-bill/init
 * Initialises a split bill: creates N split_bill_payments records.
 * Calling again replaces any previous split for this session.
 */
router.post("/sessions/:sessionId/split-bill/init", async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  const { split_count } = req.body;

  if (!sessionId || !split_count || split_count < 2 || split_count > 50) {
    return res.status(400).json({ error: "split_count must be between 2 and 50" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const sessionRes = await client.query(
      `SELECT ts.id, ts.restaurant_id FROM table_sessions ts WHERE ts.id = $1 AND ts.ended_at IS NULL`,
      [sessionId]
    );
    if (sessionRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Session not found or already closed" });
    }
    const { restaurant_id } = sessionRes.rows[0];

    // Calculate total from current orders
    const billRes = await client.query(
      `SELECT
         COALESCE(SUM(oi.quantity * oi.price_cents), 0) AS subtotal_cents,
         r.service_charge_percent
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN restaurants r ON r.id = $2
       WHERE o.session_id = $1 AND o.status <> 'cancelled'
       GROUP BY r.service_charge_percent`,
      [sessionId, restaurant_id]
    );

    let subtotal_cents = 0;
    let service_charge_percent = 0;
    if (billRes.rowCount! > 0) {
      subtotal_cents = Number(billRes.rows[0].subtotal_cents);
      service_charge_percent = Number(billRes.rows[0].service_charge_percent || 0);
    }
    const service_charge_cents = Math.round(subtotal_cents * service_charge_percent / 100);
    const total_cents = subtotal_cents + service_charge_cents;

    // Clean up any previous split:
    // Delete split-created orders (no items) and reset original orders
    await client.query(
      `DELETE FROM orders
       WHERE id IN (
         SELECT order_id FROM split_bill_payments WHERE session_id = $1 AND order_id IS NOT NULL
       )
       AND NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = orders.id)`,
      [sessionId]
    );
    await client.query(
      `UPDATE orders SET custom_amount_cents = NULL, is_split_parent = FALSE
       WHERE session_id = $1 AND (custom_amount_cents IS NOT NULL OR is_split_parent = TRUE)`,
      [sessionId]
    );
    await client.query(`DELETE FROM split_bill_payments WHERE session_id = $1`, [sessionId]);

    // Find the primary (first) order — reuse it as portion 1
    const primaryRes = await client.query(
      `SELECT id, restaurant_order_number FROM orders
       WHERE session_id = $1 AND status <> 'cancelled'
       ORDER BY id ASC LIMIT 1`,
      [sessionId]
    );
    const primaryOrderId: number | null = primaryRes.rowCount! > 0 ? primaryRes.rows[0].id : null;
    const primaryOrderNumber: number | null = primaryRes.rowCount! > 0 ? primaryRes.rows[0].restaurant_order_number : null;

    // Hide any additional original orders from history (multi-order sessions)
    if (primaryOrderId) {
      await client.query(
        `UPDATE orders SET is_split_parent = TRUE
         WHERE session_id = $1 AND id <> $2 AND status <> 'cancelled' AND custom_amount_cents IS NULL`,
        [sessionId, primaryOrderId]
      );
    }

    const perPerson = Math.floor(total_cents / split_count);
    const remainder = total_cents - perPerson * split_count;

    const splits: any[] = [];
    for (let i = 1; i <= split_count; i++) {
      const amount = perPerson + (i === split_count ? remainder : 0);

      let portionOrderId: number;
      let portionOrderNumber: number;

      if (i === 1 && primaryOrderId) {
        // Reuse the original order as portion 1 — just update its split amount
        await client.query(
          `UPDATE orders SET custom_amount_cents = $1 WHERE id = $2`,
          [amount, primaryOrderId]
        );
        portionOrderId = primaryOrderId;
        portionOrderNumber = primaryOrderNumber!;
      } else {
        // Create a new order for portions 2, 3, …
        const orderRes = await client.query(
          `INSERT INTO orders (session_id, restaurant_id, status, custom_amount_cents, payment_method)
           VALUES ($1, $2, 'pending', $3, 'cash')
           RETURNING id, restaurant_order_number`,
          [sessionId, restaurant_id, amount]
        );
        portionOrderId = orderRes.rows[0].id;
        portionOrderNumber = orderRes.rows[0].restaurant_order_number;
      }

      const r = await client.query(
        `INSERT INTO split_bill_payments
           (session_id, restaurant_id, split_index, split_count, amount_cents, service_charge, order_id, closed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
         RETURNING *`,
        [sessionId, restaurant_id, i, split_count, amount, service_charge_cents, portionOrderId]
      );
      splits.push({ ...r.rows[0], restaurant_order_number: portionOrderNumber });
    }

    // Record split metadata on the session
    await client.query(
      `UPDATE table_sessions SET split_count = $1, split_bills_paid = 0 WHERE id = $2`,
      [split_count, sessionId]
    );

    await client.query("COMMIT");
    res.json({ splits, total_cents, split_count });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[SplitBill Init]", err);
    res.status(500).json({ error: "Failed to initialise split bill" });
  } finally {
    client.release();
  }
});

/**
 * GET /sessions/:sessionId/split-bill
 * Returns current split_bill_payments for the session.
 */
router.get("/sessions/:sessionId/split-bill", async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  if (!sessionId) return res.status(400).json({ error: "Invalid session id" });

  try {
    const result = await pool.query(
      `SELECT sbp.*, o.restaurant_order_number
       FROM split_bill_payments sbp
       LEFT JOIN orders o ON o.id = sbp.order_id
       WHERE sbp.session_id = $1
       ORDER BY sbp.split_index ASC`,
      [sessionId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[SplitBill Get]", err);
    res.status(500).json({ error: "Failed to load split bill" });
  }
});

/**
 * POST /sessions/:sessionId/split-bill/:splitIndex/pay
 * Marks one split portion as paid. Closes session when all portions are paid.
 */
router.post("/sessions/:sessionId/split-bill/:splitIndex/pay", async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  const splitIndex = Number(req.params.splitIndex);
  const { payment_method = "cash", notes = "", closed_by_staff_id } = req.body;

  if (!sessionId || !splitIndex) {
    return res.status(400).json({ error: "Invalid params" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const splitRes = await client.query(
      `SELECT * FROM split_bill_payments WHERE session_id = $1 AND split_index = $2`,
      [sessionId, splitIndex]
    );
    if (splitRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Split payment not found" });
    }
    const split = splitRes.rows[0];
    if (split.closed_at) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "This split portion has already been paid" });
    }

    // Mark portion paid
    await client.query(
      `UPDATE split_bill_payments
       SET payment_method = $1, notes = $2, closed_at = NOW() AT TIME ZONE 'UTC', closed_by_staff_id = $3
       WHERE id = $4`,
      [payment_method, notes || null, closed_by_staff_id || null, split.id]
    );

    // Mark the linked order as completed
    if (split.order_id) {
      await client.query(
        `UPDATE orders SET status = 'completed', payment_method = $1, payment_status = 'paid'
         WHERE id = $2`,
        [payment_method, split.order_id]
      );
    }

    // Increment paid count on session
    await client.query(
      `UPDATE table_sessions SET split_bills_paid = COALESCE(split_bills_paid, 0) + 1 WHERE id = $1`,
      [sessionId]
    );

    // Check if all portions are now paid
    const countRes = await client.query(
      `SELECT split_count, split_bills_paid FROM table_sessions WHERE id = $1`,
      [sessionId]
    );
    const { split_count, split_bills_paid } = countRes.rows[0];
    const nowPaid = Number(split_bills_paid); // already incremented by UPDATE above

    let sessionClosed = false;
    if (nowPaid >= Number(split_count)) {
      // All paid — close the session
      const totalRes = await client.query(
        `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM split_bill_payments WHERE session_id = $1`,
        [sessionId]
      );
      const amountPaid = Number(totalRes.rows[0].total);
      await client.query(
        `UPDATE table_sessions
         SET ended_at = NOW() AT TIME ZONE 'UTC', payment_method = $1, amount_paid = $2
         WHERE id = $3`,
        [payment_method, amountPaid, sessionId]
      );
      // Mark split-parent orders as completed too (for any reports that scan all orders)
      await client.query(
        `UPDATE orders SET status = 'completed', payment_method = $1, payment_status = 'paid'
         WHERE session_id = $2 AND is_split_parent = TRUE AND status <> 'cancelled'`,
        [payment_method, sessionId]
      );
      sessionClosed = true;
    }

    await client.query("COMMIT");
    res.json({ success: true, sessionClosed });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[SplitBill Pay]", err);
    res.status(500).json({ error: "Failed to process split payment" });
  } finally {
    client.release();
  }
});

export default router;
