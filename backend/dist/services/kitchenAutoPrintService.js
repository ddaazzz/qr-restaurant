"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kitchenAutoPrintService = exports.KitchenAutoPrintService = void 0;
const orderNotifier_1 = require("./orderNotifier");
const db_1 = __importDefault(require("../config/db"));
const kitchenDispatch_1 = require("./kitchenDispatch");
/**
 * Kitchen Auto-Print Service
 * Listens to PostgreSQL notifications for new orders
 * Automatically routes orders to configured kitchen printers
 * NO MANUAL ACTION NEEDED - Always auto-prints
 */
class KitchenAutoPrintService {
    constructor() {
        this.initialized = false;
    }
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
            orderNotifier_1.orderNotifier.on('new-order', async (event) => {
                try {
                    console.log('[KitchenAutoPrint] 📦 New order received:', event);
                    await this.handleKitchenDispatch(event);
                }
                catch (err) {
                    console.error('[KitchenAutoPrint] Error handling new order:', err);
                }
            });
            // Listen to order status changes
            orderNotifier_1.orderNotifier.on('order-status-changed', async (event) => {
                try {
                    console.log('[KitchenAutoPrint] Order status changed:', event);
                    if (event.newStatus === 'completed') {
                        await this.handleKitchenDispatch(event);
                    }
                }
                catch (err) {
                    console.error('[KitchenAutoPrint] Error handling status change:', err);
                }
            });
            this.initialized = true;
            console.log('[KitchenAutoPrint] ✅ Service initialized - listening for kitchen orders');
        }
        catch (err) {
            console.error('[KitchenAutoPrint] Failed to initialize:', err);
        }
    }
    /**
     * Handle new order - fetch details, determine routing, and print
     */
    async handleNewOrder(event) {
        const { orderId, restaurantId, sessionId } = event;
        try {
            console.log(`[KitchenAutoPrint] 🍳 Processing kitchen order #${orderId} for restaurant ${restaurantId}`);
            // 1️⃣ Fetch full order details
            const orderResult = await db_1.default.query(`
        SELECT
          o.id AS order_id,
          o.restaurant_order_number,
          COALESCE(t.name, 'To-Go') AS table_name,
          ts.pax,
          STRING_AGG(
            mi.name || ' (qty: ' || oi.quantity || ')',
            ', '
          ) AS items_display,
          json_agg(
            json_build_object(
              'id', oi.id,
              'name', mi.name,
              'quantity', oi.quantity,
              'category_id', mi.category_id,
              'notes', oi.notes,
              'variants', (
                SELECT json_agg(json_build_object('name', v.name, 'option', vo.name))
                FROM order_item_variants oiv
                LEFT JOIN menu_item_variant_options vo ON vo.id = oiv.variant_option_id
                LEFT JOIN menu_item_variants v ON v.id = vo.variant_id
                WHERE oiv.order_item_id = oi.id
              )
            )
          ) AS items
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        LEFT JOIN table_sessions ts ON o.session_id = ts.id
        LEFT JOIN tables t ON ts.table_id = t.id
        WHERE o.id = $1 AND o.restaurant_id = $2
        GROUP BY o.id, o.restaurant_order_number, t.name, ts.pax
        `, [orderId, restaurantId]);
            if (orderResult.rowCount === 0) {
                console.warn(`[KitchenAutoPrint] Order #${orderId} not found`);
                return;
            }
            const order = orderResult.rows[0];
            console.log(`[KitchenAutoPrint] ✓ Fetched order details: ${order.items_display}`);
            // 2️⃣ Get kitchen printer configuration
            const printerResult = await db_1.default.query(`
        SELECT
          id,
          restaurant_id,
          type,
          printer_type,
          printer_host,
          printer_port,
          bluetooth_device_id,
          bluetooth_device_name,
          settings
        FROM printers
        WHERE restaurant_id = $1 AND type = 'Kitchen'
        LIMIT 1
        `, [restaurantId]);
            if (printerResult.rowCount === 0) {
                console.warn(`[KitchenAutoPrint] No kitchen printer configured for restaurant ${restaurantId}`);
                return;
            }
            const printer = printerResult.rows[0];
            console.log(`[KitchenAutoPrint] ✓ Kitchen printer found: ${printer.printer_type}`);
            // 3️⃣ Trigger auto-print via backend endpoint
            try {
                const printResponse = await fetch('http://localhost:10000/api/restaurants/' + restaurantId + '/print-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId: order.order_id,
                        orderType: 'kitchen',
                        priority: 10 // High priority for kitchen orders
                    })
                });
                if (printResponse.ok) {
                    const result = await printResponse.json();
                    console.log(`[KitchenAutoPrint] ✅ PRINTED to kitchen #${order.order_id}: ${order.items_display}`);
                    console.log(`[KitchenAutoPrint] Print result:`, result);
                }
                else {
                    const error = await printResponse.text();
                    console.error(`[KitchenAutoPrint] Print failed (${printResponse.status}):`, error);
                }
            }
            catch (err) {
                console.error(`[KitchenAutoPrint] Failed to trigger print:`, err);
            }
        }
        catch (err) {
            console.error(`[KitchenAutoPrint] Error processing order:`, err);
        }
    }
    /**
     * Stop the service
     */
    stop() {
        this.initialized = false;
        console.log('[KitchenAutoPrint] Service stopped');
    }
    async handleKitchenDispatch(event) {
        const { orderId, restaurantId } = event;
        if (!(await (0, kitchenDispatch_1.shouldSendOrderToKitchen)(Number(orderId), Number(restaurantId)))) {
            console.log(`[KitchenAutoPrint] Deferring kitchen print for unpaid Payment Asia order #${orderId}`);
            return;
        }
        if (await (0, kitchenDispatch_1.hasKitchenPrintJob)(Number(orderId), Number(restaurantId))) {
            console.log(`[KitchenAutoPrint] Print queue already has kitchen job for order #${orderId}, skipping direct auto-print`);
            return;
        }
        await this.handleNewOrder(event);
    }
}
exports.KitchenAutoPrintService = KitchenAutoPrintService;
// Export singleton instance
exports.kitchenAutoPrintService = new KitchenAutoPrintService();
//# sourceMappingURL=kitchenAutoPrintService.js.map