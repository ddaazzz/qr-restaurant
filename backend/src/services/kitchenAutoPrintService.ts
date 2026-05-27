import { orderNotifier } from './orderNotifier';
import pool from '../config/db';
import { hasKitchenPrintJob, shouldSendOrderToKitchen } from './kitchenDispatch';
import { generateKitchenOrderESCPOS, KitchenOrderData } from './thermalPrinterService';
import net from 'net';

/**
 * Kitchen Auto-Print Service
 * Listens to PostgreSQL notifications for new orders
 * Automatically routes orders to configured kitchen printers
 * NO MANUAL ACTION NEEDED - Always auto-prints
 */

export class KitchenAutoPrintService {
  private initialized = false;

  /**
   * Initialize the kitchen auto-print service
   * Starts listening to order notifications
   */
  async initialize() {
    if (this.initialized) {
      console.log('[KitchenAutoPrint] Already initialized');
      return;
    }

    try {
      // Listen to new order events from the database
      orderNotifier.on('new-order', async (event: any) => {
        try {
          console.log('[KitchenAutoPrint] 📦 New order received:', event);
          await this.handleKitchenDispatch(event);
        } catch (err) {
          console.error('[KitchenAutoPrint] Error handling new order:', err);
        }
      });

      // Listen to order status changes
      orderNotifier.on('order-status-changed', async (event: any) => {
        try {
          console.log('[KitchenAutoPrint] Order status changed:', event);
          if (event.newStatus === 'completed') {
            await this.handleKitchenDispatch(event);
          }
        } catch (err) {
          console.error('[KitchenAutoPrint] Error handling status change:', err);
        }
      });

      this.initialized = true;
      console.log('[KitchenAutoPrint] ✅ Service initialized - listening for kitchen orders');
    } catch (err) {
      console.error('[KitchenAutoPrint] Failed to initialize:', err);
    }
  }

