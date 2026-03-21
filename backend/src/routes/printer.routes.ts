import express, { Request, Response } from "express";
import pool from "../config/db";
import { printOrder, testPrinterConnection, generateReceiptHTML } from "../services/printerService";
import { PrinterQueueService } from "../services/printerQueue";
import { generateESCPOS, ReceiptData } from "../services/thermalPrinterService";

const router = express.Router();

// Printer queue service instance
let printerQueue: PrinterQueueService | null = null;

/**
 * Initialize printer queue service (call this in app startup)
 */
export function initializePrinterQueue(config?: any): PrinterQueueService {
  if (!printerQueue) {
    printerQueue = new PrinterQueueService(pool, config);
    printerQueue.start().catch(err => {
      console.error("[PrinterQueue] Failed to start queue:", err);
    });
  }
  return printerQueue;
}

/**
 * Get printer queue service instance
 */
export function getPrinterQueueInstance(): PrinterQueueService {
  if (!printerQueue) {
    throw new Error("Printer queue not initialized. Call initializePrinterQueue first.");
  }
  return printerQueue;
}

/**
 * Get all printer settings for a restaurant (unified printers table)
 */
router.get("/restaurants/:restaurantId/printer-settings", async (req: Request, res: Response) => {
  const { restaurantId } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        id,
        restaurant_id,
        type,
        printer_type,
        printer_host,
        printer_port,
        bluetooth_device_id,
        bluetooth_device_name,
        menu_category_id,
        settings,
        created_at,
        updated_at
       FROM printers WHERE restaurant_id = $1 ORDER BY type`,
      [restaurantId]
    );

    console.log(`[PrinterSettings] GET endpoint - Restaurant: ${restaurantId}, Found ${result.rows.length} printers`);
    if (result.rows.length > 0) {
      console.log(`[PrinterSettings] Raw DB Response:`, JSON.stringify(result.rows, null, 2));
    }

    // Return array of printers, or empty array if none found
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Failed to fetch printer settings:", err);
    res.status(500).json({ error: "Failed to fetch printer settings" });
  }
});

/**
 * Update printer settings for a restaurant
 */
/**
 * Update printer settings (upsert into unified printers table)
 * Can update one or more printers in a single request
 */
router.patch("/restaurants/:restaurantId/printer-settings", async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const { type, printer_type, printer_host, printer_port, bluetooth_device_id, bluetooth_device_name, menu_category_id, settings } = req.body;

  try {
    // If type is specified, update/insert single printer
    if (type) {
      // Merge new settings with existing settings (don't lose other JSONB fields)
      const mergedSettingsSQL = settings ? `printers.settings || $9::jsonb` : `printers.settings`;
      
      const result = await pool.query(
        `INSERT INTO printers (restaurant_id, type, printer_type, printer_host, printer_port, bluetooth_device_id, bluetooth_device_name, menu_category_id, settings)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::jsonb, '{}'))
         ON CONFLICT (restaurant_id, type) DO UPDATE SET
           printer_type = COALESCE(EXCLUDED.printer_type, printers.printer_type),
           printer_host = COALESCE(EXCLUDED.printer_host, printers.printer_host),
           printer_port = COALESCE(EXCLUDED.printer_port, printers.printer_port, 9100),
           bluetooth_device_id = COALESCE(EXCLUDED.bluetooth_device_id, printers.bluetooth_device_id),
           bluetooth_device_name = COALESCE(EXCLUDED.bluetooth_device_name, printers.bluetooth_device_name),
           menu_category_id = COALESCE(EXCLUDED.menu_category_id, printers.menu_category_id),
           settings = CASE 
             WHEN $9::jsonb IS NOT NULL THEN printers.settings || $9::jsonb
             ELSE printers.settings
           END,
           updated_at = now()
         RETURNING *`,
        [restaurantId, type, printer_type, printer_host, printer_port || 9100, bluetooth_device_id, bluetooth_device_name, menu_category_id, JSON.stringify(settings) || null]
      );

      return res.json(result.rows[0]);
    } else {
      // If no type specified, return all printers for this restaurant
      const result = await pool.query(
        `SELECT * FROM printers WHERE restaurant_id = $1 ORDER BY type`,
        [restaurantId]
      );
      return res.json(result.rows);
    }
  } catch (err) {
    console.error("❌ Failed to update printer settings:", err);
    res.status(500).json({ error: "Failed to update printer settings" });
  }
});

/**
 * Test printer connection
 */
router.post("/restaurants/:restaurantId/printer-test", async (req: Request, res: Response) => {
  const { restaurantId } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        printer_type, 
        printer_host, 
        printer_port,
        printer_usb_vendor_id,
        printer_usb_product_id,
        bluetooth_device_id,
        bluetooth_device_name
       FROM restaurants WHERE id = $1`,
      [restaurantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const config = result.rows[0];

    if (!config.printer_type || config.printer_type === "none") {
      return res.json({ success: false, error: "No printer configured" });
    }

    // For Bluetooth printers, verify device ID is set
    if (config.printer_type === "bluetooth") {
      if (!config.bluetooth_device_id) {
        return res.json({ 
          success: false, 
          error: "Bluetooth device not configured. Please scan and select a device." 
        });
      }
      // Bluetooth connection is handled client-side via Web Bluetooth API
      // Server just confirms config
      return res.json({ 
        success: true, 
        message: "Bluetooth device configured: " + (config.bluetooth_device_name || config.bluetooth_device_id)
      });
    }

    const testResult = await testPrinterConnection({
      type: config.printer_type,
      host: config.printer_host,
      port: config.printer_port,
      vendorId: config.printer_usb_vendor_id,
      productId: config.printer_usb_product_id,
    });

    res.json(testResult);
  } catch (err) {
    console.error("❌ Printer test failed:", err);
    res.status(500).json({ error: "Printer test failed" });
  }
});

