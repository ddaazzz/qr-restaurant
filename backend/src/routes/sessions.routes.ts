import { Router } from "express";
import pool from "../config/db";

const router = Router();

/**
 * GET all tables + session status (staff dashboard)
 */
router.get("/restaurants/:restaurantId/sessions", async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const result = await pool.query(
      `
      SELECT
        t.id AS table_id,
        t.name AS table_name,
        ts.id AS session_id,
        ts.started_at,
        ts.ended_at
      FROM tables t
      LEFT JOIN table_sessions ts
        ON ts.table_id = t.id
        AND ts.ended_at IS NULL
      WHERE t.restaurant_id = $1
      ORDER BY t.id
      `,
      [restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

/**
 * START session (staff only)
 */
router.post("/tables/:tableId/sessions", async (req, res) => {
  try {
    const { tableId } = req.params;

    // Prevent duplicate session
    const existing = await pool.query(
      "SELECT * FROM table_sessions WHERE table_id = $1 AND ended_at IS NULL",
      [tableId]
    );

    if (existing?.rowCount > 0) {
      return res.status(400).json({ error: "Session already active" });
    }

    const result = await pool.query(
      `
      INSERT INTO table_sessions (table_id)
      VALUES ($1)
      RETURNING *
      `,
      [tableId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start session" });
  }
});

/**
 * END session (staff only)
 */
router.post("/sessions/:sessionId/end", async (req, res) => {
  try {
    const { sessionId } = req.params;

    await pool.query(
      `
      UPDATE table_sessions
      SET ended_at = NOW()
      WHERE id = $1 AND ended_at IS NULL
      `,
      [sessionId]
    );

    await pool.query(
      `
      UPDATE orders
      SET status = 'served'
      WHERE session_id = $1
      `,
      [sessionId]
    );

    res.json({ message: "Session ended" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to end session" });
  }
});

export default router;
