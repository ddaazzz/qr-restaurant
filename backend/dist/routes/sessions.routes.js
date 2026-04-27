"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
// POST /tables/:tableId/sessions
router.post("/tables/:tableId/sessions", async (req, res) => {
    const client = await db_1.default.connect();
    try {
        await client.query("BEGIN");
        const { tableId } = req.params;
        const { pax, booking_id, unit_ids, customer_name, customer_phone } = req.body;
        if (!pax || pax <= 0) {
            return res.status(400).json({ error: "Invalid pax" });
        }
        // 1️⃣ Load table with restaurant info
        const tableRes = await client.query(`SELECT t.id, t.seat_count, t.restaurant_id FROM tables t WHERE t.id = $1`, [tableId]);
        const table = tableRes.rows[0];
        if (!table)
            throw new Error("Table not found");
        // 2️⃣ Get restaurant QR preference
        const restaurantRes = await client.query(`SELECT regenerate_qr_per_session, qr_mode FROM restaurants WHERE id = $1`, [table.restaurant_id]);
        const restaurantSettings = restaurantRes.rows[0];
        const shouldRegenerateQR = restaurantSettings?.regenerate_qr_per_session !== false;
        const qrMode = restaurantSettings?.qr_mode || 'regenerate';
        // 3️⃣ Find all units for table
        const unitsRes = await client.query(`SELECT id, display_name FROM table_units WHERE table_id = $1 ORDER BY id`, [tableId]);
        // 4️⃣ Find used seats + used units
        const activeRes = await client.query(`
      SELECT id, table_unit_id, pax
      FROM table_sessions
      WHERE table_id = $1
        AND ended_at IS NULL
      `, [tableId]);
        const usedSeats = activeRes.rows.reduce((s, r) => s + Number(r.pax), 0);
        // Enforce static_table mode: only one session per table at a time
        if (qrMode === 'static_table' && activeRes.rows.length > 0) {
            // If a booking, link to existing session
            if (booking_id) {
                await client.query("ROLLBACK");
                const existingSessionId = activeRes.rows[0].id;
                await db_1.default.query(`UPDATE bookings SET session_id = $1, updated_at = NOW() WHERE id = $2`, [existingSessionId, booking_id]);
                const linkedSession = await db_1.default.query(`SELECT * FROM table_sessions WHERE id = $1`, [existingSessionId]);
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
                await db_1.default.query(`UPDATE bookings SET session_id = $1, updated_at = NOW() WHERE id = $2`, [existingSessionId, booking_id]);
                const linkedSession = await db_1.default.query(`SELECT * FROM table_sessions WHERE id = $1`, [existingSessionId]);
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
        }
        else {
            assignedUnit = unitsRes.rows.find(u => !usedUnitIds.includes(u.id));
        }
        if (!assignedUnit) {
            return res.status(400).json({ error: "No free table units" });
        }
        // 5️⃣ Fetch the current QR token for the unit
        const unitRes = await client.query(`SELECT qr_token FROM table_units WHERE id = $1`, [assignedUnit.id]);
        const currentUnit = unitRes.rows[0];
        // 6️⃣ Handle QR token based on mode:
        // Dynamic mode (regenerate_qr_per_session = true): Generate NEW QR token for each session
        // Static mode (regenerate_qr_per_session = false): Keep existing QR token (already created at table creation)
        if (shouldRegenerateQR) {
            // Dynamic mode: generate new QR for this session
            const newQRToken = crypto_1.default.randomBytes(16).toString("hex");
            await client.query(`UPDATE table_units SET qr_token = $1 WHERE id = $2`, [newQRToken, assignedUnit.id]);
        }
        // Static mode: QR token was already generated at table creation, just use it
        // Resolve customer info: explicit params > booking data > null
        let finalCustomerName = customer_name || null;
        let finalCustomerPhone = customer_phone || null;
        if (booking_id && (!finalCustomerName || !finalCustomerPhone)) {
            const bookingRes = await client.query(`SELECT guest_name, phone FROM bookings WHERE id = $1`, [booking_id]);
            if (bookingRes.rows.length > 0) {
                if (!finalCustomerName)
                    finalCustomerName = bookingRes.rows[0].guest_name || null;
                if (!finalCustomerPhone)
                    finalCustomerPhone = bookingRes.rows[0].phone || null;
            }
        }
        // 7️⃣ Create session WITH unit
        const insertRes = await client.query(`
      INSERT INTO table_sessions (table_id, table_unit_id, pax, started_at, restaurant_id, order_type, customer_name, customer_phone)
      VALUES ($1, $2, $3, NOW() AT TIME ZONE 'UTC', $4, 'table', $5, $6)
      RETURNING *
      `, [tableId, assignedUnit.id, pax, table.restaurant_id, finalCustomerName, finalCustomerPhone]);
        // Auto-create a blank order for this session
        const orderRes = await client.query(`INSERT INTO orders (session_id, restaurant_id) VALUES ($1, $2) RETURNING id, restaurant_order_number`, [insertRes.rows[0].id, table.restaurant_id]);
        console.log(`[Sessions] ✨ Auto-created order ${orderRes.rows[0].id} (restaurant #${orderRes.rows[0].restaurant_order_number}) for session ${insertRes.rows[0].id}`);
        await client.query("COMMIT");
        // If a booking_id was provided, link this session to the booking
        if (booking_id) {
            await db_1.default.query(`UPDATE bookings SET session_id = $1, updated_at = NOW() WHERE id = $2`, [insertRes.rows[0].id, booking_id]);
        }
        res.status(201).json({ ...insertRes.rows[0], order_id: orderRes.rows[0].id, restaurant_order_number: orderRes.rows[0].restaurant_order_number });
    }
    catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        res.status(500).json({ error: "Failed to start session" });
    }
    finally {
        client.release();
    }
});
router.patch("/table-sessions/:sessionId", async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { pax, restaurantId } = req.body;
        if (!pax || pax <= 0)
            return res.status(400).json({ error: "Invalid pax" });
        if (!restaurantId)
            return res.status(400).json({ error: "Restaurant ID is required" });
        // Verify session belongs to restaurant
        const sessionCheck = await db_1.default.query(`SELECT id FROM table_sessions WHERE id = $1 AND restaurant_id = $2`, [sessionId, restaurantId]);
        if (sessionCheck.rowCount === 0) {
            return res.status(403).json({ error: "Session not found or doesn't belong to this restaurant" });
        }
        const result = await db_1.default.query(`UPDATE table_sessions SET pax=$1 WHERE id=$2 RETURNING *`, [pax, sessionId]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: "Session not found" });
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update session" });
    }
});
// GET active sessions with tables and pax
router.get("/restaurants/:restaurantId/table-state", async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const result = await db_1.default.query(`
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

        COALESCE(pay.payment_received, false) AS payment_received,
        CASE WHEN pay.payment_received_at IS NULL THEN NULL ELSE to_char(pay.payment_received_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS payment_received_at,
        pay.payment_method_online,
        pay.merchant_reference,

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
      LEFT JOIN LATERAL (
        SELECT
          BOOL_OR(oo.status = 'completed' AND oo.payment_method = 'payment-asia') AS payment_received,
          MAX(oo.updated_at) FILTER (WHERE oo.status = 'completed' AND oo.payment_method = 'payment-asia') AS payment_received_at,
          MAX(oo.payment_method) FILTER (WHERE oo.status = 'completed' AND oo.payment_method = 'payment-asia') AS payment_method_online,
          MAX(oo.chuio_order_reference) FILTER (WHERE oo.status = 'completed' AND oo.payment_method = 'payment-asia') AS merchant_reference
        FROM orders oo
        WHERE oo.session_id = ts.id
      ) pay ON TRUE
      LEFT JOIN bookings b
        ON b.session_id = ts.id

      WHERE t.restaurant_id = $1
      ORDER BY t.name, tu.unit_code
      `, [restaurantId]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load table state" });
    }
});
// Start Sessions
router.post("/table-units/:tableUnitId/sessions", async (req, res) => {
    const client = await db_1.default.connect();
    try {
        await client.query("BEGIN");
        const { tableUnitId } = req.params;
        const { pax } = req.body;
        if (!pax || pax <= 0) {
            return res.status(400).json({ error: "Invalid pax" });
        }
        const unitRes = await client.query(`
      SELECT tu.table_id, t.seat_count, t.restaurant_id
      FROM table_units tu
      JOIN tables t ON t.id = tu.table_id
      WHERE tu.id = $1
      `, [tableUnitId]);
        if (unitRes.rowCount === 0) {
            return res.status(404).json({ error: "Table unit not found" });
        }
        const tableId = unitRes.rows[0].table_id;
        const restaurantId = unitRes.rows[0].restaurant_id;
        // Get restaurant QR preference
        const restaurantRes = await client.query(`SELECT regenerate_qr_per_session FROM restaurants WHERE id = $1`, [restaurantId]);
        const restaurantSettings = restaurantRes.rows[0];
        const shouldRegenerateQR = restaurantSettings?.regenerate_qr_per_session !== false;
        // Handle QR token based on mode:
        // Dynamic mode (regenerate_qr_per_session = true): Generate NEW QR token for each session
        // Static mode (regenerate_qr_per_session = false): Keep existing QR token (already created at table creation)
        if (shouldRegenerateQR) {
            // Dynamic mode: generate new QR for this session
            const newQRToken = crypto_1.default.randomBytes(16).toString("hex");
            await client.query(`UPDATE table_units SET qr_token = $1 WHERE id = $2`, [newQRToken, tableUnitId]);
        }
        // Static mode: QR token was already generated at table creation, just use it
        const insert = await client.query(`
      INSERT INTO table_sessions (table_id, table_unit_id, pax, started_at, restaurant_id, order_type)
      VALUES ($1, $2, $3, NOW() AT TIME ZONE 'UTC', $4, 'table')
      RETURNING *
      `, [tableId, tableUnitId, pax, restaurantId]);
        await client.query("COMMIT");
        res.status(201).json(insert.rows[0]);
    }
    catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        res.status(500).json({ error: "Failed to start session" });
    }
    finally {
        client.release();
    }
});
/**
 * GET /sessions/:sessionId
 * Returns session details (table, pax, started/ended, payment info)
 */
