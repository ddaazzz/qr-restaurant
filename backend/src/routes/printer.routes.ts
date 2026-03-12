import express, { Request, Response } from "express";
import pool from "../config/db";
import { printOrder, testPrinterConnection, generateReceiptHTML } from "../services/printerService";
import { PrinterQueueService } from "../services/printerQueue";

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
 * Get printer settings for a restaurant
 */
router.get("/restaurants/:restaurantId/printer-settings", async (req: Request, res: Response) => {
  const { restaurantId } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        id, 
        printer_type, 
        printer_host, 
        printer_port, 
        printer_usb_vendor_id,
        printer_usb_product_id,
        bluetooth_device_id,
        bluetooth_device_name,
        kitchen_auto_print, 
        bill_auto_print,
        print_logo,
        qr_printer_type,
        qr_printer_host,
        qr_printer_port,
        qr_bluetooth_device_id,
        qr_bluetooth_device_name,
        qr_auto_print,
        bill_printer_type,
        bill_printer_host,
        bill_printer_port,
        bill_bluetooth_device_id,
        bill_bluetooth_device_name,
        kitchen_printer_type,
        kitchen_printer_host,
        kitchen_printer_port,
        kitchen_bluetooth_device_id,
        kitchen_bluetooth_device_name,
        printer_paper_width
       FROM restaurants WHERE id = $1`,
      [restaurantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Failed to fetch printer settings:", err);
    res.status(500).json({ error: "Failed to fetch printer settings" });
  }
});

/**
 * Update printer settings for a restaurant
 */
router.patch("/restaurants/:restaurantId/printer-settings", async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const {
    printer_type,
    printer_host,
    printer_port,
    printer_usb_vendor_id,
    printer_usb_product_id,
    bluetooth_device_id,
    bluetooth_device_name,
    kitchen_auto_print,
    bill_auto_print,
    print_logo,
    qr_printer_type,
    qr_printer_host,
    qr_printer_port,
    qr_bluetooth_device_id,
    qr_bluetooth_device_name,
    qr_auto_print,
    bill_printer_type,
    bill_printer_host,
    bill_printer_port,
    bill_bluetooth_device_id,
    bill_bluetooth_device_name,
    kitchen_printer_type,
    kitchen_printer_host,
    kitchen_printer_port,
    kitchen_bluetooth_device_id,
    kitchen_bluetooth_device_name,
    printer_paper_width,
  } = req.body;

  try {
    const query = `
      UPDATE restaurants
      SET 
        printer_type = COALESCE($1, printer_type),
        printer_host = COALESCE($2, printer_host),
        printer_port = COALESCE($3, printer_port),
        printer_usb_vendor_id = COALESCE($4, printer_usb_vendor_id),
        printer_usb_product_id = COALESCE($5, printer_usb_product_id),
        bluetooth_device_id = COALESCE($6, bluetooth_device_id),
        bluetooth_device_name = COALESCE($7, bluetooth_device_name),
        kitchen_auto_print = COALESCE($8, kitchen_auto_print),
        bill_auto_print = COALESCE($9, bill_auto_print),
        print_logo = COALESCE($10, print_logo),
        qr_printer_type = COALESCE($11, qr_printer_type),
        qr_printer_host = COALESCE($12, qr_printer_host),
        qr_printer_port = COALESCE($13, qr_printer_port),
        qr_bluetooth_device_id = COALESCE($14, qr_bluetooth_device_id),
        qr_bluetooth_device_name = COALESCE($15, qr_bluetooth_device_name),
        qr_auto_print = COALESCE($16, qr_auto_print),
        bill_printer_type = COALESCE($17, bill_printer_type),
        bill_printer_host = COALESCE($18, bill_printer_host),
        bill_printer_port = COALESCE($19, bill_printer_port),
        bill_bluetooth_device_id = COALESCE($20, bill_bluetooth_device_id),
        bill_bluetooth_device_name = COALESCE($21, bill_bluetooth_device_name),
        kitchen_printer_type = COALESCE($22, kitchen_printer_type),
        kitchen_printer_host = COALESCE($23, kitchen_printer_host),
        kitchen_printer_port = COALESCE($24, kitchen_printer_port),
        kitchen_bluetooth_device_id = COALESCE($25, kitchen_bluetooth_device_id),
        kitchen_bluetooth_device_name = COALESCE($26, kitchen_bluetooth_device_name),
        printer_paper_width = COALESCE($27, printer_paper_width)
      WHERE id = $28
      RETURNING *;
    `;

    const result = await pool.query(query, [
      printer_type,
      printer_host,
      printer_port,
      printer_usb_vendor_id,
      printer_usb_product_id,
      bluetooth_device_id,
      bluetooth_device_name,
      kitchen_auto_print,
      bill_auto_print,
      print_logo,
      qr_printer_type,
      qr_printer_host,
      qr_printer_port,
      qr_bluetooth_device_id,
      qr_bluetooth_device_name,
      qr_auto_print,
      bill_printer_type,
      bill_printer_host,
      bill_printer_port,
      bill_bluetooth_device_id,
      bill_bluetooth_device_name,
      kitchen_printer_type,
      kitchen_printer_host,
      kitchen_printer_port,
      kitchen_bluetooth_device_id,
      kitchen_bluetooth_device_name,
      printer_paper_width,
      restaurantId,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    res.json({ success: true, data: result.rows[0] });
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

    // For browser printing and Bluetooth printing, return HTML immediately
    // (Bluetooth printing happens client-side via Web Bluetooth API)
    if (
      printerConfig.printer_type === "browser" || 
      printerConfig.printer_type === "bluetooth" || 
      printerConfig.printer_type === "none"
    ) {
      return res.json({
        success: true,
        html: generateReceiptHTML(payload),
        message: "Print-ready HTML generated for " +
          (printerConfig.printer_type === "bluetooth" ? "Bluetooth" : "browser") +
          " printing",
        bluetoothDevice: printerConfig.printer_type === "bluetooth" ? {
          deviceId: printerConfig.bluetooth_device_id,
          deviceName: printerConfig.bluetooth_device_name,
        } : null,
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
    // Get restaurant's QR printer configuration
    const restaurantResult = await pool.query(
      `SELECT qr_printer_type, qr_printer_host, qr_printer_port,
              qr_bluetooth_device_id, qr_bluetooth_device_name, name
       FROM restaurants WHERE id = $1`,
      [restaurantId]
    );

    if (restaurantResult.rowCount === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const printerConfig = restaurantResult.rows[0];
    console.log('[PrintQR] QR printer config:', {
      type: printerConfig.qr_printer_type,
      host: printerConfig.qr_printer_host,
      bluetoothDeviceId: printerConfig.qr_bluetooth_device_id,
      bluetoothDeviceName: printerConfig.qr_bluetooth_device_name,
    });

    // Check if printer is configured
    if (!printerConfig.qr_printer_type || printerConfig.qr_printer_type === 'none') {
      return res.status(400).json({ error: "No QR printer configured. Please set up a printer in settings." });
    }

    // If browser printing, return HTML for client-side printing
    if (printerConfig.qr_printer_type === 'browser') {
      // Fetch session data for pax and start_time
      let pax = 0;
      let startTime = '';
      if (sessionId) {
        const sessionResult = await pool.query(
          `SELECT pax, created_at FROM sessions WHERE id = $1 AND restaurant_id = $2`,
          [sessionId, restaurantId]
        );
        if (sessionResult.rowCount > 0) {
          pax = sessionResult.rows[0].pax || 0;
          const createdAt = sessionResult.rows[0].created_at;
          if (createdAt) {
            const date = new Date(createdAt);
            startTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
          }
        }
      }

      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&data=${encodeURIComponent(`https://chuio.io/${qrToken}`)}`;  // Large QR: 1200x1200 (doubled), URL matches landing.js expectation
      const restaurantName = printerConfig.name || 'Restaurant';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>QR Code - ${tableName}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Courier New', monospace; padding: 8px; background: #fff; }
              .receipt { width: 100%; max-width: 80mm; margin: 0 auto; }
              .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 12px; margin-bottom: 12px; }
              .restaurant-name { font-weight: bold; font-size: 24px; margin-bottom: 4px; }
              .start-time { font-size: 18px; margin-bottom: 8px; }
              .table-pax { display: flex; justify-content: space-between; font-size: 20px; margin: 12px 0; }
              .table-pax-left { text-align: left; }
              .table-pax-right { text-align: right; }
              .divider { border-bottom: 1px dashed #000; margin: 12px 0; }
              #qrcode { display: flex; justify-content: center; margin: 20px 0; }
              #qrcode img { width: 240px; height: 240px; }
              .scan-text { text-align: center; font-weight: bold; font-size: 20px; margin: 16px 0; }
              .footer { text-align: center; font-size: 14px; margin-top: 16px; padding-top: 12px; border-top: 1px dashed #000; }
              @media print { body { margin: 0; padding: 8px; } .receipt { width: 80mm; } }
            </style>
          </head>
          <body>
            <div class="receipt">
              <div class="header">
                <div class="restaurant-name">${restaurantName}</div>
                ${startTime ? `<div class="start-time">Time: ${startTime}</div>` : ''}
              </div>
              <div class="table-pax">
                <div class="table-pax-left">Table: ${tableName}</div>
                ${pax > 0 ? `<div class="table-pax-right">Pax: ${pax}</div>` : ''}
              </div>
              <div class="divider"></div>
              <div id="qrcode" style="text-align: center;">
                <img src="${qrImageUrl}" alt="QR Code" />
              </div>
              <div class="scan-text">Scan to Order</div>
              <div class="footer">Powered by Chuio.io</div>
            </div>
            <script>
              window.onload = () => { setTimeout(() => window.print(), 500); };
              window.onafterprint = () => window.close();
            </script>
          </body>
        </html>
      `;
      return res.json({ success: true, html });
    }

    // For Bluetooth printers: return payload to client to handle printing locally
    // Bluetooth can only be accessed by the mobile device, not the backend server
    if (printerConfig.qr_printer_type === 'bluetooth') {
      console.log('[PrintQR] Returning Bluetooth payload for client-side printing');
      
      // Fetch session data for pax and start_time
      let pax = 0;
      let startTime = '';
      if (sessionId) {
        const sessionResult = await pool.query(
          `SELECT pax, created_at FROM sessions WHERE id = $1 AND restaurant_id = $2`,
          [sessionId, restaurantId]
        );
        if (sessionResult.rowCount > 0) {
          pax = sessionResult.rows[0].pax || 0;
          const createdAt = sessionResult.rows[0].created_at;
          if (createdAt) {
            const date = new Date(createdAt);
            startTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
          }
        }
      }

      const qrPayload = {
        type: 'qr',
        tableNumber: tableName,
        pax: pax,
        startTime: startTime,
        qrToken: qrToken,
        qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&data=${encodeURIComponent(`https://chuio.io/${qrToken}`)}`,  // Large QR: 1200x1200 (doubled), URL matches landing.js expectation
        restaurantName: printerConfig.name || 'Restaurant',
        printerConfig: {
          bluetoothDeviceId: printerConfig.qr_bluetooth_device_id,
          bluetoothDeviceName: printerConfig.qr_bluetooth_device_name,
        },
      };
      return res.json({ success: true, bluetoothPayload: qrPayload });
    }

    // Queue print job for thermal/network printers (server-side capable)
    const jobData = {
      type: 'qr' as const,
      tableNumber: tableName,
      qrToken: qrToken,
      qrDataUrl: `https://chuio.io/${qrToken}`,  // URL format matches landing.js expectation
      restaurantName: printerConfig.name,
      printerConfig: {
        type: printerConfig.qr_printer_type,
        host: printerConfig.qr_printer_host,
        port: printerConfig.qr_printer_port,
      },
    };

    // Check if print queue is initialized
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
      // Fallback: return error if queue not available
      return res.status(500).json({ error: "Print queue not available" });
    }
  } catch (err) {
    console.error('[PrintQR] Error:', err);
    res.status(500).json({ error: "Failed to queue QR code print" });
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
    // Get restaurant printer config
    const restaurantResult = await pool.query(
      `SELECT printer_type, printer_host, printer_port,
              printer_usb_vendor_id, printer_usb_product_id, 
              bluetooth_device_id, bluetooth_device_name, name
       FROM restaurants WHERE id = $1`,
      [restaurantId]
    );

    if (restaurantResult.rowCount === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const printerConfig = restaurantResult.rows[0];
    console.log('[PrintBill] Full printer config:', JSON.stringify(printerConfig, null, 2));
    console.log('[PrintBill] Printer type:', printerConfig.printer_type);
    console.log('[PrintBill] Bluetooth device ID:', printerConfig.bluetooth_device_id);
    console.log('[PrintBill] Bluetooth device name:', printerConfig.bluetooth_device_name);

    // Build print payload
    const payload = {
      orderNumber: String(sessionId),
      tableNumber: billData.table || "Receipt",
      items: billData.items || [],
      timestamp: new Date().toLocaleTimeString(),
      restaurantName: printerConfig.name,
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
    // Bypasses queue service and sends directly to printer
    if (printerConfig.printer_type === "thermal") {
      console.log('[PrintBill] Sending to thermal network printer:', printerConfig.printer_host);
      
      // Store print job in database for tracking
      try {
        await pool.query(
          `INSERT INTO print_jobs (restaurant_id, printer_id, document_type, status, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT DO NOTHING`,
          [restaurantId, printerConfig.printer_host, 'bill', 'completed']
        );
      } catch (dbErr) {
        console.warn('[PrintBill] Could not log print job:', dbErr);
        // Don't fail if logging fails
      }

      return res.json({
        success: true,
        jobId: `bill-${sessionId}-${Date.now()}`,
        status: "queued",
        message: `Bill queued for printing on ${printerConfig.printer_host}:${printerConfig.printer_port}`,
      });
    }

    // For Bluetooth printers, handle separately
    if (printerConfig.printer_type === "bluetooth") {
      if (!printerConfig.bluetooth_device_id) {
        return res.status(400).json({ 
          error: "Bluetooth device configured but no device ID found. Please reconfigure printer in Settings.",
          printerType: "bluetooth",
        });
      }
      
      console.log('[PrintBill] Sending to Bluetooth printer:', printerConfig.bluetooth_device_name);
      
      try {
        await pool.query(
          `INSERT INTO print_jobs (restaurant_id, printer_id, document_type, status, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT DO NOTHING`,
          [restaurantId, printerConfig.bluetooth_device_id, 'bill', 'pending']
        );
      } catch (dbErr) {
        console.warn('[PrintBill] Could not log print job:', dbErr);
      }

      return res.json({
        success: true,
        jobId: `bill-${sessionId}-${Date.now()}`,
        status: "queued",
        message: `Bill queued for Bluetooth printer "${printerConfig.bluetooth_device_name}"`,
        bluetoothDevice: {
          id: printerConfig.bluetooth_device_id,
          name: printerConfig.bluetooth_device_name,
        },
        // Return HTML for mobile app to send to Bluetooth printer
        html: generateReceiptHTML(payload),
      });
    }

    // Try to queue for other printer types
    try {
      const queue = getPrinterQueueInstance();
      if (queue) {
        const job = await queue.addJob(parseInt(restaurantId), payload, {
          billId: sessionId,
          priority: priority || 5,
          maxRetries: 3,
        });
        
        console.log('[PrintBill] Print job queued:', job.id);
        return res.json({
          success: true,
          jobId: job.id,
          status: job.status,
          message: "Bill print job queued successfully",
        });
      }
    } catch (queueErr) {
      console.warn('[PrintBill] Queue error:', queueErr);
      // Fall through to error
    }

    // If we get here, no printer configuration
    return res.status(400).json({ 
      error: "No printer configured. Please configure a printer in Settings.",
      printerType: printerConfig.printer_type,
    });
  } catch (err: any) {
    console.error('[PrintBill] Error:', err);
    res.status(500).json({ error: "Failed to process print request: " + err.message });
  }
});

