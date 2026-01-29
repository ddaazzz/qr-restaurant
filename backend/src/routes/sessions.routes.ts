import { Router } from "express";
import pool from "../config/db";

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

    // 1️⃣ Load table
    const tableRes = await client.query(
      `SELECT id, seat_count FROM tables WHERE id = $1`,
      [tableId]
    );
    const table = tableRes.rows[0];
    if (!table) throw new Error("Table not found");

    // 2️⃣ Find all units for table
    const unitsRes = await client.query(
      `SELECT id FROM table_units WHERE table_id = $1 ORDER BY id`,
      [tableId]
    );

    // 3️⃣ Find used seats + used units
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

    // 4️⃣ Create session WITH unit
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
  try {
    const { tableUnitId } = req.params;
    const { pax } = req.body;

    if (!pax || pax <= 0) {
      return res.status(400).json({ error: "Invalid pax" });
    }

    const unitRes = await pool.query(
      `
      SELECT tu.table_id, t.seat_count
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

    const insert = await pool.query(
      `
      INSERT INTO table_sessions (table_id, table_unit_id, pax, started_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
      `,
      [tableId, tableUnitId, pax]
    );

    res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start session" });
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

    const total_cents = rows.reduce(
      (sum, r) => sum + r.quantity * r.price_cents,
      0
    );

    res.json({
      items: rows,
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






export default router;
