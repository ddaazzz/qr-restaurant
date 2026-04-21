import { Router } from "express";
import pool from "../config/db";
import { sendReceipt } from "../services/emailService";
import { getPrinterQueueInstance } from "./printer.routes";
import { getPrinterZonesService } from "../services/printerZones";

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
  const variantId = o.variant_id;
  if (!selectedByVariant[variantId]) {
    selectedByVariant[variantId] = [];
  }
  selectedByVariant[variantId].push(o.id);
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
          (order_id, menu_item_id, quantity, price_cents, status, restaurant_id, notes)
        VALUES
          ($1, $2, $3, $4, 'pending', $5, $6)
        RETURNING id
        `,
        [
          orderId,
          item.menu_item_id,
          item.quantity,
          finalUnitPrice,
          restaurantId,
          item.notes || null
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

    // ✅ AUTO-PRINT: Check if kitchen auto-print is enabled
    try {
      const restaurantConfigRes = await pool.query(
        `SELECT kitchen_auto_print, printer_type FROM restaurant_printer_settings WHERE restaurant_id = $1`,
        [restaurantId]
      );

      if ((restaurantConfigRes.rowCount ?? 0) > 0) {
        const config = restaurantConfigRes.rows[0];

        if (config.kitchen_auto_print && config.printer_type && config.printer_type !== 'none') {
          // Fetch order details for printing (including addons)
          const orderDetailsRes = await pool.query(
            `
            SELECT 
              oi.id,
              oi.parent_order_item_id,
              oi.is_addon,
              oi.menu_item_id,
              oi.quantity, 
              oi.price_cents, 
              mi.name as item_name,
              mi.category_id as menu_category_id,
              oi.print_category_id,
              ts.table_name, 
              o.created_at
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN menu_items mi ON oi.menu_item_id = mi.id
            LEFT JOIN table_sessions ts ON o.session_id = ts.id
            WHERE oi.order_id = $1 AND o.restaurant_id = $2
            ORDER BY oi.parent_order_item_id ASC NULLS FIRST, oi.id ASC
            `,
            [orderId, restaurantId]
          );

          if ((orderDetailsRes.rowCount ?? 0) > 0) {
            const allItems = orderDetailsRes.rows;
            const tableNumber = allItems[0].table_name || "To-Go";
            const zonesService = getPrinterZonesService(pool);
            const queue = getPrinterQueueInstance();

            // Check if multi-zone printing is configured
            const zones = await zonesService.getZonesByRestaurant(restaurantId);

            if (zones.length > 1) {
              // Multi-zone: Group items by zone
              // Main items go to their category's zone
              // Addon items go to their print_category zone (which is the addon item's category)
              const itemsByZone: { [zoneId: number]: typeof allItems } = {};

              for (const item of allItems) {
                // Determine which category to use for zone assignment
                let zoneCategory = item.menu_category_id;
                if (item.is_addon && item.print_category_id) {
                  zoneCategory = item.print_category_id;
                }

                const zone = await zonesService.getZoneByCategoryId(restaurantId, zoneCategory);
                const zoneId = zone?.id || (await zonesService.getDefaultZone(restaurantId))?.id || 0;

                if (!itemsByZone[zoneId]) {
                  itemsByZone[zoneId] = [];
                }
                itemsByZone[zoneId].push(item);
              }

              // Queue print job for each zone
              for (const [zoneIdStr, zoneItems] of Object.entries(itemsByZone)) {
                const zoneId = parseInt(zoneIdStr);
                const printPayload = {
                  orderNumber: String(orderId),
                  tableNumber,
                  items: zoneItems.map((i) => ({
                    name: i.item_name,
                    quantity: i.quantity,
                    isAddon: i.is_addon
                  })),
                  timestamp: new Date(zoneItems[0].created_at).toLocaleTimeString(),
                  restaurantName: '',
                  type: 'kitchen' as const,
                };

                await queue.addJob(restaurantId, printPayload, {
                  orderId: String(orderId),
                  printerZoneId: zoneId,
                  priority: 10, // Highest priority for auto-print
                  maxRetries: 3,
                }).catch(err => {
                  console.warn('[Orders] Failed to auto-print order to zone:', err.message);
                });
              }
            } else {
              // Single zone or no zones: Print all items to default
              const printPayload = {
                orderNumber: String(orderId),
                tableNumber,
                items: allItems.map((i) => ({
                  name: i.item_name,
                  quantity: i.quantity,
                  isAddon: i.is_addon
                })),
                timestamp: new Date(allItems[0].created_at).toLocaleTimeString(),
                restaurantName: '',
                type: 'kitchen' as const,
              };

              const zone = await zonesService.getDefaultZone(restaurantId);
              await queue.addJob(restaurantId, printPayload, {
                orderId: String(orderId),
                ...(zone?.id !== undefined ? { printerZoneId: zone.id } : {}),
                priority: 10, // Highest priority for auto-print
                maxRetries: 3,
              }).catch(err => {
                console.warn('[Orders] Failed to auto-print order:', err.message);
              });
            }
          }
        }
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

        COALESCE(mi.name, 'Deleted Item') AS item_name,
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
      items: Object.values(ordersMap).filter((order: any) => order.items.length > 0)
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

        mi.name AS item_name,
        mi.category_id,

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
      LEFT JOIN table_units tu ON ts.table_unit_id = tu.id
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id

      LEFT JOIN order_item_variants oiv ON oiv.order_item_id = oi.id
      LEFT JOIN menu_item_variant_options vo ON vo.id = oiv.variant_option_id
      LEFT JOIN menu_item_variants v ON v.id = vo.variant_id

      WHERE oi.status != 'served'
      AND ts.restaurant_id = $1

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
        CASE
          WHEN COALESCE(ts.order_type, 'counter') = 'table'
          THEN ROUND(COALESCE(SUM(oi.price_cents * oi.quantity), 0) * (1 + COALESCE(r.service_charge_percent, 0) / 100.0))
          ELSE COALESCE(SUM(oi.price_cents * oi.quantity), 0)
        END as total_cents,
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
        SUM(oi.price_cents * oi.quantity) as subtotal_cents,
        CASE
          WHEN COALESCE(ts.order_type, 'counter') = 'table'
          THEN ROUND(SUM(oi.price_cents * oi.quantity) * (1 + COALESCE(r.service_charge_percent, 0) / 100.0))
          ELSE SUM(oi.price_cents * oi.quantity)
        END as total_cents,
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
      JOIN restaurants r ON r.id = o.restaurant_id
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
      GROUP BY o.id, o.restaurant_order_number, o.session_id, o.status, o.payment_method, o.chuio_order_reference, o.payment_status, o.created_at, ts.order_type, ts.table_id, t.name, ts.customer_name, ts.customer_phone, r.service_charge_percent, cpay.payment_vendor, cpay.payment_method, cpay.status, cpay.vendor_reference, cpay.total_cents, cpay.payment_gateway_env, cpay.completed_at, cpay.refunded_at, cpay.refund_amount_cents
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
        mi.name as menu_item_name,
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
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      LEFT JOIN order_item_variants oiv ON oiv.order_item_id = oi.id
      LEFT JOIN menu_item_variant_options vo ON vo.id = oiv.variant_option_id
      LEFT JOIN menu_item_variants v ON v.id = vo.variant_id
      WHERE oi.order_id = $1 AND oi.removed = false
      GROUP BY oi.id, oi.order_id, oi.menu_item_id, oi.quantity, oi.price_cents, oi.status, oi.is_addon, oi.parent_order_item_id, mi.name, mi.image_url
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
        mi.name AS item_name,
        SUM(oi.quantity) AS total_qty,
        SUM(oi.price_cents * oi.quantity) AS total_revenue_cents
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id = $1
        AND oi.removed = false
        AND oi.is_addon = false
        AND o.created_at >= NOW() - ($2::int * INTERVAL '1 day')
      GROUP BY mi.name
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
        mi.name AS item_name,
        mc.name AS category_name,
        SUM(oi.quantity) AS total_qty,
        SUM(oi.price_cents * oi.quantity) AS total_revenue_cents,
        COUNT(DISTINCT o.id) AS order_count
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id = $1
        AND oi.removed = false
        AND oi.is_addon = false
        AND o.created_at >= NOW() - ($2::int * INTERVAL '1 day')
      GROUP BY mi.name, mc.name
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

export default router;
