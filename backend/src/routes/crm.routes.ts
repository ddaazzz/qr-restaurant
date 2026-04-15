import { Router } from "express";
import pool from "../config/db";

const router = Router();

// GET /restaurants/:restaurantId/crm/customers?search=...
// Search CRM customers by name or phone
router.get("/restaurants/:restaurantId/crm/customers", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { search } = req.query;

    let query = `SELECT id, name, phone, email, total_visits, total_spent_cents, last_visit_at
                 FROM crm_customers
                 WHERE restaurant_id = $1`;
    const params: any[] = [restaurantId];

    if (search && typeof search === 'string' && search.trim()) {
      query += ` AND (name ILIKE $2 OR phone ILIKE $2)`;
      params.push(`%${search.trim()}%`);
    }

    query += ` ORDER BY last_visit_at DESC NULLS LAST LIMIT 20`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /restaurants/:restaurantId/crm/customers
// Create a new CRM customer
router.post("/restaurants/:restaurantId/crm/customers", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, phone, email, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const result = await pool.query(
      `INSERT INTO crm_customers (restaurant_id, name, phone, email, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [restaurantId, name, phone || null, email || null, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /sessions/:sessionId/customer
// Update customer_name and customer_phone on a table session
router.patch("/sessions/:sessionId/customer", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { customer_name, customer_phone } = req.body;

    const result = await pool.query(
      `UPDATE table_sessions
       SET customer_name = $1, customer_phone = $2
       WHERE id = $3
       RETURNING id, customer_name, customer_phone`,
      [customer_name || null, customer_phone || null, sessionId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
