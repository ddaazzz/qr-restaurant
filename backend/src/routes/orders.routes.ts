import { Router } from "express";
import pool from "../config/db";

const router = Router();

// Place an order
// POST place order (with variants)
router.post("/sessions/:sessionId/orders", async (req, res) => {
  const { sessionId } = req.params;
  const { items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: "No items in order" });
  }

  try {
    // Ensure session is active
    const sessionRes = await pool.query(
      `
      SELECT 1 FROM table_sessions
      WHERE id = $1 AND ended_at IS NULL
      `,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) {
      return res.status(400).json({ error: "Session is closed" });
    }

    // Create order
    const orderRes = await pool.query(
      `
      INSERT INTO orders (session_id)
      VALUES ($1)
      RETURNING id
      `,
      [sessionId]
    );

    const orderId = orderRes.rows[0].id;

    // ✅ LOOP STARTS HERE — item is now defined
    for (const item of items) {
      const optionIds: number[] = item.selected_option_ids || [];

      /* ------------------------------
   VARIANT RULE VALIDATION
------------------------------ */

// Load variants for this menu item
const variantsRes = await pool.query(
  `
  SELECT id, required, min_select, max_select
  FROM menu_item_variants
  WHERE menu_item_id = $1
  `,
  [item.menu_item_id]
);

const variants = variantsRes.rows;

// Load selected options → variant mapping
const optionsRes = optionIds.length
  ? await pool.query(
      `
      SELECT id, variant_id
      FROM menu_item_variant_options
      WHERE id = ANY($1::int[])
      `,
      [optionIds]
    )
  : { rows: [] };


  // Ensure all selected options belong to this menu item
const validVariantIds = new Set(variants.map(v => v.id));

for (const o of optionsRes.rows) {
  if (!validVariantIds.has(o.variant_id)) {
    throw new Error("Invalid variant option selected");
  }
}

// Group selected options by variant
const selectedByVariant: Record<number, number[]> = {};

for (const o of optionsRes.rows) {
  if (!selectedByVariant[o.variant_id]) {
    selectedByVariant[o.variant_id] = [];
  }
  selectedByVariant[o?.variant_id].push(o.id);
}

// Validate each variant
for (const v of variants) {
  const selected = selectedByVariant[v.id] || [];
  const count = selected.length;

  // REQUIRED
  if (v.required && count === 0) {
    throw new Error(`Required variant "${v.id}" not selected`);
  }

  // MIN
  if (v.min_select !== null && count < v.min_select) {
    throw new Error(
      `Must select at least ${v.min_select} option(s)`
    );
  }

  // MAX
  if (v.max_select !== null && count > v.max_select) {
    throw new Error(
      `You can select at most ${v.max_select} option(s)`
    );
  }
}



      /* ------------------------------
         Calculate price
      ------------------------------ */
      const basePriceRes = await pool.query(
        `
        SELECT price_cents FROM menu_items
        WHERE id = $1 AND available = true
        `,
        [item.menu_item_id]
      );

      if (basePriceRes.rowCount === 0) {
        throw new Error("Menu item unavailable");
      }

      const basePrice = Number(basePriceRes.rows[0].price_cents);

      let variantExtra = 0;

      if (optionIds.length > 0) {
        const variantPriceRes = await pool.query(
          `
          SELECT COALESCE(SUM(price_cents), 0) AS extra
          FROM menu_item_variant_options
          WHERE id = ANY($1::int[])
          `,
          [optionIds]
        );

        variantExtra = Number(variantPriceRes.rows[0].extra);
      }

      const finalUnitPrice = basePrice + variantExtra;

      /* ------------------------------
         Insert order item
      ------------------------------ */
      const orderItemRes = await pool.query(
        `
        INSERT INTO order_items
          (order_id, menu_item_id, quantity, price_cents, status)
        VALUES
          ($1, $2, $3, $4, 'pending')
        RETURNING id
        `,
        [
          orderId,
          item.menu_item_id,
          item.quantity,
          finalUnitPrice
        ]
      );

      const orderItemId = orderItemRes.rows[0].id;

      /* ------------------------------
         Insert variant selections
      ------------------------------ */
      for (const optionId of optionIds) {
        await pool.query(
          `
          INSERT INTO order_item_variants
            (order_item_id, variant_option_id)
          VALUES ($1, $2)
          `,
          [orderItemId, optionId]
        );
      }
    }

    res.json({ success: true, order_id: orderId });
  } catch (err: any) {
    console.error("Order creation failed:", err);

    res.status(
      err.message?.includes("select") ? 400 : 500
    ).json({ error: err.message });
  }

});


