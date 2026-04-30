import pool from "../config/db";
import { getPrinterQueueInstance } from "../routes/printer.routes";
import { getPrinterZonesService } from "./printerZones";

export async function isPaymentAsiaOrderPayBeforeKitchenEnabled(restaurantId: number): Promise<boolean> {
  const restaurantRes = await pool.query(
    `SELECT active_payment_vendor, active_payment_terminal_id, payment_asia_order_pay_enabled
     FROM restaurants
     WHERE id = $1`,
    [restaurantId]
  );

  if ((restaurantRes.rowCount ?? 0) === 0) {
    return false;
  }

  const restaurant = restaurantRes.rows[0];
  return (
    restaurant.active_payment_vendor === "payment-asia" &&
    restaurant.active_payment_terminal_id != null &&
    restaurant.payment_asia_order_pay_enabled !== false
  );
}

export async function shouldSendOrderToKitchen(orderId: number, restaurantId: number): Promise<boolean> {
  const orderPayBeforeKitchenEnabled = await isPaymentAsiaOrderPayBeforeKitchenEnabled(restaurantId);

  if (!orderPayBeforeKitchenEnabled) {
    return true;
  }

  const orderRes = await pool.query(
    `SELECT status, payment_method
     FROM orders
     WHERE id = $1 AND restaurant_id = $2`,
    [orderId, restaurantId]
  );

  if ((orderRes.rowCount ?? 0) === 0) {
    return false;
  }

  const order = orderRes.rows[0];
  return order.status === "completed" && order.payment_method === "payment-asia";
}

export async function hasKitchenPrintJob(orderId: number, restaurantId: number): Promise<boolean> {
  const existingJobRes = await pool.query(
    `SELECT 1
     FROM print_queue
     WHERE restaurant_id = $1 AND order_id = $2 AND job_type = 'kitchen'
     LIMIT 1`,
    [restaurantId, String(orderId)]
  );

  return (existingJobRes.rowCount ?? 0) > 0;
}

export async function queueKitchenPrintJobs(orderId: number, restaurantId: number): Promise<boolean> {
  if (await hasKitchenPrintJob(orderId, restaurantId)) {
    return false;
  }

  const restaurantConfigRes = await pool.query(
    `SELECT kitchen_auto_print, printer_type FROM restaurant_printer_settings WHERE restaurant_id = $1`,
    [restaurantId]
  );

  if ((restaurantConfigRes.rowCount ?? 0) === 0) {
    return false;
  }

  const config = restaurantConfigRes.rows[0];
  if (!config.kitchen_auto_print || !config.printer_type || config.printer_type === "none") {
    return false;
  }

  const orderDetailsRes = await pool.query(
    `
    SELECT
      oi.id,
      oi.parent_order_item_id,
      oi.is_addon,
      oi.menu_item_id,
      oi.quantity,
      oi.price_cents,
      COALESCE(oi.custom_item_name, oi.item_name_snapshot, mi.name) as item_name,
      COALESCE(mi.category_id, -1) as menu_category_id,
      oi.print_category_id,
      ts.table_name,
      o.created_at,
      o.session_id
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
    LEFT JOIN table_sessions ts ON o.session_id = ts.id
    WHERE oi.order_id = $1 AND o.restaurant_id = $2
    ORDER BY oi.parent_order_item_id ASC NULLS FIRST, oi.id ASC
    `,
    [orderId, restaurantId]
  );

  if ((orderDetailsRes.rowCount ?? 0) === 0) {
    return false;
  }

  const allItems = orderDetailsRes.rows;
  const tableNumber = allItems[0].table_name || "To-Go";
  const sessionId = allItems[0].session_id || null;
  const zonesService = getPrinterZonesService(pool);
  const queue = getPrinterQueueInstance();
  const zones = await zonesService.getZonesByRestaurant(restaurantId);

  if (zones.length > 1) {
    const itemsByZone: { [zoneId: number]: typeof allItems } = {};

    for (const item of allItems) {
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

    for (const [zoneIdStr, zoneItems] of Object.entries(itemsByZone)) {
      const zoneId = parseInt(zoneIdStr, 10);
      const printPayload = {
        orderNumber: String(orderId),
        tableNumber,
        items: zoneItems.map((item) => ({
          name: item.item_name,
          quantity: item.quantity,
          isAddon: item.is_addon,
        })),
        timestamp: new Date(zoneItems[0].created_at).toLocaleTimeString(),
        restaurantName: "",
        type: "kitchen" as const,
      };

      await queue.addJob(restaurantId, printPayload, {
        jobType: "kitchen",
        orderId: String(orderId),
        sessionId,
        printerZoneId: zoneId,
        priority: 10,
        maxRetries: 3,
      }).catch((err) => {
        console.warn("[KitchenDispatch] Failed to queue kitchen print job for zone:", err.message);
      });
    }

    return true;
  }

  const printPayload = {
    orderNumber: String(orderId),
    tableNumber,
    items: allItems.map((item) => ({
      name: item.item_name,
      quantity: item.quantity,
      isAddon: item.is_addon,
    })),
    timestamp: new Date(allItems[0].created_at).toLocaleTimeString(),
    restaurantName: "",
    type: "kitchen" as const,
  };

  const zone = await zonesService.getDefaultZone(restaurantId);
  await queue.addJob(restaurantId, printPayload, {
    jobType: "kitchen",
    orderId: String(orderId),
    sessionId,
    ...(zone?.id !== undefined ? { printerZoneId: zone.id } : {}),
    priority: 10,
    maxRetries: 3,
  }).catch((err) => {
    console.warn("[KitchenDispatch] Failed to queue kitchen print job:", err.message);
  });

  return true;
}