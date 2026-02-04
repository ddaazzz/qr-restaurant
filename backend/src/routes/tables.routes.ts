import { Router } from "express";
import pool from "../config/db";
import crypto from "crypto";

const router = Router();

// GET derived table categories
router.get("/restaurants/:restaurantId/table-categories",
  async (req, res) => {
    const { restaurantId } = req.params;

    const result = await pool.query(
      `
      SELECT id, "key"
      FROM table_categories
      WHERE restaurant_id = $1
      ORDER BY sort_order
      `,
      [restaurantId]
    );

    res.json(result.rows);
  }
);

router.get("/restaurants/:restaurantId/tables", async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const result = await pool.query(
      `
      SELECT
        t.id,
        t.name,
        t.seat_count,
        t.created_at,
        t.category_id,
        tc.key   AS category_key
      FROM tables t
      JOIN table_categories tc
        ON tc.id = t.category_id
      WHERE t.restaurant_id = $1
      ORDER BY sort_order, t.name
      `,
      [restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tables" });
  }
});

// POST new table category
router.post("/restaurants/:restaurantId/table-categories",
  async (req, res) => {
    const { restaurantId } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }

    try {
      const result = await pool.query(
        `
        INSERT INTO table_categories (restaurant_id, "key")
        VALUES ($1, $2)
        RETURNING *
        `,
        [restaurantId, name.trim()]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create table category" });
    }
  }
);

/**
 * CREATE table + QR token
 * (Staff only)
 */
// CREATE tables for a restaurant
// CREATE table + QR token (manual table name)
router.post("/restaurants/:restaurantId/tables", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { restaurantId } = req.params;
    const { category_id, name, seat_count } = req.body;

    if (!name || !category_id || seat_count == null) {
      return res.status(400).json({ error: "Category, name, and seat_count required" });
    }

    // 1️⃣ Check restaurant QR preference (static vs dynamic)
    const restaurantRes = await client.query(
      `SELECT regenerate_qr_per_session FROM restaurants WHERE id = $1`,
      [restaurantId]
    );
    const restaurantSettings = restaurantRes.rows[0];
    const isStaticQR = restaurantSettings?.regenerate_qr_per_session === false;

    // 2️⃣ Insert table with user-provided name
    const tableRes = await client.query(
      `
      INSERT INTO tables (restaurant_id, name, category_id, seat_count)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [restaurantId, name.trim(), category_id, seat_count]
    );

    const table = tableRes.rows[0];

    // 3️⃣ Create table units with static QR codes (if static mode) or null (if dynamic mode)
    const units = [];

    for (let i = 0; i < seat_count; i++) {
      const code = category_id === "BAR" ? `seat${i + 1}` : String.fromCharCode(97 + i);
      // Generate QR token immediately if static mode, otherwise null (will be generated per session)
      const qrToken = isStaticQR ? crypto.randomBytes(16).toString("hex") : null;

      const unitRes = await client.query(
        `
        INSERT INTO table_units (table_id, unit_code, display_name, qr_token)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          table.id,
          code,
          category_id === "BAR" ? `${name}-Seat${i + 1}` : `${name}${code}`,
          qrToken
        ]
      );

      units.push(unitRes.rows[0]);
    }

    await client.query("COMMIT");

    res.status(201).json({ table, units });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to create table" });
  } finally {
    client.release();
  }
});

