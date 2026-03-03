import express, { Request, Response } from "express";
import pool from "../config/db";
import { getCustomerReceiptService } from "../services/customerReceipt";

const router = express.Router();

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
