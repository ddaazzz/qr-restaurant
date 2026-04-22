"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerReceiptService = void 0;
exports.getCustomerReceiptService = getCustomerReceiptService;
const nodemailer_1 = __importDefault(require("nodemailer"));
class CustomerReceiptService {
    constructor(pool) {
        this.pool = pool;
        // Initialize email if configured
        const emailConfig = {
            host: process.env.EMAIL_SMTP_HOST,
            port: parseInt(process.env.EMAIL_SMTP_PORT || '587'),
            secure: process.env.EMAIL_SMTP_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_SMTP_USER,
                pass: process.env.EMAIL_SMTP_PASSWORD,
            },
        };
        if (emailConfig.auth.user && emailConfig.auth.pass) {
            this.emailTransporter = nodemailer_1.default.createTransport(emailConfig);
        }
    }
    /**
     * Send customer receipt for a session
     */
    async sendCustomerReceipt(restaurantId, sessionId, receiptData) {
        const receipts = [];
        try {
            // Get restaurant config
            const restaurantRes = await this.pool.query(`SELECT rps.customer_receipt_enabled, rps.customer_receipt_type, rps.customer_email_from,
                r.name, r.language_preference as language
         FROM restaurants r
         LEFT JOIN restaurant_printer_settings rps ON rps.restaurant_id = r.id
         WHERE r.id = $1`, [restaurantId]);
            if (restaurantRes.rowCount === 0 || !restaurantRes.rows[0].customer_receipt_enabled) {
                return []; // Customer receipts disabled
            }
            const config = restaurantRes.rows[0];
            const receiptTypes = config.customer_receipt_type.split(',').map((t) => t.trim());
            // Send via each configured channel
            for (const type of receiptTypes) {
                try {
                    if (type === 'email' && receiptData.customerEmail) {
                        receipts.push(await this.sendEmailReceipt(restaurantId, sessionId, receiptData, config));
                    }
                    else if (type === 'sms' && receiptData.customerPhone) {
                        receipts.push(await this.sendSmsReceipt(restaurantId, sessionId, receiptData, config));
                    }
                    else if (type === 'printer') {
                        receipts.push(await this.sendPrinterReceipt(restaurantId, sessionId, receiptData, config));
                    }
                    else if (type === 'qr') {
                        receipts.push(await this.sendQrReceipt(restaurantId, sessionId, receiptData, config));
                    }
                }
                catch (err) {
                    console.warn(`[CustomerReceipt] Failed to send ${type} receipt:`, err.message);
                }
            }
            return receipts;
        }
        catch (err) {
            console.error('[CustomerReceipt] Error sending customer receipt:', err.message);
            return [];
        }
    }
    /**
     * Send receipt via email
     */
    async sendEmailReceipt(restaurantId, sessionId, receiptData, restaurantConfig) {
        const receiptRecord = {
            restaurant_id: restaurantId,
            session_id: sessionId,
            customer_identifier: receiptData.customerEmail,
            receipt_type: 'email',
            status: 'sent',
            error_message: null,
        };
        try {
            if (!this.emailTransporter) {
                throw new Error('Email not configured');
            }
            const html = this.generateReceiptHTML(receiptData, restaurantConfig.language);
            await this.emailTransporter.sendMail({
                from: restaurantConfig.customer_email_from || process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_SMTP_USER,
                to: receiptData.customerEmail,
                subject: `Receipt from ${restaurantConfig.name}`,
                html,
            });
            // Store receipt record
            const result = await this.pool.query(`INSERT INTO customer_receipts (restaurant_id, session_id, customer_identifier, receipt_type, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *;`, [
                restaurantId,
                sessionId,
                receiptData.customerEmail,
                'email',
                'sent',
            ]);
            return this.formatReceipt(result.rows[0]);
        }
        catch (err) {
            // Store failure record
            const result = await this.pool.query(`INSERT INTO customer_receipts (restaurant_id, session_id, customer_identifier, receipt_type, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *;`, [
                restaurantId,
                sessionId,
                receiptData.customerEmail,
                'email',
                'failed',
                err.message,
            ]);
            return this.formatReceipt(result.rows[0]);
        }
    }
    /**
     * Send receipt via SMS (placeholder)
     */
    async sendSmsReceipt(restaurantId, sessionId, receiptData, restaurantConfig) {
        // Placeholder - implement with SMS provider (Twilio, SNS, etc.)
        const result = await this.pool.query(`INSERT INTO customer_receipts (restaurant_id, session_id, customer_identifier, receipt_type, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *;`, [
            restaurantId,
            sessionId,
            receiptData.customerPhone,
            'sms',
            'failed',
            'SMS not yet implemented',
        ]);
        return this.formatReceipt(result.rows[0]);
    }
    /**
     * Send receipt via printer
     */
    async sendPrinterReceipt(restaurantId, sessionId, receiptData, restaurantConfig) {
        // This would integrate with the printer queue
        const result = await this.pool.query(`INSERT INTO customer_receipts (restaurant_id, session_id, customer_identifier, receipt_type, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`, [
            restaurantId,
            sessionId,
            'printer',
            'printer',
            'sent',
        ]);
        return this.formatReceipt(result.rows[0]);
    }
    /**
     * Send receipt via QR code
     */
    async sendQrReceipt(restaurantId, sessionId, receiptData, restaurantConfig) {
        // Store QR-trackable receipt record
        const result = await this.pool.query(`INSERT INTO customer_receipts (restaurant_id, session_id, customer_identifier, receipt_type, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`, [
            restaurantId,
            sessionId,
            'qr-display',
            'qr',
            'sent',
        ]);
        return this.formatReceipt(result.rows[0]);
    }
    /**
     * Get customer receipts for a session
     */
    async getReceiptsForSession(sessionId) {
        const result = await this.pool.query(`SELECT * FROM customer_receipts WHERE session_id = $1 ORDER BY sent_at DESC`, [sessionId]);
        return result.rows.map(row => this.formatReceipt(row));
    }
    /**
     * Mark receipt as viewed
     */
    async markAsViewed(receiptId) {
        const result = await this.pool.query(`UPDATE customer_receipts 
       SET status = 'viewed', viewed_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status != 'viewed'
       RETURNING *;`, [receiptId]);
        return result.rows.length > 0 ? this.formatReceipt(result.rows[0]) : null;
    }
    /**
     * Generate HTML receipt
     */
    generateReceiptHTML(receiptData, language = 'en') {
        const labels = {
            en: {
                order: 'Order Receipt',
                table: 'Table',
                items: 'Items',
                subtotal: 'Subtotal',
                serviceCharge: 'Service Charge',
                total: 'Total',
                quantity: 'Qty',
                price: 'Price',
                thankYou: 'Thank you for your business!',
            },
            zh: {
                order: '訂單收據',
                table: '桌號',
                items: '商品',
                subtotal: '小計',
                serviceCharge: '服務費',
                total: '總計',
                quantity: '數量',
                price: '價格',
                thankYou: '感謝您的光臨！',
            },
        };
        const l = labels[language] || labels.en;
        const itemsHTML = receiptData.items
            .map((item) => {
            let html = `<tr>
            <td>${item.name}</td>
            <td style="text-align: center;">${item.quantity}</td>
            <td style="text-align: right;">$${(item.price / 100).toFixed(2)}</td>
          </tr>`;
            if (item.addons && item.addons.length > 0) {
                for (const addon of item.addons) {
                    html += `<tr style="color: #666; font-size: 0.9em;">
                <td style="padding-left: 16px;">+ ${addon.name}</td>
                <td style="text-align: center;">${addon.quantity}</td>
                <td style="text-align: right;">$${(addon.price_cents / 100).toFixed(2)}</td>
              </tr>`;
                }
            }
            return html;
        })
            .join('');
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .receipt { max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; }
    .header { text-align: center; margin-bottom: 20px; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .table th { background-color: #f0f0f0; padding: 8px; text-align: left; }
    .table td { padding: 8px; border-bottom: 1px solid #eee; }
    .total-row { font-weight: bold; font-size: 18px; }
    .footer { text-align: center; margin-top: 20px; color: #666; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h2>${l.order}</h2>
      ${receiptData.tableNumber ? `<p>${l.table}: ${receiptData.tableNumber}</p>` : ''}
    </div>
    
    <table class="table">
      <thead>
        <tr>
          <th>${l.items}</th>
          <th style="text-align: center;">${l.quantity}</th>
          <th style="text-align: right;">${l.price}</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>
    
    <table style="width: 100%; margin-top: 20px;">
      <tr>
        <td>${l.subtotal}</td>
        <td style="text-align: right;">$${(receiptData.subtotal / 100).toFixed(2)}</td>
      </tr>
      <tr>
        <td>${l.serviceCharge}</td>
        <td style="text-align: right;">$${(receiptData.serviceCharge / 100).toFixed(2)}</td>
      </tr>
      <tr class="total-row">
        <td>${l.total}</td>
        <td style="text-align: right;">$${(receiptData.total / 100).toFixed(2)}</td>
      </tr>
    </table>
    
    <div class="footer">
      <p>${l.thankYou}</p>
    </div>
  </div>
</body>
</html>
    `;
    }
    /**
     * Format receipt row from database
     */
    formatReceipt(row) {
        return {
            id: row.id,
            restaurant_id: row.restaurant_id,
            order_id: row.order_id,
            session_id: row.session_id,
            customer_identifier: row.customer_identifier,
            receipt_type: row.receipt_type,
            status: row.status,
            sent_at: new Date(row.sent_at),
            viewed_at: row.viewed_at ? new Date(row.viewed_at) : null,
            error_message: row.error_message,
        };
    }
}
exports.CustomerReceiptService = CustomerReceiptService;
// Singleton instance
let receiptInstance = null;
function getCustomerReceiptService(pool) {
    if (!receiptInstance) {
        receiptInstance = new CustomerReceiptService(pool);
    }
    return receiptInstance;
}
//# sourceMappingURL=customerReceipt.js.map