import { Router } from "express";
import pool from "../config/db";
import { sendReceipt } from "../services/emailService";
import { queueKitchenPrintJobs, shouldSendOrderToKitchen } from "../services/kitchenDispatch";
import ExcelJS from "exceljs";

const router = Router();

/**
 * Helper function for payment method display
 */
function getPaymentMethodLabel(method: string | null, paid: boolean): string {
  if (!paid) return 'Unpaid';
  if (method === 'kpay') return 'Paid (KPay)';
  if (method === 'payment-asia') return 'Paid (Payment Asia)';
  return 'Paid';
}

// Place an order
// POST place order (with variants)
// ✅ IMPORTANT: All items in a session belong to a SINGLE order until bill is closed
// If order already exists for session, add items to it. If not, create one.
router.post("/sessions/:sessionId/orders", async (req, res) => {
  const { sessionId } = req.params;
  const { items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: "No items in order" });
  }

  try {
    // Ensure session is active and get restaurant_id
    const sessionRes = await pool.query(
      `
      SELECT restaurant_id FROM table_sessions
      WHERE id = $1 AND ended_at IS NULL
      `,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) {
      return res.status(400).json({ error: "Session is closed" });
    }

    const restaurantId = sessionRes.rows[0].restaurant_id;

    // ============================================================
    // SINGLE ORDER PER SESSION: Check if order already exists
    // ============================================================
    // All items in a session belong to ONE order
    // This order is created when first items are added, then reused
    let orderId: number;
    const existingOrderRes = await pool.query(
      `
      SELECT o.id FROM orders o
      JOIN table_sessions ts ON o.session_id = ts.id
      WHERE o.session_id = $1 AND ts.ended_at IS NULL AND o.status <> 'completed'
      ORDER BY o.created_at ASC
      LIMIT 1
      `,
      [sessionId]
    );

    if ((existingOrderRes.rowCount ?? 0) > 0) {
      // Reuse existing order for this session
      orderId = existingOrderRes.rows[0].id;
      console.log(`[Orders] 📝 Using existing order ${orderId} for session ${sessionId}`);
    } else {
      // Create new order for this session (first time items are added)
      const orderRes = await pool.query(
        `
        INSERT INTO orders (session_id, restaurant_id)
        VALUES ($1, $2)
        RETURNING id
        `,
        [sessionId, restaurantId]
      );
      orderId = orderRes.rows[0].id;
      console.log(`[Orders] ✨ Created new order ${orderId} for session ${sessionId}`);
    }

    // ✅ LOOP STARTS HERE — item is now defined
    for (const item of items) {
      const optionIds: number[] = item.selected_option_ids || [];
      const isCustomItem = !item.menu_item_id && item.custom_item_name;

      let finalUnitPrice: number;
      let itemNameSnapshot: string;

      if (isCustomItem) {
        /* Custom free-text item — no DB lookup needed */
        finalUnitPrice = item.price_cents || 0;
        itemNameSnapshot = item.custom_item_name;
      } else {
        /* ------------------------------
           VARIANT RULE VALIDATION
        ------------------------------ */

        // Load variants for this menu item
        const variantsRes = await pool.query(
          `SELECT id, required, min_select, max_select FROM menu_item_variants WHERE menu_item_id = $1`,
          [item.menu_item_id]
        );
        const variants = variantsRes.rows;

        // Load selected options → variant mapping
        const optionsRes = optionIds.length
          ? await pool.query(
              `SELECT id, variant_id FROM menu_item_variant_options WHERE id = ANY($1::int[])`,
              [optionIds]
            )
          : { rows: [] };

        // Ensure all selected options belong to this menu item
        const validVariantIds = new Set(variants.map((v: any) => v.id));
        for (const o of optionsRes.rows) {
          if (!validVariantIds.has(o.variant_id)) throw new Error("Invalid variant option selected");
        }

        // Group selected options by variant
        const selectedByVariant: Record<number, number[]> = {};
        for (const o of optionsRes.rows) {
          if (!selectedByVariant[o.variant_id]) selectedByVariant[o.variant_id] = [];
          selectedByVariant[o.variant_id]!.push(o.id);
        }

        // Validate each variant
        for (const v of variants) {
          const selected = selectedByVariant[v.id] || [];
          const count = selected.length;
          if (v.required && count === 0) throw new Error(`Required variant "${v.id}" not selected`);
          if (v.min_select !== null && count < v.min_select) throw new Error(`Must select at least ${v.min_select} option(s)`);
          if (v.max_select !== null && count > v.max_select) throw new Error(`You can select at most ${v.max_select} option(s)`);
        }

        /* ------------------------------
           Calculate price
        ------------------------------ */
        const basePriceRes = await pool.query(
          `SELECT price_cents, name FROM menu_items WHERE id = $1 AND available = true`,
          [item.menu_item_id]
        );

        if (basePriceRes.rowCount === 0) throw new Error("Menu item unavailable");

        const basePrice = Number(basePriceRes.rows[0].price_cents);
        itemNameSnapshot = basePriceRes.rows[0].name;

        let variantExtra = 0;
        if (optionIds.length > 0) {
          const variantPriceRes = await pool.query(
            `SELECT COALESCE(SUM(price_cents), 0) AS extra FROM menu_item_variant_options WHERE id = ANY($1::int[])`,
            [optionIds]
          );
          variantExtra = Number(variantPriceRes.rows[0].extra);
        }

        finalUnitPrice = basePrice + variantExtra;
      }

      /* ------------------------------
         Insert order item
      ------------------------------ */
      const orderItemRes = await pool.query(
        `
        INSERT INTO order_items
          (order_id, menu_item_id, quantity, price_cents, status, restaurant_id, notes, custom_item_name, item_name_snapshot)
        VALUES
          ($1, $2, $3, $4, 'pending', $5, $6, $7, $8)
        RETURNING id
        `,
        [
          orderId,
          isCustomItem ? null : item.menu_item_id,
          item.quantity,
          finalUnitPrice,
          restaurantId,
          item.notes || null,
          isCustomItem ? item.custom_item_name : null,
          itemNameSnapshot,
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

      /* ------------------------------
         Handle addons if provided
      ------------------------------ */
      const addons = item.addons || [];
      for (const addon of addons) {
        const addonRes = await pool.query(
          `
          SELECT a.addon_item_id, a.addon_discount_price_cents, a.addon_name,
                 mi.category_id
          FROM addons a
          JOIN menu_items mi ON a.addon_item_id = mi.id
          WHERE a.id = $1 AND a.restaurant_id = $2 AND a.is_available = true
          `,
          [addon.addon_id, restaurantId]
        );

        if (addonRes.rowCount === 0) {
          throw new Error(`Addon ${addon.addon_id} not found or unavailable`);
        }

        const addonData = addonRes.rows[0];

        // Insert addon as a child order item
        const addonItemRes = await pool.query(
          `
          INSERT INTO order_items
            (order_id, menu_item_id, quantity, price_cents, status, restaurant_id, 
             is_addon, parent_order_item_id, addon_id, print_category_id)
          VALUES
            ($1, $2, $3, $4, 'pending', $5, true, $6, $7, $8)
          RETURNING id
          `,
          [
            orderId,
            addonData.addon_item_id,
            addon.quantity || 1,
            addonData.addon_discount_price_cents,
            restaurantId,
            orderItemId,
            addon.addon_id,
            addonData.category_id
          ]
        );

        // Insert addon variant selections if provided
        const addonOrderItemId = addonItemRes.rows[0].id;
        const addonOptionIds = addon.selected_option_ids || [];
        for (const optionId of addonOptionIds) {
          await pool.query(
            `INSERT INTO order_item_variants (order_item_id, variant_option_id) VALUES ($1, $2)`,
            [addonOrderItemId, optionId]
          );
        }
      }
    }

    // In Payment Asia Order & Pay mode, keep the normal diner flow but defer kitchen dispatch until payment succeeds.
    try {
      const shouldDispatchToKitchen = await shouldSendOrderToKitchen(orderId, restaurantId);

      if (shouldDispatchToKitchen) {
        await queueKitchenPrintJobs(orderId, restaurantId);
      } else {
        console.log(`[Orders] Deferring kitchen dispatch for unpaid Payment Asia order ${orderId}`);
      }
    } catch (autoPrintErr: any) {
      console.warn('[Orders] Auto-print error (non-blocking):', autoPrintErr.message);
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
        o.status AS order_status,
        o.payment_method AS order_payment_method,
        o.restaurant_order_number,
        o.chuio_order_reference AS order_reference,
        oi.status AS item_status,
        to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,

        oi.id AS order_item_id,
        oi.parent_order_item_id,
        oi.is_addon,
        oi.quantity,
        oi.price_cents AS unit_price_cents,

        COALESCE(oi.custom_item_name, oi.item_name_snapshot, mi.name, 'Deleted Item') AS item_name,
        COALESCE(ts.restaurant_id, mc.restaurant_id) AS restaurant_id,

        COALESCE(
          STRING_AGG(
            DISTINCT v.name || ': ' || vo.name,
            ', '
          ),
          ''
        ) AS variants

      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      JOIN table_sessions ts ON o.session_id = ts.id
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id

      LEFT JOIN order_item_variants oiv ON oiv.order_item_id = oi.id
      LEFT JOIN menu_item_variant_options vo ON vo.id = oiv.variant_option_id
      LEFT JOIN menu_item_variants v ON v.id = vo.variant_id
       
      WHERE o.session_id = $1

      GROUP BY
        o.id,
        o.status,
        o.payment_method,
        o.created_at,
        oi.id,
        oi.parent_order_item_id,
        oi.is_addon,
        oi.quantity,
        oi.price_cents,
        oi.custom_item_name,
        oi.item_name_snapshot,
        mi.name,
        ts.restaurant_id,
        mc.restaurant_id

      ORDER BY o.created_at ASC, oi.parent_order_item_id ASC NULLS FIRST, oi.id ASC
      `,
      [sessionId]
    );

    // Group into orders and handle addon items
    const ordersMap: any = {};
    const itemsMap: any = {};

    for (const row of result.rows) {
      if (!ordersMap[row.order_id]) {
        ordersMap[row.order_id] = {
          order_id: row.order_id,
          order_status: row.order_status,
          order_payment_method: row.order_payment_method,
          restaurant_order_number: row.restaurant_order_number,
          order_reference: row.order_reference,
          created_at: row.created_at,
          restaurant_id: row.restaurant_id,
          items: [],
          total_cents: 0
        };
      }

      // Skip rows with no order items (LEFT JOIN produced null)
      if (!row.order_item_id) continue;

      const itemTotal =
        Number(row.unit_price_cents) * Number(row.quantity);

      const itemObj = {
        order_item_id: row.order_item_id,
        menu_item_name: row.item_name,
        quantity: row.quantity,
        status: row.item_status,
        unit_price_cents: row.unit_price_cents,
        item_total_cents: itemTotal,
        variants: row.variants,
        is_addon: row.is_addon,
        addons: []
      };

      itemsMap[row.order_item_id] = itemObj;

      if (!row.is_addon && !row.parent_order_item_id) {
        // Main item
        ordersMap[row.order_id].items.push(itemObj);
        ordersMap[row.order_id].total_cents += itemTotal;
      }
    }

    // Link addons to their parent items
    for (const row of result.rows) {
      if (row.is_addon && row.parent_order_item_id) {
        const parentItem = itemsMap[row.parent_order_item_id];
        if (parentItem) {
          const addonTotal = Number(row.unit_price_cents) * Number(row.quantity);
          parentItem.addons.push({
            order_item_id: row.order_item_id,
            menu_item_name: row.item_name,
            quantity: row.quantity,
            unit_price_cents: row.unit_price_cents,
            item_total_cents: addonTotal,
            status: row.item_status,
            variants: row.variants || ''
          });
          // Add addon price to total for parent order
          const parentOrder = ordersMap[result.rows.find(r => r.order_item_id === row.parent_order_item_id)?.order_id];
          if (parentOrder) {
            parentOrder.total_cents += addonTotal;
          }
        }
      }
    }

    res.json({
      items: Object.values(ordersMap)
    });
  } catch (err) {
    console.error("Failed to load session orders:", err);
    res.status(500).json({ error: "Failed to load orders" });
  }
});


// GET all active orders for kitchen - ✅ FILTERED BY RESTAURANT
router.get("/kitchen/items", async (req, res) => {
  try {
    const { restaurantId } = req.query;

    if (!restaurantId) {
      return res.status(400).json({ error: "Restaurant ID is required" });
    }

    console.log("🔄 Fetching kitchen orders for restaurant:", restaurantId);
    const result = await pool.query(
      `
      SELECT
        oi.id AS order_item_id,
        oi.status,
        oi.quantity,
        oi.is_addon,
        oi.parent_order_item_id,

        COALESCE(oi.custom_item_name, oi.item_name_snapshot, mi.name) AS item_name,
        COALESCE(mi.category_id, -1) AS category_id,

        COALESCE(tu.display_name, 'Unknown Table') AS table_name,
        ts.order_type,
        o.id AS order_id,
        o.restaurant_order_number,
        ts.id AS session_id,
        ts.restaurant_id,
        to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,

        COALESCE(
          STRING_AGG(
            DISTINCT v.name || ': ' || vo.name,
            ', '
          ),
          ''
        ) AS variants,

        oi.notes

      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN table_sessions ts ON o.session_id = ts.id
      JOIN restaurants r ON ts.restaurant_id = r.id
      LEFT JOIN table_units tu ON ts.table_unit_id = tu.id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id

      LEFT JOIN order_item_variants oiv ON oiv.order_item_id = oi.id
      LEFT JOIN menu_item_variant_options vo ON vo.id = oiv.variant_option_id
      LEFT JOIN menu_item_variants v ON v.id = vo.variant_id

      WHERE oi.status != 'served'
      AND ts.restaurant_id = $1
      AND (
        r.active_payment_vendor <> 'payment-asia'
        OR r.active_payment_terminal_id IS NULL
        OR COALESCE(r.payment_asia_order_pay_enabled, true) = false
        OR (o.payment_method = 'payment-asia' AND o.status = 'completed')
      )

      GROUP BY
        oi.id,
        oi.status,
        oi.quantity,
        oi.is_addon,
        oi.parent_order_item_id,
        mi.name,
        mi.category_id,
        tu.display_name,
        ts.order_type,
        o.id,
        o.restaurant_order_number,
        ts.id,
        ts.restaurant_id,
        o.created_at,
        oi.notes

      ORDER BY o.created_at ASC, oi.parent_order_item_id ASC NULLS FIRST, oi.id ASC
      `,
      [restaurantId]
    );

    console.log(`📦 Found ${result.rows.length} kitchen orders for restaurant ${restaurantId}`);
    if (result.rows.length > 0) {
      console.log("Sample order:", result.rows[0]);
    }

    res.json(
      result.rows.map(row => ({
        order_item_id: row.order_item_id,
        order_id: row.order_id,
        restaurant_order_number: row.restaurant_order_number,
        session_id: row.session_id,
        table_name: row.table_name,
        order_type: row.order_type,
        menu_item_name: row.item_name,
        category_id: row.category_id,
        quantity: row.quantity,
        status: row.status,
        variants: row.variants,
        notes: row.notes,
        created_at: row.created_at,
        restaurant_id: row.restaurant_id,
        is_addon: row.is_addon || false,
        parent_order_item_id: row.parent_order_item_id || null
      }))
    );
  } catch (err: any) {
    console.error("❌ Kitchen orders failed:", err);
    console.error("Error details:", err.message, err.code);
    res.status(500).json({ error: err.message || "Failed to load kitchen orders" });
  }
});


//Update order status on order food items - ✅ MULTI-RESTAURANT SUPPORT
router.patch("/order-items/:orderItemId/status", async (req, res) => {
  const { orderItemId } = req.params;
  const { status, restaurantId } = req.body;

  if (!["pending", "preparing", "ready", "served"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  if (!restaurantId) {
    return res.status(400).json({ error: "Restaurant ID is required" });
  }

  try {
    // Verify order item belongs to restaurant
    const orderCheck = await pool.query(
      `SELECT oi.id FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN table_sessions ts ON o.session_id = ts.id
       WHERE oi.id = $1 AND ts.restaurant_id = $2`,
      [orderItemId, restaurantId]
    );

    if (orderCheck.rowCount === 0) {
      return res.status(404).json({ error: "Order item not found or doesn't belong to this restaurant" });
    }

    // Fetch current status before updating (for history log)
    const currentItem = await pool.query(
      `SELECT status, order_id FROM order_items WHERE id = $1`,
      [orderItemId]
    );

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

    // Log status change to history table (best-effort, non-blocking)
    if (currentItem.rowCount! > 0) {
      const prev = currentItem.rows[0];
      pool.query(
        `INSERT INTO order_item_status_history (order_item_id, order_id, restaurant_id, from_status, to_status)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderItemId, prev.order_id, restaurantId, prev.status, status]
      ).catch((e: Error) => console.error("[status-history] insert failed:", e.message));
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update order status failed:", err);
    res.status(500).json({ error: "Failed to update order status" });
  }
});