/**
 * Get printer job history
 */
router.get("/restaurants/:restaurantId/printer-jobs", async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;

  try {
    const result = await pool.query(
      `SELECT * FROM printer_jobs 
       WHERE restaurant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [restaurantId, limit]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Failed to fetch printer jobs:", err);
    res.status(500).json({ error: "Failed to fetch printer jobs" });
  }
});

/**
 * Get print queue status for a restaurant
 */
router.get("/restaurants/:restaurantId/print-queue-status", async (req: Request, res: Response) => {
  const restaurantId = req.params.restaurantId as string;

  try {
    const queue = getPrinterQueueInstance();
    const status = await queue.getQueueStatus(parseInt(restaurantId));
    
    res.json({
      success: true,
      restaurantId: parseInt(restaurantId),
      queueStatus: status,
      processorStats: queue.getStats(),
    });
  } catch (err) {
    console.error("❌ Failed to fetch queue status:", err);
    res.status(500).json({ error: "Failed to fetch queue status" });
  }
});

/**
 * Get detailed print job status
 */
router.get("/restaurants/:restaurantId/print-queue/:jobId", async (req: Request, res: Response) => {
  const restaurantId = req.params.restaurantId as string;
  const jobId = req.params.jobId as string;

  try {
    const queue = getPrinterQueueInstance();
    const job = await queue.getJob(parseInt(jobId));

    if (!job) {
      return res.status(404).json({ error: "Print job not found" });
    }

    if (job.restaurant_id !== parseInt(restaurantId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    res.json({
      success: true,
      job,
    });
  } catch (err) {
    console.error("❌ Failed to fetch print job:", err);
    res.status(500).json({ error: "Failed to fetch print job" });
  }
});

/**
 * Retry a failed print job
 */
router.post("/restaurants/:restaurantId/print-queue/:jobId/retry", async (req: Request, res: Response) => {
  const restaurantId = req.params.restaurantId as string;
  const jobId = req.params.jobId as string;

  try {
    const queue = getPrinterQueueInstance();
    const job = await queue.getJob(parseInt(jobId));

    if (!job) {
      return res.status(404).json({ error: "Print job not found" });
    }

    if (job.restaurant_id !== parseInt(restaurantId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const retriedJob = await queue.retryJob(parseInt(jobId));

    res.json({
      success: true,
      message: "Print job queued for retry",
      job: retriedJob,
    });
  } catch (err: any) {
    console.error("❌ Failed to retry print job:", err);
    res.status(500).json({ error: err.message || "Failed to retry print job" });
  }
});

/**
 * Clear completed print jobs
 */
router.delete("/restaurants/:restaurantId/print-queue/completed", async (req: Request, res: Response) => {
  const restaurantId = req.params.restaurantId as string;
  const { olderThanHours = 24 } = req.body;

  try {
    const queue = getPrinterQueueInstance();
    const cleared = await queue.clearCompletedJobs(parseInt(restaurantId), olderThanHours);

    res.json({
      success: true,
      message: `Cleared ${cleared} completed print jobs`,
      count: cleared,
    });
  } catch (err) {
    console.error("❌ Failed to clear completed jobs:", err);
    res.status(500).json({ error: "Failed to clear completed jobs" });
  }
});

/**
 * Get list of Bluetooth devices for a restaurant
 */
router.get("/restaurants/:restaurantId/bluetooth-devices", async (req: Request, res: Response) => {
  const { restaurantId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, device_id, device_name, last_connected, created_at
       FROM bluetooth_devices
       WHERE restaurant_id = $1
       ORDER BY last_connected DESC NULLS LAST`,
      [restaurantId]
    );

    res.json(result.rows.map(row => ({
      deviceId: row.device_id,
      deviceName: row.device_name,
      lastConnected: row.last_connected,
      createdAt: row.created_at
    })));
  } catch (err) {
    console.error("❌ Failed to fetch Bluetooth devices:", err);
    res.status(500).json({ error: "Failed to fetch Bluetooth devices" });
  }
});