router.get("/sessions/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    try {
        const result = await db_1.default.query(`SELECT ts.id, ts.pax, ts.restaurant_session_number,
              to_char(ts.started_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS started_at,
              CASE WHEN ts.ended_at IS NULL THEN NULL ELSE to_char(ts.ended_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS ended_at,
              ts.payment_method,
              t.name AS table_name, t.id AS table_id
       FROM table_sessions ts
       LEFT JOIN tables t ON ts.table_id = t.id
       WHERE ts.id = $1`, [sessionId]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Session not found' });
        res.json(result.rows[0]);
    }
    catch (err) {
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
        const sessionRes = await db_1.default.query(`
      SELECT ts.table_id, ts.started_at, ts.order_type, ts.pax, t.restaurant_id, t.name as table_name
      FROM table_sessions ts
      JOIN tables t ON t.id = ts.table_id
      WHERE ts.id = $1
      `, [sessionId]);
        if (sessionRes.rowCount === 0) {
            return res.status(404).json({ error: "Session not found" });
        }
        const restaurantId = sessionRes.rows[0].restaurant_id;
        const session = sessionRes.rows[0];
        // Get restaurant info
        const restaurantRes = await db_1.default.query(`
      SELECT id, name, address, phone, logo_url, service_charge_percent
      FROM restaurants
      WHERE id = $1
      `, [restaurantId]);
        const restaurant = restaurantRes.rows[0];
        // Get order items
        const { rows } = await db_1.default.query(`
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
      `, [sessionId]);
        // Group addon items under their parent items
        const mainItems = [];
        const itemsById = {};
        for (const row of rows) {
            const itemObj = { ...row, addons: [] };
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
        const subtotal_cents = rows.reduce((sum, r) => sum + r.quantity * r.price_cents, 0);
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
    }
    catch (err) {
        console.error("Print bill failed", err);
        res.status(500).json({ error: "Failed to generate bill" });
    }
});
// NOTE: GET /sessions/:sessionId/orders is handled by orders.routes.ts (mounted first in app.ts).
// The duplicate handler was removed from here to avoid confusion.
/**
 * END session (staff only)
 */