// Get all orders for a session
// GET orders for a session (with variants)
router.get("/sessions/:sessionId/orders", async (req, res) => {
  const { sessionId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        o.id AS order_id,
        oi.status AS item_status,
        o.created_at,

        oi.id AS order_item_id,
        oi.quantity,
        oi.price_cents AS unit_price_cents,

        mi.name AS item_name,

        COALESCE(
          STRING_AGG(
            DISTINCT v.name || ': ' || vo.name,
            ', '
          ),
          ''
        ) AS variants

      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN menu_items mi ON mi.id = oi.menu_item_id

      LEFT JOIN order_item_variants oiv ON oiv.order_item_id = oi.id
      LEFT JOIN menu_item_variant_options vo ON vo.id = oiv.variant_option_id
      LEFT JOIN menu_item_variants v ON v.id = vo.variant_id

      WHERE o.session_id = $1

      GROUP BY
        o.id,
        o.created_at,
        oi.id,
        oi.quantity,
        oi.price_cents,
        mi.name

      ORDER BY o.created_at ASC, oi.id ASC
      `,
      [sessionId]
    );

    // Group into orders
    const ordersMap: any = {};

    for (const row of result.rows) {
      if (!ordersMap[row.order_id]) {
        ordersMap[row.order_id] = {
          order_id: row.order_id,
          created_at: row.created_at,
          items: [],
          total_cents: 0
        };
      }

      const itemTotal =
        Number(row.unit_price_cents) * Number(row.quantity);

      ordersMap[row.order_id].items.push({
        name: row.item_name,
        quantity: row.quantity,
        status: row.item_status,
        unit_price_cents: row.unit_price_cents,
        total_price_cents: itemTotal,
        variants: row.variants
      });

      ordersMap[row.order_id].total_cents += itemTotal;
    }

    res.json({
      items: Object.values(ordersMap)
    });
  } catch (err) {
    console.error("Failed to load session orders:", err);
    res.status(500).json({ error: "Failed to load orders" });
  }
});



// GET all active orders for kitchen
// GET kitchen orders (with variants)
router.get("/kitchen/items", async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
  oi.id AS order_item_id,
  oi.status,
  oi.quantity,

  mi.name AS item_name,

  t.name AS table_name,
  o.id AS order_id,
  ts.id AS session_id,
  o.created_at,

  COALESCE(
    STRING_AGG(
      DISTINCT v.name || ': ' || vo.name,
      ', '
    ),
    ''
  ) AS variants

FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN table_sessions ts ON o.session_id = ts.id
JOIN tables t ON ts.table_id = t.id
JOIN menu_items mi ON oi.menu_item_id = mi.id

LEFT JOIN order_item_variants oiv ON oiv.order_item_id = oi.id
LEFT JOIN menu_item_variant_options vo ON vo.id = oiv.variant_option_id
LEFT JOIN menu_item_variants v ON v.id = vo.variant_id

WHERE oi.status != 'served'

GROUP BY
  oi.id,
  oi.status,
  oi.quantity,
  mi.name,
  t.name,
  o.id,
  ts.id,
  o.created_at

ORDER BY o.created_at ASC;


      `
    );
res.json(
  result.rows.map(row => ({
    order_item_id: row.order_item_id,
    order_id: row.order_id,
    session_id: row.session_id,
    table_name: row.table_name,
    item_name: row.item_name,
    quantity: row.quantity,
    status: row.status,
    variants: row.variants,   // ✅ NEW
    created_at: row.created_at
  }))
);

  } catch (err) {
    console.error("Kitchen orders failed:", err);
    res.status(500).json({ error: "Failed to load kitchen orders" });
  }
});

//Update order status on order food items
router.patch("/order-items/:orderItemId/status", async (req, res) => {
  const { orderItemId } = req.params;
  const { status } = req.body;

  if (!["pending", "preparing", "served"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const result = await pool.query(
    `
    UPDATE order_items
    SET status = $1
    WHERE id = $2
    RETURNING *
    `,
    [status, orderItemId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Order item not found" });
  }

  res.json(result.rows[0]);
});


//Update quantity OR delete item
// PATCH /order-items/:id
router.patch("/order-items/:id", async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  try {
    if (quantity <= 0) {
      await pool.query(
        `DELETE FROM order_items WHERE id = $1`,
        [id]
      );
    } else {
      await pool.query(
        `UPDATE order_items
         SET quantity = $1
         WHERE id = $2`,
        [quantity, id]
      );
    }

    // cleanup empty orders
    await pool.query(`
      DELETE FROM orders
      WHERE id NOT IN (
        SELECT DISTINCT order_id FROM order_items
      )
    `);

    res.json({ success: true });
  } catch (err) {
    console.error("Update order item failed:", err);
    res.status(500).json({ error: "Failed to update item" });
  }
});


// Delete order item
router.delete("/order-items/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      `DELETE FROM order_items WHERE id = $1`,
      [id]
    );

    // cleanup empty orders
    await pool.query(`
      DELETE FROM orders
      WHERE id NOT IN (
        SELECT DISTINCT order_id FROM order_items
      )
    `);

    res.json({ success: true });
  } catch (err) {
    console.error("Delete order item failed:", err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});


/*DEPRECATE orders.status to send individual food items to kitchen
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
});*/

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
  `
  UPDATE order_items
  SET status = 'served'
  WHERE order_id IN (
    SELECT id FROM orders WHERE session_id = $1
  )
  `,
  [sessionId]
);


  res.json({ message: "Session closed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});



export default router;