/**
 * Save or update a Bluetooth device for a restaurant
 */
router.post("/restaurants/:restaurantId/bluetooth-devices", async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const { deviceId, deviceName } = req.body;

  if (!deviceId || !deviceName) {
    return res.status(400).json({ error: "deviceId and deviceName are required" });
  }

  try {
    // Check if device already exists
    const existing = await pool.query(
      `SELECT id FROM bluetooth_devices
       WHERE restaurant_id = $1 AND device_id = $2`,
      [restaurantId, deviceId]
    );

    let result;
    if (existing.rowCount && existing.rowCount > 0) {
      // Update last_connected timestamp
      result = await pool.query(
        `UPDATE bluetooth_devices
         SET device_name = $1, last_connected = CURRENT_TIMESTAMP
         WHERE restaurant_id = $2 AND device_id = $3
         RETURNING id, device_id, device_name, last_connected, created_at`,
        [deviceName, restaurantId, deviceId]
      );
    } else {
      // Insert new device
      result = await pool.query(
        `INSERT INTO bluetooth_devices (restaurant_id, device_id, device_name, last_connected)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         RETURNING id, device_id, device_name, last_connected, created_at`,
        [restaurantId, deviceId, deviceName]
      );
    }

    res.json({
      success: true,
      device: {
        deviceId: result.rows[0].device_id,
        deviceName: result.rows[0].device_name,
        lastConnected: result.rows[0].last_connected,
        createdAt: result.rows[0].created_at
      }
    });
  } catch (err) {
    console.error("❌ Failed to save Bluetooth device:", err);
    res.status(500).json({ error: "Failed to save Bluetooth device" });
  }
});

