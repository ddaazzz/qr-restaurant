"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../config/db"));
const customerReceipt_1 = require("../services/customerReceipt");
const router = express_1.default.Router();
/**
 * Send customer receipt for a session
 */
router.post("/sessions/:sessionId/receipts/send", async (req, res) => {
    const sessionId = req.params.sessionId;
    const { restaurantId, customerEmail, customerPhone, items, subtotal, serviceCharge, total, tableNumber } = req.body;
    if (!restaurantId || !items) {
        return res.status(400).json({ error: "restaurantId and items are required" });
    }
    try {
        const service = (0, customerReceipt_1.getCustomerReceiptService)(db_1.default);
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
    }
    catch (err) {
        console.error("❌ Failed to send customer receipt:", err);
        res.status(500).json({ error: "Failed to send customer receipt" });
    }
});
/**
 * Get receipts for a session
 */
router.get("/sessions/:sessionId/receipts", async (req, res) => {
    const sessionId = req.params.sessionId;
    try {
        const service = (0, customerReceipt_1.getCustomerReceiptService)(db_1.default);
        const receipts = await service.getReceiptsForSession(parseInt(sessionId));
        res.json({
            success: true,
            receipts,
        });
    }
    catch (err) {
        console.error("❌ Failed to fetch receipts:", err);
        res.status(500).json({ error: "Failed to fetch receipts" });
    }
});
/**
 * Mark receipt as viewed
 */
router.post("/receipts/:receiptId/viewed", async (req, res) => {
    const receiptId = req.params.receiptId;
    try {
        const service = (0, customerReceipt_1.getCustomerReceiptService)(db_1.default);
        const receipt = await service.markAsViewed(parseInt(receiptId));
        if (!receipt) {
            return res.status(404).json({ error: "Receipt not found or already viewed" });
        }
        res.json({
            success: true,
            receipt,
        });
    }
    catch (err) {
        console.error("❌ Failed to mark receipt as viewed:", err);
        res.status(500).json({ error: "Failed to mark receipt as viewed" });
    }
});
exports.default = router;
//# sourceMappingURL=customerReceipts.routes.js.map