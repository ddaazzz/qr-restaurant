"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const featureFlags_1 = require("../middleware/featureFlags");
const upsertCrmCustomer_1 = require("../utils/upsertCrmCustomer");
const router = (0, express_1.Router)();
// GET bookings for a restaurant (optionally filtered by date or table)
router.get("/restaurants/:restaurantId/bookings", (0, featureFlags_1.requireFeature)("bookings"), async (req, res) => {
    const restaurantId = parseInt(req.params.restaurantId, 10);
    const { date, table_id } = req.query;
    try {
        // booking_date is a DATE column — no timezone conversion needed
        let query = `
      SELECT 
        b.*,
        b.restaurant_booking_number,
        TO_CHAR(b.booking_date, 'YYYY-MM-DD') as booking_date_str,
        t.name AS table_name
      FROM bookings b
      LEFT JOIN tables t ON t.id = b.table_id
      WHERE b.restaurant_id = $1
    `;
        const params = [restaurantId];
        if (date) {
            query += ` AND b.booking_date = $${params.length + 1}::DATE`;
            params.push(date);
        }
        if (table_id) {
            query += ` AND b.table_id = $${params.length + 1}`;
            params.push(parseInt(table_id, 10));
        }
        query += ` ORDER BY b.booking_date DESC, b.booking_time DESC`;
        const res_data = await db_1.default.query(query, params);
        // Return booking_date as YYYY-MM-DD string (not JS Date object)
        const formattedRows = res_data.rows.map(row => {
            const { booking_date_str, ...rest } = row;
            return { ...rest, booking_date: booking_date_str };
        });
        res.json(formattedRows);
    }
    catch (err) {
        console.error("Error fetching bookings:", err);
        res.status(500).json({ error: "Failed to fetch bookings" });
    }
});
// GET single booking
router.get("/bookings/:bookingId", async (req, res) => {
    const { bookingId } = req.params;
    const { restaurantId } = req.query;
    if (!restaurantId) {
        return res.status(400).json({ error: "Restaurant ID is required" });
    }
    try {
        const res_data = await db_1.default.query(`SELECT * FROM bookings WHERE id = $1 AND restaurant_id = $2`, [bookingId, restaurantId]);
        if (res_data.rowCount === 0) {
            return res.status(404).json({ error: "Booking not found or doesn't belong to this restaurant" });
        }
        res.json(res_data.rows[0]);
    }
    catch (err) {
        console.error("Error fetching booking:", err);
        res.status(500).json({ error: "Failed to fetch booking" });
    }
});
// POST create booking
router.post("/restaurants/:restaurantId/bookings", (0, featureFlags_1.requireFeature)("bookings"), async (req, res) => {
    const { restaurantId } = req.params;
    const { table_id, guest_name, pax, booking_date, booking_time, status = "confirmed", notes = "" } = req.body;
    // Validate status
    const validStatuses = ['confirmed', 'completed', 'cancelled', 'no-show'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    // Validate input
    if (!table_id || !guest_name || !pax || !booking_date || !booking_time) {
        return res.status(400).json({ error: "Missing required fields: table_id, guest_name, pax, booking_date, booking_time" });
    }
    if (pax <= 0) {
        return res.status(400).json({ error: "Pax must be greater than 0" });
    }
    try {
        // Check if table exists and belongs to restaurant
        const tableRes = await db_1.default.query(`SELECT id FROM tables WHERE id = $1 AND restaurant_id = $2`, [table_id, restaurantId]);
        if (tableRes.rowCount === 0) {
            return res.status(400).json({ error: "Table not found or doesn't belong to this restaurant" });
        }
        // Check if table has enough seats
        const seatRes = await db_1.default.query(`SELECT seat_count FROM tables WHERE id = $1`, [table_id]);
        const table = seatRes.rows[0];
        if (pax > table.seat_count) {
            return res.status(400).json({ error: `Table can only accommodate ${table.seat_count} pax` });
        }
        // Check for conflicting bookings on same table, date, time
        const conflictRes = await db_1.default.query(`SELECT id FROM bookings 
       WHERE table_id = $1 
       AND booking_date = $2 
       AND booking_time = $3 
       AND status != 'cancelled'`, [table_id, booking_date, booking_time]);
        if (conflictRes && conflictRes.rowCount && conflictRes.rowCount > 0) {
            return res.status(400).json({ error: "Table is already booked for this date and time" });
        }
        // Create booking
        const res_data = await db_1.default.query(`INSERT INTO bookings (restaurant_id, table_id, guest_name, pax, booking_date, booking_time, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`, [restaurantId, table_id, guest_name, pax, booking_date, booking_time, status, notes]);
        const createdBooking = res_data.rows[0];
        // Auto-sync to CRM (fire-and-forget)
        (0, upsertCrmCustomer_1.upsertCrmCustomer)({
            restaurantId: restaurantId,
            name: createdBooking.guest_name,
            phone: createdBooking.phone,
            email: createdBooking.email,
        });
        res.status(201).json({
            success: true,
            booking: createdBooking
        });
    }
    catch (err) {
        console.error("Error creating booking:", err);
        res.status(500).json({ error: "Failed to create booking" });
    }
});
// PATCH update booking status - ✅ MULTI-RESTAURANT SUPPORT
router.patch("/bookings/:bookingId", async (req, res) => {
    const { bookingId } = req.params;
    const { guest_name, phone, pax, table_id, booking_date, booking_time, status, notes, restaurantId, session_id } = req.body;
    if (!restaurantId) {
        return res.status(400).json({ error: "Restaurant ID is required" });
    }
    // Validate status if provided
    if (status) {
        const validStatuses = ['confirmed', 'completed', 'cancelled', 'no-show'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }
    }
    try {
        // Verify booking belongs to restaurant
        const bookingCheck = await db_1.default.query(`SELECT id FROM bookings WHERE id = $1 AND restaurant_id = $2`, [bookingId, restaurantId]);
        if (bookingCheck.rowCount === 0) {
            return res.status(404).json({ error: "Booking not found or doesn't belong to this restaurant" });
        }
        // Build dynamic UPDATE query
        const updates = [];
        const values = [];
        let paramCount = 1;
        if (guest_name !== undefined) {
            updates.push(`guest_name = $${paramCount++}`);
            values.push(guest_name);
        }
        if (phone !== undefined) {
            updates.push(`phone = $${paramCount++}`);
            values.push(phone);
        }
        if (pax !== undefined) {
            updates.push(`pax = $${paramCount++}`);
            values.push(pax);
        }
        if (table_id !== undefined) {
            updates.push(`table_id = $${paramCount++}`);
            values.push(table_id);
        }
        if (booking_date !== undefined) {
            updates.push(`booking_date = $${paramCount++}`);
            values.push(booking_date);
        }
        if (booking_time !== undefined) {
            updates.push(`booking_time = $${paramCount++}`);
            values.push(booking_time);
        }
        if (status !== undefined) {
            updates.push(`status = $${paramCount++}`);
            values.push(status);
        }
        if (notes !== undefined) {
            updates.push(`notes = $${paramCount++}`);
            values.push(notes);
        }
        if (session_id !== undefined) {
            updates.push(`session_id = $${paramCount++}`);
            values.push(session_id);
        }
        updates.push(`updated_at = NOW()`);
        if (updates.length === 1) {
            // Only updated_at was set
            return res.status(400).json({ error: "No fields to update" });
        }
        values.push(bookingId);
        values.push(restaurantId);
        const query = `
      UPDATE bookings 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND restaurant_id = $${paramCount + 1}
      RETURNING *
    `;
        const res_data = await db_1.default.query(query, values);
        if (res_data.rowCount === 0) {
            return res.status(404).json({ error: "Booking not found" });
        }
        const updatedBooking = res_data.rows[0];
        // Auto-sync to CRM if guest details changed (fire-and-forget)
        if (updatedBooking.guest_name) {
            (0, upsertCrmCustomer_1.upsertCrmCustomer)({
                restaurantId: updatedBooking.restaurant_id,
                name: updatedBooking.guest_name,
                phone: updatedBooking.phone,
                email: updatedBooking.email,
            });
        }
        res.json({
            success: true,
            booking: updatedBooking
        });
    }
    catch (err) {
        console.error("Error updating booking:", err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("Error message:", errorMsg);
        res.status(500).json({ error: "Failed to update booking", details: errorMsg });
    }
});
// DELETE booking (soft delete - mark as cancelled) - ✅ MULTI-RESTAURANT SUPPORT
router.delete("/bookings/:bookingId", async (req, res) => {
    const { bookingId } = req.params;
    const { restaurantId } = req.body;
    if (!restaurantId) {
        return res.status(400).json({ error: "Restaurant ID is required in request body" });
    }
    try {
        // Verify booking belongs to restaurant
        const bookingCheck = await db_1.default.query(`SELECT id FROM bookings WHERE id = $1 AND restaurant_id = $2`, [bookingId, restaurantId]);
        if (bookingCheck.rowCount === 0) {
            return res.status(404).json({ error: "Booking not found or doesn't belong to this restaurant" });
        }
        const res_data = await db_1.default.query(`DELETE FROM bookings WHERE id = $1 AND restaurant_id = $2 RETURNING *`, [bookingId, restaurantId]);
        if (res_data.rowCount === 0) {
            return res.status(404).json({ error: "Booking not found" });
        }
        res.json({
            success: true,
            booking: res_data.rows[0]
        });
    }
    catch (err) {
        console.error("Error deleting booking:", err);
        res.status(500).json({ error: "Failed to delete booking" });
    }
});
exports.default = router;
//# sourceMappingURL=bookings.routes.js.map