// Regenerate QR token (staff)
router.post("/tables/:tableId/regenerate-qr", async (req, res) => {
  try {
    const { tableId } = req.params;

    const newToken = crypto.randomBytes(16).toString("hex");

    const result = await pool.query(
      `
      UPDATE table_units
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
/**
 * PATCH /tables/:tableId
 * Update table name and/or seat_count
 */
router.patch("/tables/:tableId", async (req, res) => {
  try {
    const { tableId } = req.params;
    const { name, seat_count } = req.body;

    if (!name && !seat_count) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    // Build dynamic SET clause
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name) {
      fields.push(`name = $${idx++}`);
      values.push(name);
    }

    if (seat_count !== undefined) {
      if (typeof seat_count !== "number" || seat_count <= 0) {
        return res.status(400).json({ error: "Invalid seat count" });
      }
      fields.push(`seat_count = $${idx++}`);
      values.push(seat_count);
    }

    values.push(tableId); // last param = tableId

    const result = await pool.query(
      `UPDATE tables
       SET ${fields.join(", ")}
       WHERE id = $${idx}
       RETURNING *`,
      values
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

// PATCH /table-categories/:categoryId - Update category name
router.patch("/restaurants/:restaurantId/table-categories/:categoryId", async (req, res) => {
  try {
    const { categoryId, restaurantId } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const result = await pool.query(
      `
      UPDATE table_categories
      SET "key" = $1
      WHERE id = $2 AND restaurant_id = $3
      RETURNING *
      `,
      [name.trim(), categoryId, restaurantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Table category not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update table category" });
  }
});

// DELETE /table-categories/:categoryId - Delete category
router.delete("/restaurants/:restaurantId/table-categories/:categoryId", async (req, res) => {
  try {
    const { categoryId, restaurantId } = req.params;

    // Check if category has tables
    const tablesInCategory = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM tables
      WHERE category_id = $1 AND restaurant_id = $2
      `,
      [categoryId, restaurantId]
    );

    if (parseInt(tablesInCategory.rows[0].count) > 0) {
      return res.status(400).json({
        error: "Cannot delete category with existing tables. Delete all tables first."
      });
    }

    const result = await pool.query(
      `
      DELETE FROM table_categories
      WHERE id = $1 AND restaurant_id = $2
      RETURNING *
      `,
      [categoryId, restaurantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Table category not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete table category" });
  }
});

// GET derived table categories
router.get("/restaurants/:restaurantId/table-categories",
  async (req, res) => {
    const { restaurantId } = req.params;

    const result = await pool.query(
      `
      SELECT id, "key"
      FROM table_categories
      WHERE restaurant_id = $1
      ORDER BY sort_order
      `,
      [restaurantId]
    );

    res.json(result.rows);
  }
);

router.get("/restaurants/:restaurantId/tables", async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const result = await pool.query(
      `
      SELECT
        t.id,
        t.name,
        t.seat_count,
        t.created_at,
        t.category_id,
        tc.key   AS category_key
      FROM tables t
      JOIN table_categories tc
        ON tc.id = t.category_id
      WHERE t.restaurant_id = $1
      ORDER BY sort_order, t.name
      `,
      [restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tables" });
  }
});

// POST new table category
router.post("/restaurants/:restaurantId/table-categories",
  async (req, res) => {
    const { restaurantId } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }

    try {
      const result = await pool.query(
        `
        INSERT INTO table_categories (restaurant_id, "key")
        VALUES ($1, $2)
        RETURNING *
        `,
        [restaurantId, name.trim()]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create table category" });
    }
  }
);

/**
 * CREATE table + QR token
 * (Staff only)
 */
router.post("/restaurants/:restaurantId/tables", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { restaurantId } = req.params;
    const { category_id, name, seat_count } = req.body;

    if (!name || !category_id || seat_count == null) {
      return res.status(400).json({ error: "Category, name, and seat_count required" });
    }

    // 1️⃣ Check restaurant QR preference (static vs dynamic)
    const restaurantRes = await client.query(
      `SELECT regenerate_qr_per_session FROM restaurants WHERE id = $1`,
      [restaurantId]
    );
    const restaurantSettings = restaurantRes.rows[0];
    const isStaticQR = restaurantSettings?.regenerate_qr_per_session === false;

    // 2️⃣ Insert table with user-provided name
    const tableRes = await client.query(
      `
      INSERT INTO tables (restaurant_id, name, category_id, seat_count)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [restaurantId, name.trim(), category_id, seat_count]
    );

    const table = tableRes.rows[0];

    // 3️⃣ Create table units with static QR codes (if static mode) or null (if dynamic mode)
    const units = [];

    for (let i = 0; i < seat_count; i++) {
      const code = category_id === "BAR" ? `seat${i + 1}` : String.fromCharCode(97 + i);
      // Generate QR token immediately if static mode, otherwise null (will be generated per session)
      const qrToken = isStaticQR ? crypto.randomBytes(16).toString("hex") : null;

      const unitRes = await client.query(
        `
        INSERT INTO table_units (table_id, unit_code, display_name, qr_token)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          table.id,
          code,
          category_id === "BAR" ? `${name}-Seat${i + 1}` : `${name}${code}`,
          qrToken
        ]
      );

      units.push(unitRes.rows[0]);
    }

    await client.query("COMMIT");

    res.status(201).json({ table, units });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to create table" });
  } finally {
    client.release();
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
/**
 * PATCH /tables/:tableId
 * Update table name and/or seat_count
 */
router.patch("/tables/:tableId", async (req, res) => {
  try {
    const { tableId } = req.params;
    const { name, seat_count } = req.body;

    if (!name && !seat_count) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    // Build dynamic SET clause
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name) {
      fields.push(`name = $${idx++}`);
      values.push(name);
    }

    if (seat_count !== undefined) {
      if (typeof seat_count !== "number" || seat_count <= 0) {
        return res.status(400).json({ error: "Invalid seat count" });
      }
      fields.push(`seat_count = $${idx++}`);
      values.push(seat_count);
    }

    values.push(tableId); // last param = tableId

    const result = await pool.query(
      `UPDATE tables
       SET ${fields.join(", ")}
       WHERE id = $${idx}
       RETURNING *`,
      values
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

    if ((activeSession?.rowCount ?? 0) > 0) {
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