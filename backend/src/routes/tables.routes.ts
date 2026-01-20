import { Router } from "express";
import pool from "../config/db";
import crypto from "crypto";

const router = Router();

/**
 * GET all tables for a restaurant
 * (Staff dashboard)
 */
router.get("/restaurants/:restaurantId/tables", async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const result = await pool.query(
      "SELECT * FROM tables WHERE restaurant_id = $1 ORDER BY id",
      [restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tables" });
  }
});


/**
 * CREATE table + QR token
 * (Staff only)
 */
// CREATE tables for a restaurant
router.post("/restaurants/:restaurantId/tables", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Table name is required" });
    }

    const qrToken = crypto.randomBytes(16).toString("hex");

    const result = await pool.query(
      `
      INSERT INTO tables (restaurant_id, name, qr_token)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [restaurantId, name, qrToken]
    );

    const table = result.rows[0];

    res.status(201).json({
      table_id: table.id, 
      table_name: table.name,
      qr_token: table.qr_token,
      qr_url: `http://localhost:3000/${qrToken}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create table" });
  }
});


// Regenerate QR token (staff)
router.post("/tables/:tableId/regenerate-qr", async (req, res) => {
  try {
    const { tableId } = req.params;

    const newToken = crypto.randomBytes(16).toString("hex");

    const result = await pool.query(
      `
      UPDATE tables
      SET qr_token = $1
      WHERE id = $2
      RETURNING id, name, qr_token
      `,
      [newToken, tableId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to regenerate QR" });
  }
});

/**
 * UPDATE table name
 * (Admin / Staff)
 */
router.patch("/tables/:tableId", async (req, res) => {
  try {
    const { tableId } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Table name required" });
    }

    const result = await pool.query(
      `
      UPDATE tables
      SET name = $1
      WHERE id = $2
      RETURNING *
      `,
      [name.trim(), tableId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Table not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update table" });
  }
});


/**
 * DELETE table
 * (Admin only)
 */
router.delete("/tables/:tableId", async (req, res) => {
  const client = await pool.connect();

  try {
    const { tableId } = req.params;

    await client.query("BEGIN");

    // Block delete if active session exists
    const activeSession = await client.query(
      `
      SELECT id
      FROM table_sessions
      WHERE table_id = $1
        AND ended_at IS NULL
      `,
      [tableId]
    );

    if (activeSession?.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Cannot delete table with active session"
      });
    }

    const result = await client.query(
      `
      DELETE FROM tables
      WHERE id = $1
      RETURNING *
      `,
      [tableId]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Table not found" });
    }

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to delete table" });
  } finally {
    client.release();
  }
});


export default router;