//Update quantity OR delete item
// PATCH /order-items/:id
router.patch("/order-items/:id", async (req, res) => {
  const { id } = req.params;
  const { quantity, restaurantId } = req.body;

  if (!restaurantId) {
    return res.status(400).json({ error: "Restaurant ID is required" });
  }

  try {
    // Verify order item belongs to restaurant
    const checkRes = await pool.query(
      `SELECT oi.id FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN table_sessions ts ON ts.id = o.session_id
       WHERE oi.id = $1 AND ts.restaurant_id = $2`,
      [id, restaurantId]
    );

    if (checkRes.rowCount === 0) {
      return res.status(403).json({ error: "Order item not found or doesn't belong to this restaurant" });
    }

    // Get the order_id before potentially deleting the item
    const orderIdRes = await pool.query(
      `SELECT order_id FROM order_items WHERE id = $1`,
      [id]
    );
    const orderId = orderIdRes.rows[0]?.order_id;

    if (quantity <= 0) {
      await pool.query(
        `DELETE FROM order_items WHERE id = $1`,
        [id]
      );

      // cleanup only THIS order if it became empty
      if (orderId) {
        await pool.query(`
          DELETE FROM orders
          WHERE id = $1
          AND NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = $1)
        `, [orderId]);
      }
    } else {
      await pool.query(
        `UPDATE order_items
         SET quantity = $1
         WHERE id = $2`,
        [quantity, id]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Update order item failed:", err);
    res.status(500).json({ error: "Failed to update item" });
  }
});


// Delete order item
router.delete("/order-items/:id", async (req, res) => {
  const { id } = req.params;
  const { restaurantId } = req.body;

  if (!restaurantId) {
    return res.status(400).json({ error: "Restaurant ID is required" });
  }

  try {
    // Verify order item belongs to restaurant
    const checkRes = await pool.query(
      `SELECT oi.id FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN table_sessions ts ON ts.id = o.session_id
       WHERE oi.id = $1 AND ts.restaurant_id = $2`,
      [id, restaurantId]
    );

    if (checkRes.rowCount === 0) {
      return res.status(403).json({ error: "Order item not found or doesn't belong to this restaurant" });
    }

    // Get the order_id before deleting the item
    const orderIdRes = await pool.query(
      `SELECT order_id FROM order_items WHERE id = $1`,
      [id]
    );
    const orderId = orderIdRes.rows[0]?.order_id;

    await pool.query(
      `DELETE FROM order_items WHERE id = $1`,
      [id]
    );

    // cleanup only THIS order if it became empty
    if (orderId) {
      await pool.query(`
        DELETE FROM orders
        WHERE id = $1
        AND NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = $1)
      `, [orderId]);
    }

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

// Close a session - ✅ MULTI-RESTAURANT SUPPORT
router.post("/sessions/:sessionId/close", async (req, res) => {
    try {
  const { sessionId } = req.params;
  const { restaurantId } = req.body;

  if (!restaurantId) {
    return res.status(400).json({ error: "Restaurant ID is required" });
  }

  // Check if session exists, is open, and belongs to restaurant
  const sessionResult = await pool.query(
    `SELECT ts.id, t.restaurant_id FROM table_sessions ts
     JOIN tables t ON t.id = ts.table_id
     WHERE ts.id = $1 AND ts.ended_at IS NULL AND t.restaurant_id = $2`,
    [sessionId, restaurantId]
  );

  if (sessionResult.rowCount === 0) {
    return res.status(404).json({ error: "Session not found, already closed, or doesn't belong to this restaurant" });
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

// ✅ GET all orders for a restaurant (for history/reporting)
router.get("/restaurants/:restaurantId/orders", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { limit } = req.query;
    const limitVal = limit ? parseInt(limit as string) : 20;

    if (!restaurantId) {
      return res.status(400).json({ error: "Restaurant ID is required" });
    }

    // Get orders from database
    const result = await pool.query(
      `SELECT
        o.id,
        o.restaurant_order_number,
        o.session_id,
        o.status,
        (o.status = 'completed') AS payment_received,
        o.payment_method AS payment_method_online,
        o.chuio_order_reference AS kpay_reference_id,
        o.payment_status,
        o.restaurant_id,
        to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
        COALESCE(ts.order_type, 'counter') AS order_type,
        ts.table_id,
        COALESCE(t.name, '') as table_name,
        COALESCE(ts.customer_name, '') as customer_name,
        COALESCE(ts.customer_phone, '') as customer_phone,
        COALESCE(ts.pax, 0) as pax,
        COALESCE(ts.discount_applied, 0) as discount_cents,
        COUNT(oi.id) as item_count,
        COALESCE(SUM(oi.price_cents * oi.quantity), 0) as subtotal_cents,
        ROUND(COALESCE(SUM(oi.price_cents * oi.quantity), 0) * (1 + COALESCE(r.service_charge_percent, 0) / 100.0)) as total_cents,
        COALESCE(array_agg(DISTINCT mi.name) FILTER (WHERE mi.name IS NOT NULL), '{}') AS item_names,
        COALESCE(array_agg(DISTINCT mc.name) FILTER (WHERE mc.name IS NOT NULL), '{}') AS category_names,
        u.name AS closed_by_staff_name,
        kt.status as kpay_status,
        to_char(kt.completed_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS kpay_completed_at,
        kt.refund_amount_cents,
        kt.pay_method AS kpay_pay_method,
        COALESCE(
          (SELECT pat.network FROM payment_asia_transactions pat WHERE pat.merchant_reference = o.chuio_order_reference AND pat.transaction_type = 'payment' ORDER BY pat.created_at DESC LIMIT 1),
          (SELECT pcp.payment_method FROM chuio_payments pcp WHERE pcp.order_reference = o.chuio_order_reference AND pcp.payment_vendor = 'payment-asia' LIMIT 1)
        ) AS payment_network,
        cpay.payment_vendor AS cp_vendor,
        cpay.payment_method AS cp_method,
        cpay.status AS cp_status,
        cpay.vendor_reference AS cp_vendor_ref,
        cpay.total_cents AS cp_total_cents,
        cpay.payment_gateway_env AS cp_env,
        to_char(cpay.completed_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS cp_completed_at
      FROM orders o
      JOIN restaurants r ON r.id = o.restaurant_id
      LEFT JOIN table_sessions ts ON o.session_id = ts.id
      LEFT JOIN tables t ON ts.table_id = t.id
      LEFT JOIN order_items oi ON o.id = oi.order_id AND oi.removed = false
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      LEFT JOIN users u ON u.id = ts.closed_by_staff_id
      LEFT JOIN kpay_transactions kt ON kt.order_id = o.id
      LEFT JOIN LATERAL (
        SELECT payment_vendor, payment_method, status, vendor_reference, total_cents, payment_gateway_env, completed_at
        FROM chuio_payments
        WHERE order_id = o.id
        ORDER BY created_at DESC
        LIMIT 1
      ) cpay ON true
      WHERE o.restaurant_id = $1
      GROUP BY o.id, o.restaurant_order_number, o.session_id, o.status, o.payment_method, o.chuio_order_reference, o.payment_status, o.restaurant_id, o.created_at, ts.order_type, ts.table_id, t.name, ts.customer_name, ts.customer_phone, ts.pax, ts.discount_applied, kt.status, kt.completed_at, kt.refund_amount_cents, kt.pay_method, r.service_charge_percent, cpay.payment_vendor, cpay.payment_method, cpay.status, cpay.vendor_reference, cpay.total_cents, cpay.payment_gateway_env, cpay.completed_at, u.name
      ORDER BY o.created_at DESC
      LIMIT $2`,
      [restaurantId, limitVal]
    );

    const orders = result.rows.map(order => ({
      ...order,
      payment_method_label: getPaymentMethodLabel(order.payment_method_online, order.payment_received)
    }));

    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ GET specific order details with unified payment handling
router.get("/restaurants/:restaurantId/orders/:orderId", async (req, res) => {
  try {
    const { restaurantId, orderId } = req.params;

    // Get order header with payment information
    const orderRes = await pool.query(
      `
      SELECT
        o.id,
        o.restaurant_order_number,
        o.session_id,
        o.status,
        (o.status = 'completed') AS payment_received,
        o.payment_method AS payment_method_online,
        o.chuio_order_reference AS kpay_reference_id,
        o.payment_status,
        to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
        SUM(oi.price_cents * oi.quantity) as total_cents,
        COALESCE(ts.order_type, 'counter') AS order_type,
        ts.table_id,
        COALESCE(t.name, '') as table_name,
        COALESCE(ts.customer_name, '') as customer_name,
        COALESCE(ts.customer_phone, '') as customer_phone,
        COALESCE(
          (SELECT pat.network FROM payment_asia_transactions pat WHERE pat.merchant_reference = o.chuio_order_reference AND pat.transaction_type = 'payment' ORDER BY pat.created_at DESC LIMIT 1),
          (SELECT pcp.payment_method FROM chuio_payments pcp WHERE pcp.order_reference = o.chuio_order_reference AND pcp.payment_vendor = 'payment-asia' LIMIT 1)
        ) AS payment_network,
        (SELECT kt2.pay_method FROM kpay_transactions kt2 WHERE kt2.order_id = o.id ORDER BY kt2.created_at DESC LIMIT 1) AS kpay_pay_method,
        cpay.payment_vendor AS cp_vendor,
        cpay.payment_method AS cp_method,
        cpay.status AS cp_status,
        cpay.vendor_reference AS cp_vendor_ref,
        cpay.total_cents AS cp_total_cents,
        cpay.payment_gateway_env AS cp_env,
        to_char(cpay.completed_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS cp_completed_at,
        to_char(cpay.refunded_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS cp_refunded_at,
        cpay.refund_amount_cents AS cp_refund_amount_cents
      FROM orders o
      LEFT JOIN table_sessions ts ON o.session_id = ts.id
      LEFT JOIN tables t ON ts.table_id = t.id
      LEFT JOIN order_items oi ON o.id = oi.order_id AND oi.removed = false
      LEFT JOIN LATERAL (
        SELECT payment_vendor, payment_method, status, vendor_reference, total_cents, payment_gateway_env, completed_at, refunded_at, refund_amount_cents
        FROM chuio_payments
        WHERE order_id = o.id
        ORDER BY created_at DESC
        LIMIT 1
      ) cpay ON true
      WHERE o.id = $1 AND o.restaurant_id = $2
      GROUP BY o.id, o.restaurant_order_number, o.session_id, o.status, o.payment_method, o.chuio_order_reference, o.payment_status, o.created_at, ts.order_type, ts.table_id, t.name, ts.customer_name, ts.customer_phone, cpay.payment_vendor, cpay.payment_method, cpay.status, cpay.vendor_reference, cpay.total_cents, cpay.payment_gateway_env, cpay.completed_at, cpay.refunded_at, cpay.refund_amount_cents
      `,
      [orderId, restaurantId]
    );

    if (orderRes.rowCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderRes.rows[0];

    // Get order items with variants
    const itemsRes = await pool.query(
      `
      SELECT
        oi.id,
        oi.order_id,
        oi.menu_item_id,
        oi.quantity,
        oi.price_cents,
        (oi.price_cents * oi.quantity) as item_total_cents,
        oi.status,
        oi.is_addon,
        oi.parent_order_item_id,
        COALESCE(oi.custom_item_name, oi.item_name_snapshot, mi.name) as menu_item_name,
        mi.image_url,
        STRING_AGG(
          DISTINCT vo.id::text,
          ','
        ) as variant_option_ids,
        STRING_AGG(
          DISTINCT v.name || ':' || vo.name,
          '; '
        ) as variants
      FROM order_items oi
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      LEFT JOIN order_item_variants oiv ON oiv.order_item_id = oi.id
      LEFT JOIN menu_item_variant_options vo ON vo.id = oiv.variant_option_id
      LEFT JOIN menu_item_variants v ON v.id = vo.variant_id
      WHERE oi.order_id = $1 AND oi.removed = false
      GROUP BY oi.id, oi.order_id, oi.menu_item_id, oi.quantity, oi.price_cents, oi.status, oi.is_addon, oi.parent_order_item_id, oi.custom_item_name, oi.item_name_snapshot, mi.name, mi.image_url
      ORDER BY oi.parent_order_item_id ASC NULLS FIRST, oi.id ASC
      `,
      [orderId]
    );

    // Group addon items under their parent items
    const mainItems: any[] = [];
    const itemsById: Record<number, any> = {};
    for (const row of itemsRes.rows) {
      row.addons = [];
      itemsById[row.id] = row;
      if (!row.is_addon) {
        mainItems.push(row);
      }
    }
    for (const row of itemsRes.rows) {
      if (row.is_addon && row.parent_order_item_id && itemsById[row.parent_order_item_id]) {
        itemsById[row.parent_order_item_id].addons.push({
          order_item_id: row.id,
          menu_item_name: row.menu_item_name,
          quantity: row.quantity,
          unit_price_cents: row.price_cents,
          item_total_cents: row.item_total_cents,
          status: row.status,
          variants: row.variants || '',
        });
      }
    }
    order.items = mainItems;

    // Get all chuio_payments records for this order (full ledger)
    const paymentsLedgerRes = await pool.query(
      `SELECT
        id,
        payment_vendor,
        payment_method,
        payment_gateway_env,
        order_reference,
        vendor_reference,
        amount_cents,
        currency_code,
        total_cents,
        status,
        refund_amount_cents,
        to_char(refunded_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS refunded_at,
        refund_reference,
        to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
        to_char(completed_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS completed_at,
        to_char(failed_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS failed_at
       FROM chuio_payments
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [orderId]
    );
    order.payment_records = paymentsLedgerRes.rows;

    // Add payment method label
    order.payment_method_label = getPaymentMethodLabel(order.payment_method_online, order.payment_received);

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /restaurants/:restaurantId/orders/:orderId/void
 * Mark a non-KPay order as voided (cash/card manual correction)
 */
router.post("/restaurants/:restaurantId/orders/:orderId/void", async (req, res) => {
  try {
    const { restaurantId, orderId } = req.params;
    const orderRes = await pool.query(
      `SELECT o.id, o.payment_method, o.payment_status
       FROM orders o
       WHERE o.id = $1 AND o.restaurant_id = $2`,
      [orderId, restaurantId]
    );
    if (orderRes.rowCount === 0) return res.status(404).json({ error: "Order not found" });
    const order = orderRes.rows[0];
    if (order.payment_method === 'kpay') {
      return res.status(400).json({ error: "Use the KPay void endpoint for KPay orders" });
    }
    await pool.query(
      `UPDATE orders SET payment_status = 'voided' WHERE id = $1`,
      [orderId]
    );
    res.json({ success: true, payment_status: 'voided' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /restaurants/:restaurantId/orders/:orderId/refund
 * Mark a non-KPay order as refunded (cash/card manual correction)
 */
router.post("/restaurants/:restaurantId/orders/:orderId/refund", async (req, res) => {
  try {
    const { restaurantId, orderId } = req.params;
    const { refund_amount_cents } = req.body;
    const orderRes = await pool.query(
      `SELECT o.id, o.payment_method, o.payment_status
       FROM orders o
       WHERE o.id = $1 AND o.restaurant_id = $2`,
      [orderId, restaurantId]
    );
    if (orderRes.rowCount === 0) return res.status(404).json({ error: "Order not found" });
    const order = orderRes.rows[0];
    if (order.payment_method === 'kpay') {
      return res.status(400).json({ error: "Use the KPay refund endpoint for KPay orders" });
    }
    const newStatus = refund_amount_cents ? 'partial_refund' : 'refunded';
    await pool.query(
      `UPDATE orders SET payment_status = $1 WHERE id = $2`,
      [newStatus, orderId]
    );
    res.json({ success: true, payment_status: newStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send receipt email
router.post("/restaurants/:restaurantId/orders/:orderId/send-receipt", async (req, res) => {
  const { restaurantId, orderId } = req.params;
  const { email, content } = req.body;

  // Validate input
  if (!email || !content) {
    return res.status(400).json({ error: "Email and content are required" });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  try {
    // Verify order exists and belongs to restaurant
    const orderRes = await pool.query(
      `SELECT id, restaurant_order_number FROM orders WHERE id = $1 AND restaurant_id = $2`,
      [orderId, restaurantId]
    );

    if (orderRes.rowCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderRes.rows[0];

    // Get restaurant name for email
    const restaurantRes = await pool.query(
      `SELECT name FROM restaurants WHERE id = $1`,
      [restaurantId]
    );

    const restaurantName = restaurantRes.rows[0]?.name || "Restaurant";

    // Send receipt email
    const result = await sendReceipt({
      toEmail: email,
      orderNumber: order.restaurant_order_number || orderId,
      content: content,
      restaurantName: restaurantName,
    });

    if (result.success) {
      res.json({
        success: true,
        message: "Receipt sent successfully",
        messageId: result.messageId,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || "Failed to send receipt",
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// ============================================================
// ANALYTICS ENDPOINTS
// ============================================================

/**
 * GET /restaurants/:restaurantId/reports/top-items
 * Returns top 10 best-selling menu items by quantity ordered
 */
router.get("/restaurants/:restaurantId/reports/top-items", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { days } = req.query;
    const daysBack = days ? parseInt(days as string, 10) : 30;

    const result = await pool.query(
      `SELECT
        COALESCE(oi.custom_item_name, oi.item_name_snapshot, mi.name, 'Deleted Item') AS item_name,
        SUM(oi.quantity) AS total_qty,
        SUM(oi.price_cents * oi.quantity) AS total_revenue_cents
      FROM order_items oi
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id = $1
        AND oi.removed = false
        AND oi.is_addon = false
        AND o.created_at >= NOW() - ($2::int * INTERVAL '1 day')
      GROUP BY COALESCE(oi.custom_item_name, oi.item_name_snapshot, mi.name, 'Deleted Item')
      ORDER BY total_qty DESC
      LIMIT 10`,
      [restaurantId, daysBack]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("[top-items]", err);
    res.status(500).json({ error: "Failed to load top items" });
  }
});

/**
 * GET /restaurants/:restaurantId/reports/top-tables
 * Returns top 10 busiest tables by order count and revenue
 */
router.get("/restaurants/:restaurantId/reports/top-tables", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { days } = req.query;
    const daysBack = days ? parseInt(days as string, 10) : 30;

    const result = await pool.query(
      `SELECT
        COALESCE(t.name, 'Counter') AS table_name,
        COUNT(DISTINCT o.id) AS order_count,
        SUM(oi.price_cents * oi.quantity) AS total_revenue_cents
      FROM orders o
      LEFT JOIN table_sessions ts ON o.session_id = ts.id
      LEFT JOIN tables t ON ts.table_id = t.id
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.restaurant_id = $1
        AND oi.removed = false
        AND o.created_at >= NOW() - ($2::int * INTERVAL '1 day')
      GROUP BY COALESCE(t.name, 'Counter')
      ORDER BY order_count DESC
      LIMIT 10`,
      [restaurantId, daysBack]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("[top-tables]", err);
    res.status(500).json({ error: "Failed to load top tables" });
  }
});

/**
 * GET /restaurants/:restaurantId/reports/sales-by-item
 * Returns sales breakdown by menu item
 */
router.get("/restaurants/:restaurantId/reports/sales-by-item", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { days } = req.query;
    const daysBack = days ? parseInt(days as string, 10) : 30;

    const result = await pool.query(
      `SELECT
        COALESCE(oi.custom_item_name, oi.item_name_snapshot, mi.name, 'Deleted Item') AS item_name,
        COALESCE(mc.name, 'Custom') AS category_name,
        SUM(oi.quantity) AS total_qty,
        SUM(oi.price_cents * oi.quantity) AS total_revenue_cents,
        COUNT(DISTINCT o.id) AS order_count
      FROM order_items oi
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id = $1
        AND oi.removed = false
        AND oi.is_addon = false
        AND o.created_at >= NOW() - ($2::int * INTERVAL '1 day')
      GROUP BY COALESCE(oi.custom_item_name, oi.item_name_snapshot, mi.name, 'Deleted Item'), COALESCE(mc.name, 'Custom')
      ORDER BY total_revenue_cents DESC`,
      [restaurantId, daysBack]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[sales-by-item]", err);
    res.status(500).json({ error: "Failed to load sales by item" });
  }
});

/**
 * GET /restaurants/:restaurantId/reports/sales-by-category
 * Returns sales breakdown by menu category
 */
router.get("/restaurants/:restaurantId/reports/sales-by-category", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { days } = req.query;
    const daysBack = days ? parseInt(days as string, 10) : 30;

    const result = await pool.query(
      `SELECT
        COALESCE(mc.name, 'Uncategorized') AS category_name,
        SUM(oi.quantity) AS total_qty,
        SUM(oi.price_cents * oi.quantity) AS total_revenue_cents,
        COUNT(DISTINCT o.id) AS order_count,
        COUNT(DISTINCT mi.id) AS unique_items
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id = $1
        AND oi.removed = false
        AND oi.is_addon = false
        AND o.created_at >= NOW() - ($2::int * INTERVAL '1 day')
      GROUP BY COALESCE(mc.name, 'Uncategorized')
      ORDER BY total_revenue_cents DESC`,
      [restaurantId, daysBack]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[sales-by-category]", err);
    res.status(500).json({ error: "Failed to load sales by category" });
  }
});

/**
 * GET /restaurants/:restaurantId/reports/payment-by-type
 * Returns order count and revenue grouped by payment method
 */
router.get("/restaurants/:restaurantId/reports/payment-by-type", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { days } = req.query;
    const daysBack = days ? parseInt(days as string, 10) : 30;

    const result = await pool.query(
      `SELECT
        COALESCE(o.payment_method, 'cash') AS payment_method,
        COUNT(DISTINCT o.id) AS order_count,
        COALESCE(SUM(oi.price_cents * oi.quantity) FILTER (WHERE oi.removed = false), 0) AS total_revenue_cents
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.removed = false
       WHERE o.restaurant_id = $1
         AND o.created_at >= NOW() - ($2::int * INTERVAL '1 day')
       GROUP BY COALESCE(o.payment_method, 'cash')
       ORDER BY total_revenue_cents DESC`,
      [restaurantId, daysBack]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[payment-by-type]", err);
    res.status(500).json({ error: "Failed to load payment type report" });
  }
});

/**
 * GET /restaurants/:restaurantId/reports/staff-hours
 * Returns staff hours summary from timekeeping records
 */
router.get("/restaurants/:restaurantId/reports/staff-hours", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { days } = req.query;
    const daysBack = days ? parseInt(days as string, 10) : 30;

    const result = await pool.query(
      `SELECT
        u.name AS staff_name,
        u.role,
        COUNT(st.id) AS shift_count,
        SUM(COALESCE(st.duration_minutes,
          CASE WHEN st.clock_out_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (st.clock_out_at - st.clock_in_at)) / 60
               ELSE NULL END
        )) AS total_minutes,
        MIN(st.clock_in_at) AS first_shift,
        MAX(COALESCE(st.clock_out_at, st.clock_in_at)) AS last_shift
       FROM staff_timekeeping st
       JOIN users u ON u.id = st.user_id
       WHERE st.restaurant_id = $1
         AND st.clock_in_at >= NOW() - ($2::int * INTERVAL '1 day')
       GROUP BY u.id, u.name, u.role
       ORDER BY total_minutes DESC NULLS LAST`,
      [restaurantId, daysBack]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[staff-hours]", err);
    res.status(500).json({ error: "Failed to load staff hours report" });
  }
});

/**
 * GET /restaurants/:restaurantId/reports/order-status-timing
 * Returns average minutes between status transitions per item
 */
router.get("/restaurants/:restaurantId/reports/order-status-timing", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { days } = req.query;
    const daysBack = days ? parseInt(days as string, 10) : 30;

    // Check table exists first (migration 083 may not have run yet)
    const tableCheck = await pool.query(
      `SELECT to_regclass('public.order_item_status_history') AS t`
    );
    if (!tableCheck.rows[0].t) {
      return res.json({ transitions: [], fastest_items: [] });
    }

    const result = await pool.query(
      `SELECT
        h1.from_status,
        h1.to_status,
        COUNT(*) AS transition_count,
        ROUND(AVG(EXTRACT(EPOCH FROM (h2.changed_at - h1.changed_at)) / 60)::numeric, 1) AS avg_minutes,
        ROUND(MIN(EXTRACT(EPOCH FROM (h2.changed_at - h1.changed_at)) / 60)::numeric, 1) AS min_minutes,
        ROUND(MAX(EXTRACT(EPOCH FROM (h2.changed_at - h1.changed_at)) / 60)::numeric, 1) AS max_minutes
       FROM order_item_status_history h1
       JOIN order_item_status_history h2
         ON h1.order_item_id = h2.order_item_id
        AND h2.id = (
          SELECT id FROM order_item_status_history h3
          WHERE h3.order_item_id = h1.order_item_id
            AND h3.changed_at > h1.changed_at
          ORDER BY h3.changed_at ASC LIMIT 1
        )
       WHERE h1.restaurant_id = $1
         AND h1.changed_at >= NOW() - ($2::int * INTERVAL '1 day')
         AND EXTRACT(EPOCH FROM (h2.changed_at - h1.changed_at)) > 0
       GROUP BY h1.from_status, h1.to_status
       ORDER BY h1.from_status, h1.to_status`,
      [restaurantId, daysBack]
    );

    // Also return per-item averages for top 10 fastest/slowest items
    const itemResult = await pool.query(
      `SELECT
        mi.name AS item_name,
        h1.from_status,
        h1.to_status,
        ROUND(AVG(EXTRACT(EPOCH FROM (h2.changed_at - h1.changed_at)) / 60)::numeric, 1) AS avg_minutes,
        COUNT(*) AS sample_count
       FROM order_item_status_history h1
       JOIN order_item_status_history h2
         ON h1.order_item_id = h2.order_item_id
        AND h2.id = (
          SELECT id FROM order_item_status_history h3
          WHERE h3.order_item_id = h1.order_item_id
            AND h3.changed_at > h1.changed_at
          ORDER BY h3.changed_at ASC LIMIT 1
        )
       JOIN order_items oi ON oi.id = h1.order_item_id
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE h1.restaurant_id = $1
         AND h1.changed_at >= NOW() - ($2::int * INTERVAL '1 day')
         AND h1.from_status = 'preparing' AND h1.to_status = 'ready'
         AND EXTRACT(EPOCH FROM (h2.changed_at - h1.changed_at)) > 0
       GROUP BY mi.name, h1.from_status, h1.to_status
       HAVING COUNT(*) >= 2
       ORDER BY avg_minutes ASC
       LIMIT 10`,
      [restaurantId, daysBack]
    );

    res.json({ transitions: result.rows, fastest_items: itemResult.rows });
  } catch (err) {
    console.error("[order-status-timing]", err);
    res.status(500).json({ error: "Failed to load status timing report" });
  }
});

/**
 * GET /restaurants/:restaurantId/reports/export
 * Returns filtered orders as a CSV file download.
 * Query params: date_from, date_to, period (breakfast|lunch|tea|dinner|custom),
 *               period_from, period_to (HH:MM), order_type (comma-list), pax_min, pax_max
 */
router.get("/restaurants/:restaurantId/reports/export", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { date_from, date_to, period, period_from, period_to, order_type, pax_min, pax_max } = req.query as Record<string, string>;

    // Period presets
    const PERIODS: Record<string, { from: string; to: string }> = {
      breakfast: { from: '07:00', to: '10:30' },
      lunch:     { from: '11:00', to: '15:00' },
      tea:       { from: '15:00', to: '17:30' },
      dinner:    { from: '17:30', to: '23:00' },
    };

    const conditions: string[] = ['o.restaurant_id = $1'];
    const params: any[] = [restaurantId];

    if (date_from) {
      params.push(date_from);
      conditions.push(`o.created_at::date >= $${params.length}`);
    }
    if (date_to) {
      params.push(date_to);
      conditions.push(`o.created_at::date <= $${params.length}`);
    }

    // Time-of-day filter
    let timeFrom: string | null = null;
    let timeTo: string | null = null;
    if (period && PERIODS[period]) {
      timeFrom = PERIODS[period].from;
      timeTo   = PERIODS[period].to;
    } else if (period === 'custom' && period_from && period_to) {
      timeFrom = period_from;
      timeTo   = period_to;
    }
    if (timeFrom && timeTo) {
      params.push(timeFrom); conditions.push(`o.created_at::time >= $${params.length}::time`);
      params.push(timeTo);   conditions.push(`o.created_at::time <= $${params.length}::time`);
    }

    // Dining type
    if (order_type) {
      const types = order_type.split(',').map((t: string) => t.trim()).filter(Boolean);
      if (types.length > 0) {
        params.push(types);
        conditions.push(`ts.order_type = ANY($${params.length}::text[])`);
      }
    }

    // Pax
    if (pax_min) { params.push(parseInt(pax_min)); conditions.push(`ts.pax >= $${params.length}`); }
    if (pax_max) { params.push(parseInt(pax_max)); conditions.push(`ts.pax <= $${params.length}`); }

    const where = conditions.join(' AND ');

    const result = await pool.query(
      `SELECT
         o.id,
         o.restaurant_order_number,
         o.created_at,
         COALESCE(t.name, 'Counter') AS table_label,
         ts.order_type,
         o.status,
         ts.pax,
         (SELECT COALESCE(SUM(oi2.price_cents * oi2.quantity), 0)
          FROM order_items oi2 WHERE oi2.order_id = o.id AND oi2.removed = false) AS subtotal_cents,
         COALESCE(o.discount_cents, 0) AS discount_cents,
         COALESCE(o.total_cents, 0) AS total_cents,
         u.name AS staff_name
       FROM orders o
       JOIN table_sessions ts ON ts.id = o.session_id
       LEFT JOIN tables t ON t.id = ts.table_id
       LEFT JOIN users u ON u.id = o.staff_id
       WHERE ${where}
       ORDER BY o.created_at ASC`,
      params
    );

    // Build CSV
    const CRLF = '\r\n';
    const esc = (v: any) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ['Order ID', 'Date', 'Time', 'Table', 'Order Type', 'Status', 'Pax', 'Subtotal', 'Discount', 'Total', 'Staff'];
    const rows = result.rows.map((r: any) => {
      const d = new Date(r.created_at);
      const dateStr = d.toISOString().slice(0, 10);
      const timeStr = d.toISOString().slice(11, 16);
      return [
        r.restaurant_order_number ?? r.id,
        dateStr,
        timeStr,
        r.table_label,
        r.order_type || '',
        r.status,
        r.pax ?? '',
        (Number(r.subtotal_cents) / 100).toFixed(2),
        (Number(r.discount_cents) / 100).toFixed(2),
        (Number(r.total_cents) / 100).toFixed(2),
        r.staff_name || '',
      ].map(esc).join(',');
    });

    const csv = [headers.join(','), ...rows].join(CRLF) + CRLF;
    const filename = `orders_${date_from || 'all'}_to_${date_to || 'all'}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error("[reports/export]", err);
    res.status(500).json({ error: "Export failed" });
  }
});

// ---------------------------------------------------------------------------
// Payment method display names and canonical keys
// ---------------------------------------------------------------------------
const PM_KEYS = ['cash', 'visa', 'mastercard', 'unionpay', 'octopus', 'payme', 'fps', 'wechat', 'alipay', 'kpay', 'card', 'online', 'other'] as const;
type PmKey = typeof PM_KEYS[number];
const PM_LABELS: Record<PmKey, string> = {
  'cash':       'Cash',
  'visa':       'Visa',
  'mastercard': 'Mastercard',
  'unionpay':   'UnionPay',
  'octopus':    'Octopus',
  'payme':      'PayMe',
  'fps':        'FPS',
  'wechat':     'WeChat Pay',
  'alipay':     'Alipay',
  'kpay':       'KPay',
  'card':       'Card',
  'online':     'Online',
  'other':      'Other',
};

function canonicalPM(raw: string | null): PmKey {
  if (!raw) return 'other';
  const r = raw.toLowerCase().replace(/[\s\-_]/g, '');
  if (r === 'cash') return 'cash';
  if (r === 'visa') return 'visa';
  if (r === 'master' || r === 'mastercard') return 'mastercard';
  if (r === 'unionpay' || r === 'cup') return 'unionpay';
  if (r === 'octopus') return 'octopus';
  if (r === 'payme') return 'payme';
  if (r === 'fps') return 'fps';
  if (r === 'wechatpay' || r === 'wechat' || r === 'wxpay') return 'wechat';
  if (r === 'alipay') return 'alipay';
  if (r === 'creditcard' || r === 'credit') return 'card';
  if (r === 'kpay') return 'kpay';
  if (r === 'card' || r === 'debit' || r === 'debitcard') return 'card';
  if (r === 'online') return 'online';
  if (r === 'paymentasia' || r === 'payasia') return 'online';
  return 'other';
}

// Day-level aggregated data
interface DayData {
  subtotalCents: bigint;
  discountCents: bigint;
  totalCents:    bigint;
  orderCount:    number;
  pax:           number;
  sessionCount:  number;
  bookingsConfirmed: number;
  bookingsCancelled: number;
  payments: Record<PmKey, { qty: number; amountCents: bigint }>;
}

function emptyDayData(): DayData {
  const payments = {} as DayData['payments'];
  for (const k of PM_KEYS) payments[k] = { qty: 0, amountCents: 0n };
  return {
    subtotalCents: 0n, discountCents: 0n, totalCents: 0n,
    orderCount: 0, pax: 0, sessionCount: 0,
    bookingsConfirmed: 0, bookingsCancelled: 0,
    payments,
  };
}

/** Produce a sorted list of YYYY-MM-DD strings in [from, to] inclusive */
function dayRange(from: string, to: string): string[] {
  const days: string[] = [];
  const cur = new Date(from + 'T00:00:00Z');
  const end = new Date(to   + 'T00:00:00Z');
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

/** Format "YYYY-MM-DD" → "YYYY-MM-DD (Mon)" */
function fmtDayLabel(d: string): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dt = new Date(d + 'T00:00:00Z');
  return `${d} (${days[dt.getUTCDay()]})`;
}

function cents2(n: bigint): number { return Number(n) / 100; }

/**
 * Build one worksheet in competitor style.
 *  - Row 1: title row
 *  - Row 2: payment method group headers
 *  - Row 3: column headers
 *  - Rows 4+: data rows (one per day)
 *  - Final row: totals
 */
function buildSheet(
  ws: ExcelJS.Worksheet,
  title: string,
  days: string[],
  dataMap: Map<string, DayData>,
  scRate: number,
  includeBookings: boolean,
) {
  // ---- Column layout ----
  // Fixed cols: Date, Gross Sales, Service Charge, Discount, Net Sales, Orders, Customers, Avg Spending
  // Optionally: Confirmed Bookings, Cancelled Bookings
  // Then per payment method: Qty, Amount  (Cash, KPay, Payment Asia, Other)
  // Last: Total Tendered

  const fixedCols = ['Date', 'Gross Sales', 'Service Charge', 'Discount', 'Net Sales', 'Orders', 'Customers', 'Avg. Spending'];
  const bookingCols = includeBookings ? ['Confirmed Bookings', 'Cancelled Bookings'] : [];
  const pmStartCol = fixedCols.length + bookingCols.length + 1; // 1-based
  // 2 cols per payment method + 1 total
  const totalCols = pmStartCol + PM_KEYS.length * 2; // "Total Tendered" col index (1-based)

  // ---- Row 1: title ----
  const titleRow = ws.addRow([title]);
  ws.mergeCells(1, 1, 1, totalCols);
  titleRow.getCell(1).font = { bold: true, size: 12 };
  titleRow.getCell(1).alignment = { horizontal: 'center' };

  // ---- Row 2: payment method group headers ----
  const pmHeaderRow = ws.addRow([]);
  for (let i = 0; i < PM_KEYS.length; i++) {
    const colIdx = pmStartCol + i * 2; // 1-based
    pmHeaderRow.getCell(colIdx).value = PM_LABELS[PM_KEYS[i] as PmKey];
    pmHeaderRow.getCell(colIdx).font = { bold: true };
    pmHeaderRow.getCell(colIdx).alignment = { horizontal: 'center' };
    if (colIdx + 1 <= totalCols - 1) {
      ws.mergeCells(2, colIdx, 2, colIdx + 1);
    }
  }

  // ---- Row 3: column headers ----
  const headers: string[] = [
    ...fixedCols,
    ...bookingCols,
  ];
  for (const _k of PM_KEYS) {
    headers.push('Qty', '$');
  }
  headers.push('Total Tendered');
  const headerRow = ws.addRow(headers);
  headerRow.eachCell(c => {
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    c.alignment = { horizontal: 'center' };
    c.border = { bottom: { style: 'thin' } };
  });

  // ---- Data rows ----
  const totals = emptyDayData();

  for (const day of days) {
    const d = dataMap.get(day) || emptyDayData();
    const gross = cents2(d.subtotalCents);
    const sc    = gross * scRate;
    const discount = cents2(d.discountCents);
    const net   = cents2(d.totalCents);
    const avgSpend = d.pax > 0 ? +(net / d.pax).toFixed(2) : 0;

    const rowVals: (string | number)[] = [
      fmtDayLabel(day),
      gross, sc, discount, net,
      d.orderCount, d.pax, avgSpend,
    ];
    if (includeBookings) {
      rowVals.push(d.bookingsConfirmed, d.bookingsCancelled);
    }
    for (const k of PM_KEYS) {
      rowVals.push(d.payments[k].qty, cents2(d.payments[k].amountCents));
    }
    rowVals.push(net); // Total Tendered = Net Sales

    const dr = ws.addRow(rowVals);
    // Shade alternate rows
    if (days.indexOf(day) % 2 === 1) {
      dr.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } }; });
    }

    // Accumulate totals
    totals.subtotalCents += d.subtotalCents;
    totals.discountCents += d.discountCents;
    totals.totalCents    += d.totalCents;
    totals.orderCount    += d.orderCount;
    totals.pax           += d.pax;
    totals.bookingsConfirmed += d.bookingsConfirmed;
    totals.bookingsCancelled += d.bookingsCancelled;
    for (const k of PM_KEYS) {
      totals.payments[k].qty          += d.payments[k].qty;
      totals.payments[k].amountCents  += d.payments[k].amountCents;
    }
  }

  // ---- Totals row ----
  const tGross   = cents2(totals.subtotalCents);
  const tSC      = tGross * scRate;
  const tDisc    = cents2(totals.discountCents);
  const tNet     = cents2(totals.totalCents);
  const tAvg     = totals.pax > 0 ? +(tNet / totals.pax).toFixed(2) : 0;

  const totalRowVals: (string | number)[] = [
    'Total', tGross, tSC, tDisc, tNet, totals.orderCount, totals.pax, tAvg,
  ];
  if (includeBookings) {
    totalRowVals.push(totals.bookingsConfirmed, totals.bookingsCancelled);
  }
  for (const k of PM_KEYS) {
    totalRowVals.push(totals.payments[k].qty, cents2(totals.payments[k].amountCents));
  }
  totalRowVals.push(tNet);

  const totRow = ws.addRow(totalRowVals);
  totRow.eachCell(c => {
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } };
    c.border = { top: { style: 'thin' } };
  });

  // ---- Column widths ----
  ws.getColumn(1).width = 18;  // Date
  for (let i = 2; i <= totalCols; i++) {
    ws.getColumn(i).width = 12;
  }
  // Number formatting for numeric cols
  for (let i = 2; i <= totalCols; i++) {
    const hdr = headers[i - 1] ?? '';
    if (hdr !== 'Qty' && hdr !== 'Orders' && hdr !== 'Customers' && !hdr.includes('Bookings')) {
      ws.getColumn(i).numFmt = '#,##0.00';
    }
  }
}

/**
 * GET /restaurants/:restaurantId/reports/export-xlsx
 * Generates a 4-sheet Excel report:
 *   Sheet 1: Sales Summary (all order types)
 *   Sheet 2: Dine-in (order_type = 'table')
 *   Sheet 3: Takeout (order_type IN ('now','to_go'))
 *   Sheet 4: Staff by Day
 */
router.get("/restaurants/:restaurantId/reports/export-xlsx", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { date_from, date_to } = req.query as Record<string, string>;

    // --- Restaurant info ---
    const restRes = await pool.query(
      `SELECT name, timezone, COALESCE(service_charge_percent, 0) AS service_charge_percent
       FROM restaurants WHERE id = $1`,
      [restaurantId],
    );
    if ((restRes.rowCount ?? 0) === 0) return res.status(404).json({ error: 'Restaurant not found' });

    const rest    = restRes.rows[0];
    const tz      = rest.timezone || 'UTC';
    const scRate  = parseFloat(rest.service_charge_percent) / 100;
    const restName = rest.name || 'Restaurant';

    const fromDate = date_from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toDate   = date_to   || new Date().toISOString().slice(0, 10);
    const title    = `${restName}  ${fromDate} – ${toDate}`;

    // --- Query 1: sessions aggregated by (day, order_type, payment_method) ---
    // discount and total live on table_sessions, not on individual orders
    const sessionsRes = await pool.query<{
      day: string; order_type: string; payment_method: string;
      session_count: number; total_pax: number;
      subtotal_cents: string; discount_cents: string;
    }>(
      `WITH session_pm AS (
         SELECT
           ts.id,
           ts.started_at,
           ts.order_type,
           ts.discount_applied,
           ts.pax,
           COALESCE(
             -- KPay: specific card network from aid_label
             CASE WHEN ts.payment_method = 'kpay' THEN (
               SELECT kt.aid_label
               FROM kpay_transactions kt
               JOIN orders o2 ON o2.id = kt.order_id
               WHERE o2.session_id = ts.id
                 AND kt.aid_label IS NOT NULL AND kt.aid_label <> ''
               LIMIT 1
             ) ELSE NULL END,
             -- Payment Asia: network on session
             (SELECT pat.network FROM payment_asia_transactions pat
              WHERE pat.session_id = ts.id AND pat.network IS NOT NULL AND pat.network <> ''
              LIMIT 1),
             -- Payment Asia: network via order link
             (SELECT pat2.network FROM payment_asia_transactions pat2
              JOIN orders o3 ON o3.id = pat2.order_id
              WHERE o3.session_id = ts.id AND pat2.network IS NOT NULL AND pat2.network <> ''
              LIMIT 1),
             -- chuio_payments vendor-level method
             (SELECT cp.payment_method FROM chuio_payments cp
              WHERE cp.session_id = ts.id AND cp.payment_method IS NOT NULL AND cp.payment_method <> ''
              LIMIT 1),
             COALESCE(ts.payment_method, 'other')
           ) AS enriched_pm
         FROM table_sessions ts
         WHERE ts.restaurant_id = $1
           AND ts.ended_at IS NOT NULL
           AND (ts.started_at AT TIME ZONE $3)::date BETWEEN $2::date AND $4::date
       )
       SELECT
         (spm.started_at AT TIME ZONE $3)::date::text AS day,
         COALESCE(spm.order_type, 'table') AS order_type,
         spm.enriched_pm AS payment_method,
         COUNT(spm.id)::int AS session_count,
         COALESCE(SUM(spm.pax), 0)::int AS total_pax,
         COALESCE(SUM(sess_sub.subtotal), 0)::text AS subtotal_cents,
         COALESCE(SUM(spm.discount_applied), 0)::text AS discount_cents
       FROM session_pm spm
       JOIN LATERAL (
         SELECT COALESCE(SUM(oi.price_cents * oi.quantity), 0) AS subtotal
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id AND oi.removed = false
         WHERE o.session_id = spm.id
       ) sess_sub ON true
       GROUP BY 1, 2, 3
       ORDER BY 1, 2, 3`,
      [restaurantId, fromDate, tz, toDate],
    );

    // --- Query 2: bookings per day ---
    const bookingsRes = await pool.query<{ day: string; status: string; count: number }>(
      `SELECT booking_date::text AS day, status, COUNT(*)::int AS count
       FROM bookings
       WHERE restaurant_id = $1
         AND booking_date BETWEEN $2::date AND $3::date
       GROUP BY 1, 2`,
      [restaurantId, fromDate, toDate],
    );

    // --- Query 3: staff by day (closer staff on session, falling back to most active placer) ---
    const staffRes = await pool.query<{
      day: string; staff_name: string; session_count: number;
      subtotal_cents: string; discount_cents: string;
    }>(
      `SELECT
         (ts.started_at AT TIME ZONE $3)::date::text AS day,
         COALESCE(closer.name, placer.name, 'Unknown') AS staff_name,
         COUNT(ts.id)::int AS session_count,
         COALESCE(SUM(sess_sub.subtotal), 0)::text AS subtotal_cents,
         COALESCE(SUM(ts.discount_applied), 0)::text AS discount_cents
       FROM table_sessions ts
       LEFT JOIN users closer ON closer.id = ts.closed_by_staff_id
       LEFT JOIN LATERAL (
         SELECT u2.name
         FROM orders o2
         JOIN users u2 ON u2.id = o2.placed_by_user_id
         WHERE o2.session_id = ts.id AND o2.placed_by_user_id IS NOT NULL
         GROUP BY u2.id, u2.name
         ORDER BY COUNT(*) DESC
         LIMIT 1
       ) placer ON true
       JOIN LATERAL (
         SELECT COALESCE(SUM(oi.price_cents * oi.quantity), 0) AS subtotal
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id AND oi.removed = false
         WHERE o.session_id = ts.id
       ) sess_sub ON true
       WHERE ts.restaurant_id = $1
         AND ts.ended_at IS NOT NULL
         AND (ts.started_at AT TIME ZONE $3)::date BETWEEN $2::date AND $4::date
       GROUP BY 1, 2
       ORDER BY 1, 2`,
      [restaurantId, fromDate, tz, toDate],
    );

    // -------------------------------------------------------------------------
    // Aggregate into maps: allMap, dineMap, takeoutMap
    // -------------------------------------------------------------------------
    const allMap     = new Map<string, DayData>();
    const dineMap    = new Map<string, DayData>();
    const takeoutMap = new Map<string, DayData>();

    const getOrCreate = (m: Map<string, DayData>, k: string) => {
      if (!m.has(k)) m.set(k, emptyDayData());
      return m.get(k)!;
    };

    for (const r of sessionsRes.rows) {
      const pm   = canonicalPM(r.payment_method);
      const sub  = BigInt(r.subtotal_cents);
      const disc = BigInt(r.discount_cents);
      const sc   = BigInt(Math.round(Number(sub) * scRate));
      const net  = sub + sc - disc;
      const cnt  = r.session_count;
      const pax  = r.total_pax;

      const applyTo = (d: DayData) => {
        d.subtotalCents += sub;
        d.discountCents += disc;
        d.totalCents    += net;
        d.orderCount    += cnt;
        d.pax           += pax;
        d.sessionCount  += cnt;
        d.payments[pm].qty         += cnt;
        d.payments[pm].amountCents += net;
      };

      applyTo(getOrCreate(allMap, r.day));
      if (r.order_type === 'table') {
        applyTo(getOrCreate(dineMap, r.day));
      } else {
        applyTo(getOrCreate(takeoutMap, r.day));
      }
    }

    // Bookings aggregation (into allMap only)
    for (const r of bookingsRes.rows) {
      const d = getOrCreate(allMap, r.day);
      if (r.status === 'confirmed') d.bookingsConfirmed += r.count;
      else                          d.bookingsCancelled += r.count;
    }

    // -------------------------------------------------------------------------
    // Build workbook
    // -------------------------------------------------------------------------
    const wb   = new ExcelJS.Workbook();
    wb.creator  = restName;
    wb.created  = new Date();

    const days = dayRange(fromDate, toDate);

    buildSheet(wb.addWorksheet('Sales Summary'), title, days, allMap,     scRate, true);
    buildSheet(wb.addWorksheet('Dine-in'),        title, days, dineMap,    scRate, false);
    buildSheet(wb.addWorksheet('Takeout'),         title, days, takeoutMap, scRate, false);

    // ---- Sheet 4: Staff by Day ----
    const staffWs = wb.addWorksheet('Staff by Day');
    staffWs.addRow(['Staff Sales Report', title]);
    staffWs.mergeCells(1, 1, 1, 4);
    staffWs.getRow(1).getCell(1).font = { bold: true, size: 12 };

    const staffHeader = staffWs.addRow(['Date', 'Staff Name', 'Sessions', 'Net Revenue']);
    staffHeader.eachCell(c => {
      c.font  = { bold: true };
      c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
      c.alignment = { horizontal: 'center' };
      c.border = { bottom: { style: 'thin' } };
    });

    let staffTotalOrders = 0;
    let staffTotalCents  = 0n;
    for (const r of staffRes.rows) {
      const sub  = BigInt(r.subtotal_cents);
      const disc = BigInt(r.discount_cents);
      const sc   = BigInt(Math.round(Number(sub) * scRate));
      const net  = sub + sc - disc;
      staffWs.addRow([fmtDayLabel(r.day), r.staff_name, r.session_count, cents2(net)]);
      staffTotalOrders += r.session_count;
      staffTotalCents  += net;
    }
    const staffTotRow = staffWs.addRow(['Total', '', staffTotalOrders, cents2(staffTotalCents)]);
    staffTotRow.eachCell(c => {
      c.font = { bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } };
      c.border = { top: { style: 'thin' } };
    });
    staffWs.getColumn(1).width = 18;
    staffWs.getColumn(2).width = 22;
    staffWs.getColumn(3).width = 10;
    staffWs.getColumn(4).width = 14;
    staffWs.getColumn(4).numFmt = '#,##0.00';

    // ---- Stream response ----
    const filename = `sales_report_${fromDate}_${toDate}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[reports/export-xlsx]', err);
    if (!res.headersSent) res.status(500).json({ error: 'XLSX export failed' });
  }
});

export default router;