router.post("/table-sessions/:sessionId/end", async (req, res) => {
    const { sessionId } = req.params;
    if (!sessionId) {
        return res.status(400).json({ error: "Missing session id" });
    }
    await db_1.default.query(`UPDATE table_sessions SET ended_at = NOW() AT TIME ZONE 'UTC' WHERE id = $1`, [sessionId]);
    // Close any pending orders and mark as unpaid (no payment was made)
    await db_1.default.query(`UPDATE orders SET status = 'closed', payment_status = 'unpaid', payment_method = NULL
     WHERE session_id = $1 AND status IN ('pending', 'confirmed')`, [sessionId]);
    res.json({ success: true });
});
// GET all sessions for a restaurant (for reports)
router.get("/restaurants/:restaurantId/sessions", async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const result = await db_1.default.query(`
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
      `, [restaurantId]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load sessions" });
    }
});
/**
 * GET /restaurants/:restaurantId/sessions-with-orders
 * Fetch all sessions for a restaurant with their nested orders
 * Used for "Sessions" tab in order history - shows closed sessions grouped with their orders
 */
router.get("/restaurants/:restaurantId/sessions-with-orders", async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { limit = '50' } = req.query;
        const limitVal = parseInt(limit);
        // Fetch all closed sessions with their orders
        const sessionsRes = await db_1.default.query(`
      SELECT 
        ts.id AS session_id,
        t.id AS table_id,
        t.name AS table_name,
        ts.order_type,
        ts.pax,
        to_char(ts.started_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS started_at,
        to_char(ts.ended_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS ended_at,
        ts.payment_method,
        ts.payment_status,
        COUNT(DISTINCT o.id) AS order_count,
        COALESCE(SUM(oi.price_cents * oi.quantity), 0) AS total_cents,
        BOOL_OR(o.status = 'completed') AS session_payment_received
      FROM table_sessions ts
      LEFT JOIN tables t ON t.id = ts.table_id
      LEFT JOIN orders o ON o.session_id = ts.id
      LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.removed = false
      WHERE ts.restaurant_id = $1 AND ts.ended_at IS NOT NULL
      GROUP BY ts.id, t.id, t.name, ts.order_type, ts.pax, ts.started_at, ts.ended_at, ts.payment_method
      ORDER BY ts.ended_at DESC
      LIMIT $2
      `, [restaurantId, limitVal]);
        // For each session, fetch detailed orders
        const sessionsWithOrders = await Promise.all(sessionsRes.rows.map(async (session) => {
            // Fetch orders for this session
            const ordersRes = await db_1.default.query(`
          SELECT 
            o.id,
            o.restaurant_order_number,
            o.status,
            (o.status = 'completed') AS payment_received,
            o.payment_method AS payment_method_online,
            to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
            SUM(oi.price_cents * oi.quantity) AS total_cents
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id AND oi.removed = false
          WHERE o.session_id = $1
          GROUP BY o.id, o.restaurant_order_number, o.status, o.payment_method, o.created_at
          ORDER BY o.created_at ASC
          `, [session.session_id]);
            return {
                ...session,
                orders: ordersRes.rows
            };
        }));
        res.json(sessionsWithOrders);
    }
    catch (err) {
        console.error('[Sessions] Error fetching sessions with orders:', err);
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
            const res_update = await db_1.default.query(`UPDATE table_sessions 
         SET bill_closure_requested = $1
         WHERE id = $2 AND (SELECT restaurant_id FROM tables WHERE id = table_sessions.table_id) = $3
         RETURNING id, table_id, bill_closure_requested`, [bill_closure_requested, sessionId, restaurantId]);
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
        }
        catch (updateErr) {
            // Column might not exist yet - just return success anyway
            console.warn("bill_closure_requested column may not exist yet:", updateErr.message);
            return res.json({
                success: true,
                message: "Bill closure requested (feature pending database migration)",
                session: {
                    id: sessionId,
                    bill_closure_requested: true
                }
            });
        }
    }
    catch (err) {
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
    if (!sessionId)
        return res.status(400).json({ error: "Missing session id" });
    if (!restaurantId)
        return res.status(400).json({ error: "Restaurant ID is required" });
    try {
        const result = await db_1.default.query(`UPDATE table_sessions
         SET call_staff_requested = $1
         WHERE id = $2
         RETURNING id, table_id, call_staff_requested`, [call_staff_requested, sessionId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Session not found or access denied" });
        }
        const s = result.rows[0];
        return res.json({ success: true, session: { id: s.id, table_id: s.table_id, call_staff_requested: s.call_staff_requested } });
    }
    catch (err) {
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
    const { payment_method = 'cash', amount_paid = 0, discount_applied = 0, service_charge = 0, notes = '', staff_id = null, restaurantId, kpay_reference_id = null, } = req.body;
    if (!sessionId) {
        return res.status(400).json({ error: "Missing session id" });
    }
    if (!restaurantId) {
        return res.status(400).json({ error: "Restaurant ID is required" });
    }
    const client = await db_1.default.connect();
    try {
        await client.query("BEGIN");
        // Get session
        const sessionRes = await client.query(`SELECT id, table_id, order_type FROM table_sessions WHERE id = $1 AND restaurant_id = $2`, [sessionId, restaurantId]);
        if (sessionRes.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Session not found" });
        }
        const session = sessionRes.rows[0];
        // Guard: if this session was already paid online via Payment Asia,
        // staff should end session directly instead of running close-bill again.
        const paidOnlineRes = await client.query(`SELECT 1
       FROM orders
       WHERE session_id = $1
         AND status = 'completed'
         AND payment_method = 'payment-asia'
       LIMIT 1`, [sessionId]);
        if ((paidOnlineRes.rowCount ?? 0) > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                error: "Session already paid via Payment Asia. Use End Order to close the session.",
            });
        }
        // Get orders and calculate total
        const ordersRes = await client.query(`SELECT o.id, oi.id as item_id, oi.quantity, oi.price_cents
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.session_id = $1 AND o.status <> 'cancelled'
       AND (oi.removed IS FALSE OR oi.removed IS NULL)`, [sessionId]);
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
        await client.query(`UPDATE table_sessions SET 
        ended_at = NOW() AT TIME ZONE 'UTC',
        payment_method = $1,
        amount_paid = $2,
        discount_applied = $3,
        notes = $4,
        closed_by_staff_id = $5
       WHERE id = $6`, [payment_method, finalAmountPaid, discount_applied, notes, staff_id, sessionId]);
        // Mark orders as completed
        await client.query(`UPDATE orders 
       SET payment_method = $1,
           status = 'completed',
           payment_status = 'paid'
       WHERE session_id = $2`, [payment_method, sessionId]);
        // If KPay: mark the transaction as completed and store reference on orders
        if (payment_method === 'kpay' && kpay_reference_id) {
            await client.query(`UPDATE kpay_transactions
         SET status = 'completed', completed_at = NOW() AT TIME ZONE 'UTC'
         WHERE kpay_reference_id = $1 AND restaurant_id = $2`, [kpay_reference_id, restaurantId]);
            // Store the outTradeNo on orders so history can look up the transaction
            await client.query(`UPDATE orders SET chuio_order_reference = $1 WHERE session_id = $2`, [kpay_reference_id, sessionId]);
        }
        // Free up table
        if (session.table_id) {
            await client.query(`UPDATE tables SET available = true WHERE id = $1`, [session.table_id]);
        }
        // Mark linked bookings as completed (keep session_id so order history is still accessible)
        await client.query(`UPDATE bookings SET status = 'completed' WHERE session_id = $1 AND status = 'confirmed'`, [sessionId]);
        await client.query("COMMIT");
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
    }
    catch (err) {
        try {
            await client.query("ROLLBACK");
        }
        catch { }
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[CloseBill] ❌ Error:`, errorMessage);
        res.status(500).json({ error: "Failed to close bill", details: errorMessage });
    }
    finally {
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
    const client = await db_1.default.connect();
    try {
        await client.query("BEGIN");
        // Create counter order session (no table_id or table_unit_id)
        const sessionRes = await client.query(`
      INSERT INTO table_sessions (pax, started_at, restaurant_id, order_type)
      VALUES ($1, NOW() AT TIME ZONE 'UTC', $2, 'counter')
      RETURNING *
      `, [pax || 1, restaurantId]);
        const session = sessionRes.rows[0];
        // If items provided, create order
        let order = null;
        if (items && items.length > 0) {
            const orderRes = await client.query(`
        INSERT INTO orders (session_id, restaurant_id, status, created_at, placed_by_user_id)
        VALUES ($1, $2, 'pending', NOW() AT TIME ZONE 'UTC', $3)
        RETURNING id
        `, [session.id, restaurantId, placed_by_user_id || null]);
            order = { id: orderRes.rows[0].id };
            // Insert order items
            for (const item of items) {
                let price;
                let nameSnapshot;
                if (!item.menu_item_id && item.custom_item_name) {
                    // Custom item — no DB lookup
                    price = item.price_cents || 0;
                    nameSnapshot = item.custom_item_name;
                }
                else {
                    const menuRes = await client.query('SELECT price_cents, name FROM menu_items WHERE id = $1', [item.menu_item_id]);
                    if (menuRes.rows.length === 0)
                        throw new Error(`Menu item ${item.menu_item_id} not found`);
                    price = menuRes.rows[0].price_cents;
                    nameSnapshot = menuRes.rows[0].name;
                }
                const orderItemRes = await client.query(`
          INSERT INTO order_items (order_id, menu_item_id, quantity, price_cents, status, custom_item_name, item_name_snapshot)
          VALUES ($1, $2, $3, $4, 'pending', $5, $6)
          RETURNING id
          `, [order.id, item.menu_item_id || null, item.quantity || 1, price, item.custom_item_name || null, nameSnapshot]);
                const orderItemId = orderItemRes.rows[0].id;
                // Add variant selections if provided
                if (item.selected_option_ids && item.selected_option_ids.length > 0) {
                    for (const optionId of item.selected_option_ids) {
                        await client.query(`INSERT INTO order_item_variants (order_item_id, variant_option_id) VALUES ($1, $2)`, [orderItemId, optionId]);
                    }
                }
            }
            // If payment_status provided (immediate payment), close the session and mark order complete
            if (payment_status === 'settled') {
                const totalRes = await client.query(`SELECT COALESCE(SUM(oi.price_cents * oi.quantity), 0) AS total FROM order_items oi WHERE oi.order_id = $1`, [order.id]);
                const total = totalRes.rows[0].total;
                await client.query(`UPDATE table_sessions SET ended_at = NOW() AT TIME ZONE 'UTC', payment_method = $1, amount_paid = $2 WHERE id = $3`, [payment_method || 'cash', total, session.id]);
                await client.query(`UPDATE orders SET status = 'completed', payment_method = $1, payment_status = 'paid' WHERE id = $2`, [payment_method || 'cash', order.id]);
            }
        }
        await client.query("COMMIT");
        res.status(201).json({ session, order });
    }
    catch (err) {
        await client.query("ROLLBACK");
        console.error("Counter order error:", err);
        res.status(500).json({ error: "Failed to create counter order", details: err instanceof Error ? err.message : String(err) });
    }
    finally {
        client.release();
    }
});
// POST /restaurants/:restaurantId/to-go-order
// Creates a "to-go" order (takeout, no table)
router.post("/restaurants/:restaurantId/to-go-order", async (req, res) => {
    const { restaurantId } = req.params;
    const { pax, items, customer_name, customer_phone } = req.body;
    const client = await db_1.default.connect();
    try {
        await client.query("BEGIN");
        // Create to-go order session (no table_id or table_unit_id)
        const sessionRes = await client.query(`
      INSERT INTO table_sessions (pax, started_at, restaurant_id, order_type, customer_name, customer_phone)
      VALUES ($1, NOW() AT TIME ZONE 'UTC', $2, 'to-go', $3, $4)
      RETURNING *
      `, [pax || 1, restaurantId, customer_name || null, customer_phone || null]);
        const session = sessionRes.rows[0];
        // If items provided, create order
        let order = null;
        if (items && items.length > 0) {
            const orderRes = await client.query(`
        INSERT INTO orders (session_id, restaurant_id, status, created_at)
        VALUES ($1, $2, 'pending', NOW() AT TIME ZONE 'UTC')
        RETURNING id, restaurant_order_number
        `, [session.id, restaurantId]);
            order = { id: orderRes.rows[0].id, restaurant_order_number: orderRes.rows[0].restaurant_order_number };
            // Insert order items
            for (const item of items) {
                let price;
                let nameSnapshot;
                if (!item.menu_item_id && item.custom_item_name) {
                    price = item.price_cents || 0;
                    nameSnapshot = item.custom_item_name;
                }
                else {
                    const menuRes = await client.query('SELECT price_cents, name FROM menu_items WHERE id = $1', [item.menu_item_id]);
                    if (menuRes.rows.length === 0)
                        throw new Error(`Menu item ${item.menu_item_id} not found`);
                    price = menuRes.rows[0].price_cents;
                    nameSnapshot = menuRes.rows[0].name;
                }
                const orderItemRes = await client.query(`
          INSERT INTO order_items (order_id, menu_item_id, quantity, price_cents, status, custom_item_name, item_name_snapshot)
          VALUES ($1, $2, $3, $4, 'pending', $5, $6)
          RETURNING id
          `, [order.id, item.menu_item_id || null, item.quantity || 1, price, item.custom_item_name || null, nameSnapshot]);
                const orderItemId = orderItemRes.rows[0].id;
                // Add variant selections if provided
                if (item.selected_option_ids && item.selected_option_ids.length > 0) {
                    for (const optionId of item.selected_option_ids) {
                        await client.query(`INSERT INTO order_item_variants (order_item_id, variant_option_id) VALUES ($1, $2)`, [orderItemId, optionId]);
                    }
                }
            }
        }
        await client.query("COMMIT");
        res.status(201).json({ session, order });
    }
    catch (err) {
        await client.query("ROLLBACK");
        console.error("To-go order error:", err);
        res.status(500).json({ error: "Failed to create to-go order", details: err instanceof Error ? err.message : String(err) });
    }
    finally {
        client.release();
    }
});
exports.default = router;
//# sourceMappingURL=sessions.routes.js.map