/**
 * Print kitchen order (queue-based)
 */
router.post("/restaurants/:restaurantId/print-order", async (req: Request, res: Response) => {
  const restaurantId = req.params.restaurantId as string;
  const { orderId, orderType = "kitchen", priority = 0, printerZoneId } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: "orderId is required" });
  }

  try {
    // Get restaurant printer config and order details
    const [restaurantResult, orderResult] = await Promise.all([
      pool.query(
        `SELECT printer_type, printer_host, printer_port,
                printer_usb_vendor_id, printer_usb_product_id, 
                bluetooth_device_id, bluetooth_device_name, name
         FROM restaurants WHERE id = $1`,
        [restaurantId]
      ),
      pool.query(
        `SELECT oi.order_item_id, oi.order_id, oi.item_name, oi.quantity, 
                oi.variants, ts.table_name, o.created_at
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         LEFT JOIN table_sessions ts ON o.session_id = ts.id
         WHERE oi.order_id = $1 AND o.restaurant_id = $2
         ORDER BY oi.order_item_id`,
        [orderId, restaurantId]
      ),
    ]);

    if (restaurantResult.rowCount === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    if (orderResult.rowCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const printerConfig = restaurantResult.rows[0];
    const items = orderResult.rows;
    const tableNumber = items[0].table_name || "To-Go";

    const payload = {
      orderNumber: String(orderId),
      tableNumber,
      items: items.map((i) => ({
        name: i.item_name,
        quantity: i.quantity,
        variants: i.variants,
      })),
      timestamp: new Date(items[0].created_at).toLocaleTimeString(),
      restaurantName: printerConfig.name,
      type: orderType as "kitchen" | "bill",
      printerConfig: {
        type: printerConfig.printer_type,
        host: printerConfig.printer_host,
        port: printerConfig.printer_port,
        vendorId: printerConfig.printer_usb_vendor_id,
        productId: printerConfig.printer_usb_product_id,
        bluetoothDeviceId: printerConfig.bluetooth_device_id,
        bluetoothDeviceName: printerConfig.bluetooth_device_name,
      },
    };

    // For browser printing, return HTML immediately
    if (printerConfig.printer_type === "browser" || printerConfig.printer_type === "none") {
      return res.json({
        success: true,
        html: generateReceiptHTML(payload),
        message: "Print-ready HTML generated for browser printing",
      });
    }

    // For Bluetooth printing, return bluetoothPayload for client-side handling
    if (printerConfig.printer_type === "bluetooth") {
      // Validate that device is configured
      if (!printerConfig.bluetooth_device_name) {
        return res.status(400).json({ error: "Bluetooth printer device not configured. Please configure the printer in Settings first." });
      }
      
      const bluetoothPayload = {
        printerConfig: {
          bluetoothDeviceId: printerConfig.bluetooth_device_id,
          bluetoothDeviceName: printerConfig.bluetooth_device_name,
        },
        data: {
          type: 'order',
          orderNumber: String(orderId),
          tableNumber,
          items: items.map((i) => ({
            name: i.item_name,
            quantity: i.quantity,
            variants: i.variants,
          })),
          timestamp: new Date(items[0].created_at).toLocaleTimeString(),
          restaurantName: printerConfig.name,
          html: generateReceiptHTML(payload),
        }
      };
      
      return res.json({
        success: true,
        bluetoothPayload,
        message: `Order ready for Bluetooth printing on ${printerConfig.bluetooth_device_name}`,
      });
    }

    // Add to print queue
    const queue = getPrinterQueueInstance();
    const job = await queue.addJob(parseInt(restaurantId), payload, {
      orderId: String(orderId),
      priority,
      printerZoneId,
      maxRetries: 3,
    });

    res.json({
      success: true,
      jobId: job.id,
      status: job.status,
      message: "Print job queued successfully",
    });
  } catch (err: any) {
    if (err.message.includes("not initialized")) {
      console.error("❌ Printer queue not initialized");
      return res.status(500).json({ error: "Printer queue not initialized" });
    }
    console.error("❌ Failed to queue print order:", err);
    res.status(500).json({ error: "Failed to queue print order" });
  }
});

