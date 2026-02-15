import { Router } from "express";
import pool from "../config/db";

const router = Router();

// GET bookings for a restaurant (optionally filtered by date or table)
router.get("/restaurants/:restaurantId/bookings", async (req, res) => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { date, table_id } = req.query;

  try {
    let query = `
      SELECT b.* FROM bookings b
      WHERE b.restaurant_id = $1
    `;
    const params: any[] = [restaurantId];

    if (date) {
      query += ` AND b.booking_date = $${params.length + 1}`;
      params.push(date as string);
    }

    if (table_id) {
      query += ` AND b.table_id = $${params.length + 1}`;
      params.push(parseInt(table_id as string, 10));
    }

    query += ` ORDER BY b.booking_date DESC, b.booking_time DESC`;

    const res_data = await pool.query(query, params);
    res.json(res_data.rows);
  } catch (err) {
    console.error("Error fetching bookings:", err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// GET single booking
router.get("/bookings/:bookingId", async (req, res) => {
  const { bookingId } = req.params;

  try {
    const res_data = await pool.query(
      `SELECT * FROM bookings WHERE id = $1`,
      [bookingId]
    );

    if (res_data.rowCount === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json(res_data.rows[0]);
  } catch (err) {
    console.error("Error fetching booking:", err);
    res.status(500).json({ error: "Failed to fetch booking" });
  }
});

// POST create booking
router.post("/restaurants/:restaurantId/bookings", async (req, res) => {
  const { restaurantId } = req.params;
  const { table_id, guest_name, pax, booking_date, booking_time, status = "confirmed", notes = "" } = req.body;

  // Validate input
  if (!table_id || !guest_name || !pax || !booking_date || !booking_time) {
    return res.status(400).json({ error: "Missing required fields: table_id, guest_name, pax, booking_date, booking_time" });
  }

  if (pax <= 0) {
    return res.status(400).json({ error: "Pax must be greater than 0" });
  }

  try {
    // Check if table exists and belongs to restaurant
    const tableRes = await pool.query(
      `SELECT id FROM tables WHERE id = $1 AND restaurant_id = $2`,
      [table_id, restaurantId]
    );

    if (tableRes.rowCount === 0) {
      return res.status(400).json({ error: "Table not found or doesn't belong to this restaurant" });
    }

    // Check if table has enough seats
    const seatRes = await pool.query(
      `SELECT seat_count FROM tables WHERE id = $1`,
      [table_id]
    );
    const table = seatRes.rows[0];

    if (pax > table.seat_count) {
      return res.status(400).json({ error: `Table can only accommodate ${table.seat_count} pax` });
    }

    // Check for conflicting bookings on same table, date, time
    const conflictRes = await pool.query(
      `SELECT id FROM bookings 
       WHERE table_id = $1 
       AND booking_date = $2 
       AND booking_time = $3 
       AND status != 'cancelled'`,
      [table_id, booking_date, booking_time]
    );

    if (conflictRes && conflictRes.rowCount && conflictRes.rowCount > 0) {
      return res.status(400).json({ error: "Table is already booked for this date and time" });
    }

    // Create booking
    const res_data = await pool.query(
      `INSERT INTO bookings (restaurant_id, table_id, guest_name, pax, booking_date, booking_time, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [restaurantId, table_id, guest_name, pax, booking_date, booking_time, status, notes]
    );

    res.status(201).json({
      success: true,
      booking: res_data.rows[0]
    });
  } catch (err) {
    console.error("Error creating booking:", err);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// PATCH update booking status - ✅ MULTI-RESTAURANT SUPPORT
router.patch("/bookings/:bookingId", async (req, res) => {
  const { bookingId } = req.params;
  const { status, notes, restaurantId } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  if (!restaurantId) {
    return res.status(400).json({ error: "Restaurant ID is required" });
  }

  try {
    // Verify booking belongs to restaurant
    const bookingCheck = await pool.query(
      `SELECT id FROM bookings WHERE id = $1 AND restaurant_id = $2`,
      [bookingId, restaurantId]
    );

    if (bookingCheck.rowCount === 0) {
      return res.status(404).json({ error: "Booking not found or doesn't belong to this restaurant" });
    }

    const res_data = await pool.query(
      `UPDATE bookings SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3 AND restaurant_id = $4
       RETURNING *`,
      [status, notes || null, bookingId, restaurantId]
    );

    if (res_data.rowCount === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json({
      success: true,
      booking: res_data.rows[0]
    });
  } catch (err) {
    console.error("Error updating booking:", err);
    res.status(500).json({ error: "Failed to update booking" });
  }
});

// DELETE booking (soft delete - mark as cancelled) - ✅ MULTI-RESTAURANT SUPPORT
router.delete("/bookings/:bookingId", async (req, res) => {
  const { bookingId } = req.params;
  const { restaurantId } = req.body;

  if (!restaurantId) {
    return res.status(400).json({ error: "Restaurant ID is required" });
  }

  try {
    // Verify booking belongs to restaurant
    const bookingCheck = await pool.query(
      `SELECT id FROM bookings WHERE id = $1 AND restaurant_id = $2`,
      [bookingId, restaurantId]
    );

    if (bookingCheck.rowCount === 0) {
      return res.status(404).json({ error: "Booking not found or doesn't belong to this restaurant" });
    }

    const res_data = await pool.query(
      `UPDATE bookings SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND restaurant_id = $2
       RETURNING *`,
      [bookingId, restaurantId]
    );

    if (res_data.rowCount === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json({
      success: true,
      booking: res_data.rows[0]
    });
  } catch (err) {
    console.error("Error deleting booking:", err);
    res.status(500).json({ error: "Failed to delete booking" });
  }
});

export default router;