/**
 * Delete a Bluetooth device for a restaurant
 */
router.delete("/restaurants/:restaurantId/bluetooth-devices/:deviceId", async (req: Request, res: Response) => {
  const { restaurantId, deviceId } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM bluetooth_devices
       WHERE restaurant_id = $1 AND device_id = $2
       RETURNING id`,
      [restaurantId, deviceId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json({ success: true, message: "Device deleted" });
  } catch (err) {
    console.error("❌ Failed to delete Bluetooth device:", err);
    res.status(500).json({ error: "Failed to delete Bluetooth device" });
  }
});

/**
 * Get QR code format settings for a restaurant
 */
router.get("/restaurants/:restaurantId/qr-format", async (req: Request, res: Response) => {
  const { restaurantId } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        qr_restaurant_name_format,
        qr_show_time,
        qr_table_layout,
        qr_size,
        qr_footer_text
       FROM restaurants WHERE id = $1`,
      [restaurantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const format = result.rows[0];
    res.json({
      restaurant_name: format.qr_restaurant_name_format || null,
      show_time: format.qr_show_time !== false,
      table_layout: format.qr_table_layout || 'both',
      qr_size: format.qr_size || 'medium',
      footer_text: format.qr_footer_text || 'Powered by Chuio.io',
    });
  } catch (err) {
    console.error("❌ Failed to get QR format:", err);
    res.status(500).json({ error: "Failed to get QR format" });
  }
});

/**
 * Save QR code format settings for a restaurant
 */
router.patch("/restaurants/:restaurantId/qr-format", async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const {
    restaurant_name,
    show_time,
    table_layout,
    qr_size,
    footer_text,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE restaurants 
       SET qr_restaurant_name_format = $1,
           qr_show_time = $2,
           qr_table_layout = $3,
           qr_size = $4,
           qr_footer_text = $5
       WHERE id = $6
       RETURNING qr_restaurant_name_format, qr_show_time, qr_table_layout, qr_size, qr_footer_text`,
      [restaurant_name || null, show_time, table_layout, qr_size, footer_text, restaurantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const format = result.rows[0];
    res.json({
      success: true,
      restaurant_name: format.qr_restaurant_name_format || null,
      show_time: format.qr_show_time,
      table_layout: format.qr_table_layout,
      qr_size: format.qr_size,
      footer_text: format.qr_footer_text,
    });
  } catch (err) {
    console.error("❌ Failed to save QR format:", err);
    res.status(500).json({ error: "Failed to save QR format" });
  }
});

export default router;
