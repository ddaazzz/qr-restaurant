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

// GET tables for a restaurant
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

export default router;