  /**
   * Handle new order - fetch details, determine routing, and print directly via TCP
   */
  private async handleNewOrder(event: any) {
    const { orderId, restaurantId } = event;

    try {
      console.log(`[KitchenAutoPrint] 🍳 Processing kitchen order #${orderId} for restaurant ${restaurantId}`);

      // 1️⃣ Get kitchen printer configuration (check auto_print first to avoid unnecessary queries)
      const printerResult = await pool.query(
        `SELECT printer_type, printer_host, printer_port,
                bluetooth_device_id, bluetooth_device_name, settings
         FROM printers WHERE restaurant_id = $1 AND type = 'Kitchen' LIMIT 1`,
        [restaurantId]
      );

      if (printerResult.rowCount === 0) {
        console.warn(`[KitchenAutoPrint] No kitchen printer configured for restaurant ${restaurantId}`);
        return;
      }

      const printer = printerResult.rows[0];
      const kitchenSettings: Record<string, any> = printer.settings || {};

      // 2️⃣ Check auto_print flag — skip if disabled
      if (!kitchenSettings.auto_print) {
        console.log(`[KitchenAutoPrint] Auto-print disabled for restaurant ${restaurantId}, skipping`);
        return;
      }

      // 3️⃣ Fetch full order details with category info for routing
      const orderResult = await pool.query(
        `SELECT o.id AS order_id,
                o.restaurant_order_number,
                COALESCE(t.name, 'To-Go') AS table_name,
                o.created_at,
                json_agg(
                  json_build_object(
                    'id', oi.id,
                    'name', mi.name,
                    'quantity', oi.quantity,
                    'category_id', mi.category_id,
                    'notes', oi.notes
                  ) ORDER BY oi.id
                ) AS items
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         JOIN menu_items mi ON mi.id = oi.menu_item_id
         LEFT JOIN table_sessions ts ON o.session_id = ts.id
         LEFT JOIN tables t ON ts.table_id = t.id
         WHERE o.id = $1 AND o.restaurant_id = $2
         GROUP BY o.id, o.restaurant_order_number, t.name, o.created_at`,
        [orderId, restaurantId]
      );

      if (orderResult.rowCount === 0) {
        console.warn(`[KitchenAutoPrint] Order #${orderId} not found`);
        return;
      }

      const order = orderResult.rows[0];
      const items: any[] = Array.isArray(order.items) ? order.items : [];
      const tableNumber = order.table_name || 'To-Go';
      const timestamp = new Date(order.created_at || Date.now()).toLocaleTimeString();

      const restaurantResult = await pool.query('SELECT name FROM restaurants WHERE id = $1', [restaurantId]);
      const restaurantName = restaurantResult.rows[0]?.name || 'Restaurant';

      console.log(`[KitchenAutoPrint] ✓ Order #${orderId} — ${items.length} item(s) for table ${tableNumber}`);

      // 4️⃣ Route items to printers and send ESC/POS via TCP
      const multiPrinters: any[] = Array.isArray(kitchenSettings.printers) ? kitchenSettings.printers : [];

      if (multiPrinters.length > 0) {
        // Multi-printer routing by category
        for (const p of multiPrinters) {
          const categories: number[] = Array.isArray(p.categories) ? p.categories.map(Number) : [];
          const routedItems = categories.length > 0
            ? items.filter(i => categories.includes(Number(i.category_id)))
            : items;

          if (routedItems.length === 0) continue;

          if (p.type === 'network' && p.host) {
            const orderData: KitchenOrderData = {
              orderNumber: String(order.order_id),
              tableNumber,
              items: routedItems.map(i => ({ name: i.name, quantity: i.quantity })),
              timestamp,
              restaurantName,
            };
            const escposArray = generateKitchenOrderESCPOS(orderData);
            try {
              await this.sendTcpPrint(p.host, p.port || 9100, escposArray);
              console.log(`[KitchenAutoPrint] ✅ Printed to "${p.name || p.host}" — ${routedItems.length} item(s)`);
            } catch (printErr: any) {
              console.error(`[KitchenAutoPrint] ❌ Failed to print to "${p.name || p.host}":`, printErr.message);
            }
          } else if (p.type === 'bluetooth') {
            console.log(`[KitchenAutoPrint] Bluetooth printer "${p.name}" requires browser-side session — skipping server-side print`);
          }
        }
      } else if (printer.printer_type === 'network' && printer.printer_host) {
        // Single-printer fallback
        const orderData: KitchenOrderData = {
          orderNumber: String(order.order_id),
          tableNumber,
          items: items.map(i => ({ name: i.name, quantity: i.quantity })),
          timestamp,
          restaurantName,
        };
        const escposArray = generateKitchenOrderESCPOS(orderData);
        try {
          await this.sendTcpPrint(printer.printer_host, printer.printer_port || 9100, escposArray);
          console.log(`[KitchenAutoPrint] ✅ Printed to ${printer.printer_host}:${printer.printer_port || 9100}`);
        } catch (printErr: any) {
          console.error(`[KitchenAutoPrint] ❌ TCP print failed:`, printErr.message);
        }
      } else {
        console.log(`[KitchenAutoPrint] No network kitchen printer configured — bluetooth requires browser session`);
      }
    } catch (err) {
      console.error(`[KitchenAutoPrint] Error processing order #${orderId}:`, err);
    }
  }

  /**
   * Send ESC/POS data directly to a network printer via raw TCP socket
   */
  private sendTcpPrint(host: string, port: number, escposData: Uint8Array | number[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const client = new net.Socket();
      client.setTimeout(5000);
      client.connect(port, host, () => {
        client.write(Buffer.from(escposData as any), () => {
          client.end();
          resolve();
        });
      });
      client.on('error', (err) => { client.destroy(); reject(err); });
      client.on('timeout', () => {
        client.destroy();
        reject(new Error(`Kitchen printer ${host}:${port} timed out`));
      });
    });
  }

  /**
   * Stop the service
   */
  stop() {
    this.initialized = false;
    console.log('[KitchenAutoPrint] Service stopped');
  }

  private async handleKitchenDispatch(event: any) {
    const { orderId, restaurantId } = event;

    if (!(await shouldSendOrderToKitchen(Number(orderId), Number(restaurantId)))) {
      console.log(`[KitchenAutoPrint] Deferring kitchen print for unpaid Payment Asia order #${orderId}`);
      return;
    }

    if (await hasKitchenPrintJob(Number(orderId), Number(restaurantId))) {
      console.log(`[KitchenAutoPrint] Print queue already has kitchen job for order #${orderId}, skipping direct auto-print`);
      return;
    }

    await this.handleNewOrder(event);
  }
}

// Export singleton instance
export const kitchenAutoPrintService = new KitchenAutoPrintService();