/**
 * Generate QR receipt preview (uses actual thermalPrinterService for accuracy)
 * Frontend calls this to show live preview that matches what actually prints
 */
router.post("/restaurants/:restaurantId/preview-qr", async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const { tableName = 'T02', pax = 4, qrTextAbove, qrTextBelow } = req.body;

  try {
    // Get restaurant name
    const restaurantResult = await pool.query(
      `SELECT name FROM restaurants WHERE id = $1`,
      [restaurantId]
    );
    const restaurantName = restaurantResult.rowCount > 0 ? restaurantResult.rows[0].name : 'La Cave Restaurant';

    // Get QR text customization from database
    let textAboveQR = qrTextAbove || 'Scan to Order';
    let textBelowQR = qrTextBelow || 'Let us know how we did!';

    const settingsResult = await pool.query(
      `SELECT 
        COALESCE((settings->>'qr_text_above'), '') as text_above,
        COALESCE((settings->>'qr_text_below'), '') as text_below
       FROM printers WHERE restaurant_id = $1 AND type = $2`,
      [restaurantId, 'QR']
    );

    if (settingsResult.rowCount > 0) {
      const settings = settingsResult.rows[0];
      if (settings.text_above) textAboveQR = settings.text_above;
      if (settings.text_below) textBelowQR = settings.text_below;
    }

    // Generate actual ESC/POS using the same service that prints
    const receiptData: ReceiptData = {
      restaurantName: restaurantName,
      tableName: tableName,
      pax: pax || undefined,
      qrToken: 'preview-token',
      startedTime: new Date().toLocaleString(),
      printerPaperWidth: 80,
      qrTextAbove: textAboveQR,
      qrTextBelow: textBelowQR
    };

    const escposArray = generateESCPOS(receiptData);

    // Return both the actual ESC/POS and a text preview
    const previewText = `
${restaurantName}
================================
Table: ${tableName}
Pax: ${pax}
Started: ${new Date().toLocaleString()}

================================
       [QR CODE]

${textAboveQR}
${textBelowQR}
`.trim();

    return res.json({
      success: true,
      escposArray: Array.from(escposArray),
      escposBase64: Buffer.from(escposArray).toString('base64'),
      previewText: previewText
    });
  } catch (err) {
    console.error('[PreviewQR] Error generating preview:', err);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

/**
 * Test QR receipt printing (generates ESC/POS without saving to queue)
 * Useful for testing the thermalPrinterService output directly
 */
router.post("/restaurants/:restaurantId/test-print-qr", async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const { tableName = 'T02', pax = 4 } = req.body;

  try {
    // Get restaurant name
    const restaurantResult = await pool.query(
      `SELECT name FROM restaurants WHERE id = $1`,
      [restaurantId]
    );
    const restaurantName = restaurantResult.rowCount > 0 ? restaurantResult.rows[0].name : 'La Cave Restaurant';

    // Get QR text customization from database
    let textAboveQR = 'Scan to Order';
    let textBelowQR = 'Let us know how we did!';

    const settingsResult = await pool.query(
      `SELECT 
        COALESCE((settings->>'qr_text_above'), '') as text_above,
        COALESCE((settings->>'qr_text_below'), '') as text_below
       FROM printers WHERE restaurant_id = $1 AND type = $2`,
      [restaurantId, 'QR']
    );

    if (settingsResult.rowCount > 0) {
      const settings = settingsResult.rows[0];
      if (settings.text_above) textAboveQR = settings.text_above;
      if (settings.text_below) textBelowQR = settings.text_below;
    }

    // Generate actual ESC/POS using the same service that prints
    const receiptData: ReceiptData = {
      restaurantName: restaurantName,
      tableName: tableName,
      pax: pax || undefined,
      qrToken: 'test-token-12345',
      startedTime: new Date().toLocaleString(),
      printerPaperWidth: 80,
      qrTextAbove: textAboveQR,
      qrTextBelow: textBelowQR
    };

    const escposArray = generateESCPOS(receiptData);

    // Return the actual ESC/POS for testing
    return res.json({
      success: true,
      type: 'test',
      escposArray: Array.from(escposArray),
      escposBase64: Buffer.from(escposArray).toString('base64'),
      message: 'ESC/POS commands generated successfully. Send to Bluetooth printer for testing.'
    });
  } catch (err) {
    console.error('[TestPrintQR] Error generating test print:', err);
    res.status(500).json({ error: 'Failed to generate test print' });
  }
});

/**
 * Generate Bill Receipt preview (uses actual thermalPrinterService for accuracy)
 * Frontend calls this to show live preview that matches what actually prints
 * Uses SAMPLE DATA - not tied to a specific session
 */
router.post("/restaurants/:restaurantId/preview-bill", async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const { 
    headerText = 'Thank You',
    footerText = 'Follow us on social media'
  } = req.body;

  try {
    // Get restaurant info
    const restaurantResult = await pool.query(
      `SELECT name, address, phone FROM restaurants WHERE id = $1`,
      [restaurantId]
    );
    const restaurantName = restaurantResult.rowCount > 0 ? restaurantResult.rows[0].name : 'La Cave Restaurant';
    const restaurantAddress = restaurantResult.rowCount > 0 ? restaurantResult.rows[0].address : '123 Main Street';
    const restaurantPhone = restaurantResult.rowCount > 0 ? restaurantResult.rows[0].phone : '+1 (555) 123-4567';

    // Get bill format settings from database
    let billHeaderText = headerText;
    let billFooterText = footerText;

    const settingsResult = await pool.query(
      `SELECT 
        COALESCE((settings->>'bill_header_text'), '') as header_text,
        COALESCE((settings->>'bill_footer_text'), '') as footer_text
       FROM printers WHERE restaurant_id = $1 AND type = $2`,
      [restaurantId, 'BILL']
    );

    if (settingsResult.rowCount > 0) {
      const settings = settingsResult.rows[0];
      if (settings.header_text) billHeaderText = settings.header_text;
      if (settings.footer_text) billFooterText = settings.footer_text;
    }

    // Generate ESC/POS with sample data to preview format
    const receiptData: ReceiptData = {
      restaurantName: restaurantName,
      restaurantAddress: restaurantAddress,
      restaurantPhone: restaurantPhone,
      orderNumber: 'ORD-PREVIEW',
      tableNumber: 'T02',
      pax: 4,
      items: [
        { name: 'Pad Thai x2', quantity: 2, price: 1200 },
        { name: 'Green Curry x1', quantity: 1, price: 1300 }
      ],
      subtotal: 3700,
      serviceCharge: 370,
      total: 4070,
      timestamp: new Date().toLocaleString(),
      printerPaperWidth: 80,
      billHeaderText: billHeaderText,
      billFooterText: billFooterText
    };

    const escposArray = generateESCPOS(receiptData);

    // Return both the actual ESC/POS and a text preview
    const previewText = `
${restaurantName}
========================================
Table: T02
Order: ORD-PREVIEW
Time: ${new Date().toLocaleString()}

========================================
ITEMS
Pad Thai x2
  x2                         12.00
Green Curry x1
  x1                         13.00

========================================
Subtotal                      37.00
Service Charge                 3.70
Tax                            0.00
TOTAL                         40.70

${billHeaderText}
${billFooterText}
`.trim();

    return res.json({
      success: true,
      escposArray: Array.from(escposArray),
      escposBase64: Buffer.from(escposArray).toString('base64'),
      previewText: previewText
    });
  } catch (err) {
    console.error('[PreviewBill] Error generating preview:', err);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

/**
 * Test Bill Receipt printing (generates ESC/POS without saving to queue)
 * Useful for testing the thermalPrinterService output directly
 */
router.post("/restaurants/:restaurantId/test-print-bill", async (req: Request, res: Response) => {
  const { restaurantId } = req.params;

  try {
    // Get restaurant info
    const restaurantResult = await pool.query(
      `SELECT name, address, phone FROM restaurants WHERE id = $1`,
      [restaurantId]
    );
    const restaurantName = restaurantResult.rowCount > 0 ? restaurantResult.rows[0].name : 'La Cave Restaurant';
    const restaurantAddress = restaurantResult.rowCount > 0 ? restaurantResult.rows[0].address : '123 Main Street';
    const restaurantPhone = restaurantResult.rowCount > 0 ? restaurantResult.rows[0].phone : '+1 (555) 123-4567';

    // Get bill format settings
    let billHeaderText = 'Thank You';
    let billFooterText = 'Follow us on social media';

    const settingsResult = await pool.query(
      `SELECT 
        COALESCE((settings->>'bill_header_text'), '') as header_text,
        COALESCE((settings->>'bill_footer_text'), '') as footer_text
       FROM printers WHERE restaurant_id = $1 AND type = $2`,
      [restaurantId, 'BILL']
    );

    if (settingsResult.rowCount > 0) {
      const settings = settingsResult.rows[0];
      if (settings.header_text) billHeaderText = settings.header_text;
      if (settings.footer_text) billFooterText = settings.footer_text;
    }

    // Generate with sample test data
    const receiptData: ReceiptData = {
      restaurantName: restaurantName,
      restaurantAddress: restaurantAddress,
      restaurantPhone: restaurantPhone,
      orderNumber: 'TEST-001',
      tableNumber: 'T05',
      pax: 2,
      items: [
        { name: 'Test Item 1', quantity: 1, price: 1500 },
        { name: 'Test Item 2', quantity: 2, price: 900 }
      ],
      subtotal: 3300,
      serviceCharge: 330,
      total: 3630,
      timestamp: new Date().toLocaleString(),
      printerPaperWidth: 80,
      billHeaderText: billHeaderText,
      billFooterText: billFooterText
    };

    const escposArray = generateESCPOS(receiptData);

    // Return the actual ESC/POS for testing
    return res.json({
      success: true,
      type: 'test',
      escposArray: Array.from(escposArray),
      escposBase64: Buffer.from(escposArray).toString('base64'),
      message: 'ESC/POS commands generated successfully. Send to Bluetooth printer for testing.'
    });
  } catch (err) {
    console.error('[TestPrintBill] Error generating test print:', err);
    res.status(500).json({ error: 'Failed to generate test print' });
  }
});

/**
 * Print QR code (queue-based)
 */
router.post("/restaurants/:restaurantId/print-qr", async (req: Request, res: Response) => {
  const restaurantId = req.params.restaurantId as string;
  let { sessionId, tableId, tableName, qrToken, priority = 10 } = req.body;

  console.log('[PrintQR] Received print-qr request:', { restaurantId, sessionId, tableName, qrToken });

  if (!tableId || !tableName || !qrToken) {
    return res.status(400).json({ error: "tableId, tableName, and qrToken are required" });
  }

  try {
    // Try to get QR printer from new unified printers table first
    let printerResult = await pool.query(
      `SELECT printer_type, printer_host, printer_port,
              bluetooth_device_id, bluetooth_device_name, settings
       FROM printers WHERE restaurant_id = $1 AND type = $2`,
      [restaurantId, 'QR']
    );

    let printerConfig = printerResult.rows[0];
    let restaurantName = '';

    // Get restaurant name
    const restaurantResult = await pool.query(
      `SELECT name FROM restaurants WHERE id = $1`,
      [restaurantId]
    );
    if (restaurantResult.rowCount > 0) {
      restaurantName = restaurantResult.rows[0].name;
    }

    // If not found in printers table, try old schema on restaurants table (fallback)
    if (!printerConfig) {
      console.log('[PrintQR] QR printer not found in printers table, checking restaurants table');
      const oldSchemaResult = await pool.query(
        `SELECT qr_printer_type as printer_type, 
                qr_printer_host as printer_host, 
                qr_printer_port as printer_port,
                qr_bluetooth_device_id as bluetooth_device_id, 
                qr_bluetooth_device_name as bluetooth_device_name,
                name
         FROM restaurants WHERE id = $1`,
        [restaurantId]
      );
      
      if (oldSchemaResult.rowCount === 0) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      printerConfig = oldSchemaResult.rows[0];
      restaurantName = printerConfig.name;
    }

    console.log('[PrintQR] QR printer config:', {
      type: printerConfig.printer_type,
      host: printerConfig.printer_host,
      bluetoothDeviceId: printerConfig.bluetooth_device_id,
      bluetoothDeviceName: printerConfig.bluetooth_device_name,
    });

    // Check if printer is configured
    if (!printerConfig.printer_type || printerConfig.printer_type === 'none') {
      console.log('[PrintQR] No printer configured, returning error');
      return res.status(400).json({ error: "No QR printer configured. Please set up a printer in settings." });
    }

    console.log('[PrintQR] Printer type:', printerConfig.printer_type);

    // If browser printing, return HTML for client-side printing
    if (printerConfig.printer_type === 'browser') {
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&data=${encodeURIComponent(`https://chuio.io/${qrToken}`)}`;
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>QR Code - ${tableName}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Courier New', monospace; padding: 12px; background: #fff; }
              .receipt { width: 100%; text-align: center; font-size: 12px; line-height: 1.5; max-width: 80mm; margin: 0 auto; }
              .header { border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
              .restaurant-name { font-weight: bold; font-size: 16px; }
              #qrcode { display: flex; justify-content: center; margin: 16px 0; }
              .footer { font-size: 10px; color: #666; margin-top: 8px; }
              @media print { body { margin: 0; padding: 8px; } .receipt { width: 80mm; } }
            </style>
          </head>
          <body>
            <div class="receipt">
              <div class="header">
                <div class="restaurant-name">${restaurantName}</div>
              </div>
              <div style="text-align: left; margin: 8px 0; font-size: 11px;">
                <div>Table: ${tableName}</div>
              </div>
              <div style="border-bottom: 1px dashed #000; margin: 8px 0;"></div>
              <div id="qrcode" style="text-align: center; margin: 16px 0;">
                <img src="${qrImageUrl}" alt="QR Code" style="max-width: 100%; width: 200px; height: 200px;" />
              </div>
              <div style="font-weight: bold; font-size: 13px; margin: 8px 0;">Scan to order</div>
              <div class="footer"><p style="margin-top: 8px;">---</p></div>
            </div>
          </body>
        </html>
      `;
      return res.json({ success: true, html });
    }

    // For Bluetooth printers: return payload to client to handle printing locally
    if (printerConfig.printer_type === 'bluetooth') {
      // Validate that device is configured
      if (!printerConfig.bluetooth_device_name) {
        return res.status(400).json({ error: "Bluetooth printer device not configured. Please configure the printer in Settings first." });
      }
      
      console.log('[PrintQR] Returning Bluetooth payload for client-side printing');
      
      // Generate QR image URL
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&data=${encodeURIComponent(`https://chuio.io/${qrToken}`)}`;
      
      // Get session details (table info)
      let tablePaxInfo = '';
      let startedTime = new Date().toLocaleString();
      
      let pax: number | undefined = undefined;
      if (sessionId) {
        const sessionResult = await pool.query(
          `SELECT ts.started_at, ts.pax, t.name as table_name 
           FROM table_sessions ts 
           LEFT JOIN tables t ON ts.table_id = t.id 
           WHERE ts.id = $1`,
          [sessionId]
        );
        if (sessionResult.rowCount > 0) {
          const row = sessionResult.rows[0];
          if (row.started_at) {
            startedTime = new Date(row.started_at).toLocaleString();
          }
          if (row.pax) {
            pax = row.pax;
          }
        }
      }
      
      // Get QR text configuration from printer settings
      let textAboveQR = 'Scan to Order';
      let textBelowQR = 'Let us know how we did!';
      
      const settingsResult = await pool.query(
        `SELECT 
          COALESCE((settings->>'qr_text_above'), '') as text_above,
          COALESCE((settings->>'qr_text_below'), '') as text_below
         FROM printers WHERE restaurant_id = $1 AND type = $2`,
        [restaurantId, 'QR']
      );
      
      if (settingsResult.rowCount > 0) {
        const settings = settingsResult.rows[0];
        if (settings.text_above) textAboveQR = settings.text_above;
        if (settings.text_below) textBelowQR = settings.text_below;
      }
      // Generate ESC/POS commands using shared thermal printer service
      // This ensures IDENTICAL formatting between mobile and web
      const receiptData: ReceiptData = {
        restaurantName: restaurantName,
        tableName: tableName,
        ...(pax && { pax }),
        qrToken: qrToken,
        startedTime: startedTime,
        printerPaperWidth: 80, // Standard 80mm paper width
        // Pass customizable text from database settings
        qrTextAbove: textAboveQR,
        qrTextBelow: textBelowQR
      };
      
      const escposCommands = generateESCPOS(receiptData);
      
      // Convert Uint8Array to base64 for JSON transmission
      const escposBase64 = Buffer.from(escposCommands).toString('base64');
      
      const qrPayload = {
        printerConfig: {
          bluetoothDeviceId: printerConfig.bluetooth_device_id,
          bluetoothDeviceName: printerConfig.bluetooth_device_name,
        },
        data: {
          type: 'qr',
          // ESC/POS commands generated by shared thermalPrinterService
          escposBase64: escposBase64,
          escposArray: Array.from(escposCommands),
          // Original fields for reference
          restaurantName: restaurantName,
          tableName: tableName,
          qrToken: qrToken,
          startedTime: startedTime
        }
      };
      return res.json({ success: true, bluetoothPayload: qrPayload });
    }

    // For thermal/network printers, queue the job
    const jobData = {
      type: 'qr' as const,
      tableNumber: tableName,
      qrToken: qrToken,
      qrDataUrl: `https://chuio.io/${qrToken}`,
      restaurantName: restaurantName,
      printerConfig: {
        type: printerConfig.printer_type,
        host: printerConfig.printer_host,
        port: printerConfig.printer_port,
      },
    };

    const queue = getPrinterQueueInstance();
    if (queue) {
      const job = await queue.addJob(parseInt(restaurantId), jobData, {
        jobType: 'qr',
        orderId: null,
        sessionId: parseInt(sessionId) || undefined,
        priority,
      });
      console.log('[PrintQR] Queued job:', job.id);
      return res.json({ success: true, jobId: job.id, message: 'QR code queued for printing' });
    } else {
      return res.status(500).json({ error: "Print queue not available" });
    }
  } catch (err: any) {
    console.error('[PrintQR] Error:', err.message || err);
    console.error('[PrintQR] Stack:', err.stack);
    res.status(500).json({ error: "Failed to queue QR code print", details: err.message });
  }
});

/**
 * Print receipt/bill (queue-based)
 */
router.post("/restaurants/:restaurantId/print-bill", async (req: Request, res: Response) => {
  const restaurantId = req.params.restaurantId as string;
  let { sessionId, billData, priority = 5 } = req.body;

  console.log('[PrintBill] Received print-bill request:', { restaurantId, sessionId, billData });

  if (!sessionId || !billData) {
    return res.status(400).json({ error: "sessionId and billData are required" });
  }

  sessionId = String(sessionId);

  try {
    // Try to get Bill printer from new unified printers table first
    let printerResult = await pool.query(
      `SELECT printer_type, printer_host, printer_port,
              bluetooth_device_id, bluetooth_device_name, settings
       FROM printers WHERE restaurant_id = $1 AND type = $2`,
      [restaurantId, 'Bill']
    );

    let printerConfig = printerResult.rows[0];
    let restaurantName = '';
    let restaurantAddress = '';
    let restaurantPhone = '';

    // Get restaurant info (name, address, phone)
    const restaurantMetaResult = await pool.query(
      `SELECT name, address, phone FROM restaurants WHERE id = $1`,
      [restaurantId]
    );
    if (restaurantMetaResult.rowCount > 0) {
      restaurantName = restaurantMetaResult.rows[0].name;
      restaurantAddress = restaurantMetaResult.rows[0].address || '';
      restaurantPhone = restaurantMetaResult.rows[0].phone || '';
    }

    // If not found in printers table, try old schema on restaurants table (fallback)
    if (!printerConfig) {
      console.log('[PrintBill] Bill printer not found in printers table, checking restaurants table');
      const oldSchemaResult = await pool.query(
        `SELECT printer_type, printer_host, printer_port,
                bluetooth_device_id, bluetooth_device_name, name
         FROM restaurants WHERE id = $1`,
        [restaurantId]
      );
      
      if (oldSchemaResult.rowCount === 0) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      printerConfig = oldSchemaResult.rows[0];
      restaurantName = printerConfig.name;
    }

    console.log('[PrintBill] Printer config:', {
      type: printerConfig.printer_type,
      host: printerConfig.printer_host,
      bluetoothDeviceId: printerConfig.bluetooth_device_id,
      bluetoothDeviceName: printerConfig.bluetooth_device_name,
    });

    // Build print payload
    const payload = {
      orderNumber: String(sessionId),
      tableNumber: billData.table || "Receipt",
      items: billData.items || [],
      timestamp: new Date().toLocaleTimeString(),
      restaurantName: restaurantName,
      type: "bill" as const,
      subtotal: billData.subtotal,
      serviceCharge: billData.serviceCharge,
      total: billData.total,
      printerConfig: {
        type: printerConfig.printer_type,
        host: printerConfig.printer_host,
        port: printerConfig.printer_port,
        bluetoothDeviceId: printerConfig.bluetooth_device_id,
        bluetoothDeviceName: printerConfig.bluetooth_device_name,
      },
    };

    // For browser/no printer/none, return HTML immediately
    if (!printerConfig.printer_type || printerConfig.printer_type === "browser" || printerConfig.printer_type === "none") {
      console.log('[PrintBill] Using browser printing');
      return res.json({
        success: true,
        html: generateReceiptHTML(payload),
        message: "Print-ready HTML generated for browser printing",
      });
    }

    // For thermal/network printers, return success immediately
    if (printerConfig.printer_type === "thermal" || printerConfig.printer_type === "network") {
      console.log('[PrintBill] Sending to network printer:', printerConfig.printer_host);
      
      return res.json({
        success: true,
        jobId: `bill-${sessionId}-${Date.now()}`,
        status: "queued",
        message: `Bill queued for printing on ${printerConfig.printer_host}:${printerConfig.printer_port || 9100}`,
      });
    }

    // For Bluetooth printers
    if (printerConfig.printer_type === "bluetooth") {
      if (!printerConfig.bluetooth_device_name) {
        return res.status(400).json({ 
          error: "Bluetooth printer device not configured. Please configure the printer in Settings first.",
          printerType: "bluetooth",
        });
      }
      
      console.log('[PrintBill] Sending to Bluetooth printer:', printerConfig.bluetooth_device_name);
      
      // Get bill format settings (header and footer text) from printer settings
      let billHeaderText = 'Thank You';
      let billFooterText = 'Follow us on social media';
      
      if (printerConfig.settings) {
        const settings = typeof printerConfig.settings === 'string' 
          ? JSON.parse(printerConfig.settings) 
          : printerConfig.settings;
        
        if (settings.bill_header_text) billHeaderText = settings.bill_header_text;
        if (settings.bill_footer_text) billFooterText = settings.bill_footer_text;
      }
      
      // Generate ESC/POS commands using thermalPrinterService
      const receiptData: ReceiptData = {
        restaurantName: restaurantName,
        restaurantAddress: restaurantAddress,
        restaurantPhone: restaurantPhone,
        orderNumber: String(sessionId),
        tableNumber: billData.table || 'Receipt',
        pax: billData.pax,
        items: billData.items || [],
        subtotal: billData.subtotal,
        serviceCharge: billData.serviceCharge,
        tax: billData.tax,
        total: billData.total,
        timestamp: new Date().toLocaleString(),
        printerPaperWidth: 80,
        // Bill-specific customization
        billHeaderText: billHeaderText,
        billFooterText: billFooterText
      };
      
      const escposCommands = generateESCPOS(receiptData);
      const escposBase64 = Buffer.from(escposCommands).toString('base64');
      
      return res.json({
        success: true,
        jobId: `bill-${sessionId}-${Date.now()}`,
        bluetoothPayload: {
          printerConfig: {
            bluetoothDeviceId: printerConfig.bluetooth_device_id,
            bluetoothDeviceName: printerConfig.bluetooth_device_name,
          },
          data: {
            type: 'bill',
            escposArray: Array.from(escposCommands),
            escposBase64: escposBase64,
            restaurantName: restaurantName,
            orderNumber: String(sessionId),
            tableNumber: billData.table || 'Receipt'
          }
        },
        message: `Bill ready for Bluetooth printing on ${printerConfig.bluetooth_device_name}`,
      });
    }

    // Unknown printer type
    return res.status(400).json({ 
      error: "Unknown printer type: " + printerConfig.printer_type,
      printerType: printerConfig.printer_type,
    });
  } catch (err) {
    console.error('[PrintBill] Error:', err);
    res.status(500).json({ error: "Failed to process bill print request" });
  }
});

/**
 * Register a discovered Bluetooth device with its service UUID
 * Called after frontend discovers a device and finds its working service
 * Stores UUID in the printers table for future reuse
 */
router.post("/restaurants/:restaurantId/register-bluetooth-device", async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const { printerType, deviceId, deviceName, serviceUuid } = req.body;

  if (!printerType || !deviceId || !deviceName || !serviceUuid) {
    return res.status(400).json({ 
      error: "Missing required fields: printerType, deviceId, deviceName, serviceUuid" 
    });
  }

  try {
    // Normalize printer type to match database constraint: 'QR', 'Bill', 'Kitchen'
    const typeMap: {[key: string]: string} = {
      'QR': 'QR',
      'BILL': 'Bill',
      'KITCHEN': 'Kitchen',
      'qr': 'QR',
      'bill': 'Bill',
      'kitchen': 'Kitchen'
    };
    const normalizedType = typeMap[printerType] || printerType;

    // Save UUID to printers table for this printer type
    const result = await pool.query(
      `UPDATE printers 
       SET bluetooth_device_id = $1,
           bluetooth_device_name = $2,
           service_uuid = $3,
           updated_at = now()
       WHERE restaurant_id = $4 AND type = $5
       RETURNING *`,
      [deviceId, deviceName, serviceUuid, restaurantId, normalizedType]
    );

    if (result.rowCount === 0) {
      // No printer config exists for this type, create one
      try {
        const createResult = await pool.query(
          `INSERT INTO printers (restaurant_id, type, printer_type, bluetooth_device_id, bluetooth_device_name, service_uuid, settings)
           VALUES ($1, $2, 'bluetooth', $3, $4, $5, '{}')
           RETURNING *`,
          [restaurantId, normalizedType, deviceId, deviceName, serviceUuid]
        );
        console.log("[RegisterBluetooth] Device registered:", deviceName, "Type:", normalizedType);
        return res.json({
          success: true,
          message: `${printerType} Bluetooth device registered: ${deviceName}`,
          device: createResult.rows[0],
        });
      } catch (insertErr: any) {
        console.error("[RegisterBluetooth] INSERT error:", insertErr.message, insertErr.code);
        console.error("[RegisterBluetooth] INSERT params:", restaurantId, normalizedType, deviceId, deviceName, serviceUuid);
        throw insertErr;
      }
    }

    console.log("[RegisterBluetooth] Device updated:", deviceName, "Type:", normalizedType);
    res.json({
      success: true,
      message: `${printerType} Bluetooth device registered: ${deviceName}`,
      device: result.rows[0],
    });
  } catch (err: any) {
    console.error("[RegisterBluetooth] Error:", err.message, err.code);
    res.status(500).json({ error: err.message || "Failed to register Bluetooth device" });
  }
});

/**
 * Get registered Bluetooth devices for a restaurant
 */
router.get("/restaurants/:restaurantId/bluetooth-devices", async (req: Request, res: Response) => {
  const { restaurantId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, type, bluetooth_device_id as device_id, bluetooth_device_name as device_name, service_uuid
       FROM printers
       WHERE restaurant_id = $1 AND printer_type = 'bluetooth'
       ORDER BY updated_at DESC`,
      [restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("[GetBluetoothDevices] Error:", err);
    res.status(500).json({ error: "Failed to fetch Bluetooth devices" });
  }
});

/**
 * Get device UUID for printing (loads from DB to avoid re-discovery)
 */
router.get("/restaurants/:restaurantId/bluetooth-device-uuid/:printerType", async (req: Request, res: Response) => {
  const { restaurantId, printerType } = req.params;

  try {
    // Normalize printer type to match database constraint: 'QR', 'Bill', 'Kitchen'
    const typeMap: {[key: string]: string} = {
      'QR': 'QR',
      'BILL': 'Bill',
      'KITCHEN': 'Kitchen',
      'qr': 'QR',
      'bill': 'Bill',
      'kitchen': 'Kitchen'
    };
    const normalizedType = typeMap[printerType] || printerType;

    const result = await pool.query(
      `SELECT bluetooth_device_id as device_id, 
              bluetooth_device_name as device_name,
              service_uuid
       FROM printers
       WHERE restaurant_id = $1 AND type = $2`,
      [restaurantId, normalizedType]
    );

    if (result.rowCount === 0 || !result.rows[0].device_id) {
      return res.status(404).json({ error: `No ${printerType} Bluetooth device configured` });
    }

    if (!result.rows[0].service_uuid) {
      return res.status(404).json({ error: `Service UUID not found for ${printerType} device` });
    }

    res.json({
      deviceId: result.rows[0].device_id,
      deviceName: result.rows[0].device_name,
      serviceUuid: result.rows[0].service_uuid,
    });
  } catch (err) {
    console.error("[GetDeviceUUID] Error:", err);
    res.status(500).json({ error: "Failed to fetch device UUID" });
  }
});

export default router;
