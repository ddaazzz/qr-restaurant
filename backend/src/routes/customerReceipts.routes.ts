import express, { Request, Response } from "express";
import pool from "../config/db";
import { getCustomerReceiptService } from "../services/customerReceipt";

const router = express.Router();

/**
 * Send email receipt directly for a session (bypasses customer_receipt_enabled check).
 * Called by staff via the "Email Receipt" button or post-payment prompt.
 */
router.post("/sessions/:sessionId/receipts/send-email", async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const { restaurantId, customerEmail } = req.body;

  if (!restaurantId || !customerEmail) {
    return res.status(400).json({ error: "restaurantId and customerEmail are required" });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customerEmail)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  try {
    // Get session info
    const sessionRes = await pool.query(
      `SELECT ts.id, ts.table_name, ts.restaurant_id, r.service_charge_percent
       FROM table_sessions ts
       JOIN restaurants r ON r.id = ts.restaurant_id
       WHERE ts.id = $1 AND ts.restaurant_id = $2`,
      [sessionId, restaurantId]
    );
    if ((sessionRes.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: "Session not found" });
    }
    const session = sessionRes.rows[0];

    // Get all non-addon order items for the session
    const itemsRes = await pool.query(
      `SELECT oi.quantity, oi.price_cents,
              COALESCE(mi.name, 'Item') AS name
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE o.session_id = $1 AND (oi.is_addon IS NULL OR oi.is_addon = false)
         AND o.status NOT IN ('voided', 'refunded')
       ORDER BY oi.id ASC`,
      [sessionId]
    );

    const items = itemsRes.rows.map((row: any) => ({
      name: row.name,
      quantity: row.quantity,
      price: row.price_cents * row.quantity,
    }));

    const subtotal = items.reduce((sum: number, item: any) => sum + item.price, 0);
    const serviceChargePct = parseFloat(session.service_charge_percent || '0');
    const serviceCharge = Math.round(subtotal * serviceChargePct / 100);
    const total = subtotal + serviceCharge;

    const service = getCustomerReceiptService(pool);
    await service.sendEmailDirect(parseInt(restaurantId), parseInt(sessionId), customerEmail, {
      items,
      subtotal,
      serviceCharge,
      total,
      tableNumber: session.table_name || undefined,
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("❌ Failed to send email receipt:", err);
    res.status(500).json({ error: err.message || "Failed to send receipt" });
  }
});

/**
 * Send customer receipt for a session
 */
router.post("/sessions/:sessionId/receipts/send", async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const { restaurantId, customerEmail, customerPhone, items, subtotal, serviceCharge, total, tableNumber } = req.body;

  if (!restaurantId || !items) {
    return res.status(400).json({ error: "restaurantId and items are required" });
  }

  try {
    const service = getCustomerReceiptService(pool);
    const receipts = await service.sendCustomerReceipt(parseInt(restaurantId), parseInt(sessionId), {
      customerEmail,
      customerPhone,
      items,
      subtotal: subtotal || 0,
      serviceCharge: serviceCharge || 0,
      total: total || 0,
      tableNumber,
    });

    res.json({
      success: true,
      receipts,
    });
  } catch (err) {
    console.error("❌ Failed to send customer receipt:", err);
    res.status(500).json({ error: "Failed to send customer receipt" });
  }
});

/**
 * Get receipts for a session
 */
router.get("/sessions/:sessionId/receipts", async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;

  try {
    const service = getCustomerReceiptService(pool);
    const receipts = await service.getReceiptsForSession(parseInt(sessionId));

    res.json({
      success: true,
      receipts,
    });
  } catch (err) {
    console.error("❌ Failed to fetch receipts:", err);
    res.status(500).json({ error: "Failed to fetch receipts" });
  }
});

/**
 * Mark receipt as viewed
 */
router.post("/receipts/:receiptId/viewed", async (req: Request, res: Response) => {
  const receiptId = req.params.receiptId as string;

  try {
    const service = getCustomerReceiptService(pool);
    const receipt = await service.markAsViewed(parseInt(receiptId));

    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found or already viewed" });
    }

    res.json({
      success: true,
      receipt,
    });
  } catch (err) {
    console.error("❌ Failed to mark receipt as viewed:", err);
    res.status(500).json({ error: "Failed to mark receipt as viewed" });
  }
});

export default router;
