import { Router } from "express";
import pool from "../config/db";

const router = Router();

// Place an order
router.post("/sessions/:sessionId/orders", async (req, res) => {
  try {
  const { sessionId } = req.params;
  const { items } = req.body;

const sessionCheck = await pool.query(
  "SELECT * FROM table_sessions WHERE id = $1 AND ended_at IS NULL",
  [sessionId]
);

if (sessionCheck.rowCount === 0) {
  return res.status(400).json({ error: "Session is closed" });
}

  // Create order, inserting sessionId into orders and items into order_items
  const orderResult = await pool.query(
    "INSERT INTO orders (session_id, status) VALUES ($1, 'pending') RETURNING *",
    [sessionId]
  );
  const order = orderResult.rows[0];

  for (const item of items) {
    const menuItemResult = await pool.query(
  `
  SELECT price_cents, available
  FROM menu_items
  WHERE id = $1
  `,
  [item.menu_item_id]
);

if (!menuItemResult.rows[0].available) {
  return res.status(400).json({
    error: "One or more items are sold out"
  });
}

    const price = menuItemResult.rows[0].price_cents;

    await pool.query(
      `
      INSERT INTO order_items
        (order_id, menu_item_id, quantity, price_cents)
      VALUES ($1, $2, $3, $4)
      `,
      [order.id, item.menu_item_id, item.quantity, price]
    );
  }

  res.status(201).json({
    message: "Order placed",
    order_id: order.id,
  });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all orders for a session
router.get("/sessions/:sessionId/orders", async (req, res) => {
    try {
  const { sessionId } = req.params;

  const ordersResult = await pool.query(
    `
SELECT 
  o.id AS order_id,
  o.status,
  json_agg(
    json_build_object(
      'name', mi.name,
      'quantity', oi.quantity
    )
  ) AS items,
  SUM(oi.price_cents * oi.quantity) AS total_cents
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN menu_items mi ON mi.id = oi.menu_item_id
WHERE o.session_id = $1
GROUP BY o.id
ORDER BY o.id DESC
    `,
    [sessionId]
  );

  res.json({
    session_id: sessionId,
    items: ordersResult.rows,
    total_cents: ordersResult.rows.reduce((sum, row) => sum + Number(row.total_cents), 0),
  });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// GET all active orders for kitchen
router.get("/orders", async (_req, res) => {
    try{
  const result = await pool.query(`
    SELECT 
      o.id AS order_id,
      o.status,
      o.created_at,
      ts.id AS session_id,
      t.name AS table_name,
      json_agg(
        json_build_object(
          'name', mi.name,
          'quantity', oi.quantity
        )
      ) AS items
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    JOIN table_sessions ts ON o.session_id = ts.id
    JOIN tables t ON ts.table_id = t.id
    WHERE o.status != 'served'
    GROUP BY o.id, ts.id, t.name
    ORDER BY o.created_at ASC
  `);

  res.json(result.rows);
    } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/orders/:id/status", async (req, res) => {
    try{
  const { id } = req.params;
  const { status } = req.body;

  if (!["pending", "preparing", "served"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const result = await pool.query(
    "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
    [status, id]
  );

  res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Close a session
router.post("/sessions/:sessionId/close", async (req, res) => {
    try{
  const { sessionId } = req.params;

  // Check if session exists and is open
  const sessionResult = await pool.query(
    "SELECT * FROM table_sessions WHERE id = $1 AND ended_at IS NULL",
    [sessionId]
  );

  if (sessionResult.rowCount === 0) {
    return res.status(400).json({ error: "Session already closed or not found" });
  }

  // Close session
  await pool.query(
    "UPDATE table_sessions SET ended_at = NOW() WHERE id = $1",
    [sessionId]
  );

  // Close all open orders
  await pool.query(
    "UPDATE orders SET status = 'served' WHERE session_id = $1",
    [sessionId]
  );

  res.json({ message: "Session closed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});



export default router;
