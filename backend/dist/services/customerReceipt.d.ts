import { Pool } from 'pg';
export interface CustomerReceipt {
    id: number;
    restaurant_id: number;
    order_id?: string;
    session_id: number;
    customer_identifier: string;
    receipt_type: 'printer' | 'sms' | 'email' | 'qr';
    status: 'sent' | 'failed' | 'viewed';
    sent_at: Date;
    viewed_at?: Date | null;
    error_message?: string | null;
}
export declare class CustomerReceiptService {
    private pool;
    private emailTransporter?;
    constructor(pool: Pool);
    /**
     * Send customer receipt for a session
     */
    sendCustomerReceipt(restaurantId: number, sessionId: number, receiptData: {
        customerEmail?: string;
        customerPhone?: string;
        items: Array<{
            name: string;
            quantity: number;
            price: number;
        }>;
        subtotal: number;
        serviceCharge: number;
        total: number;
        tableNumber?: string;
    }): Promise<CustomerReceipt[]>;
    /**
     * Send receipt via email
     */
    private sendEmailReceipt;
    /**
     * Send receipt via SMS (placeholder)
     */
    private sendSmsReceipt;
    /**
     * Send receipt via printer
     */
    private sendPrinterReceipt;
    /**
     * Send receipt via QR code
     */
    private sendQrReceipt;
    /**
     * Get customer receipts for a session
     */
    getReceiptsForSession(sessionId: number): Promise<CustomerReceipt[]>;
    /**
     * Mark receipt as viewed
     */
    markAsViewed(receiptId: number): Promise<CustomerReceipt | null>;
    /**
     * Generate HTML receipt
     */
    private generateReceiptHTML;
    /**
     * Format receipt row from database
     */
    private formatReceipt;
}
export declare function getCustomerReceiptService(pool: Pool): CustomerReceiptService;
//# sourceMappingURL=customerReceipt.d.ts.map