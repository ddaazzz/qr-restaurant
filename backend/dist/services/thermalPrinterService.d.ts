/**
 * SHARED THERMAL PRINTER SERVICE
 * Backend version - used by all printer routes to generate ESC/POS commands
 *
 * This is the SINGLE SOURCE OF TRUTH for receipt formatting.
 * Both mobile and web apps receive pre-generated ESC/POS from backend.
 * File: /backend/src/services/thermalPrinterService.ts
 */
export interface ReceiptData {
    orderNumber?: string;
    tableNumber?: string;
    tableName?: string;
    pax?: number;
    startTime?: string;
    startedTime?: string;
    items?: Array<{
        name: string;
        quantity: number;
        price?: number;
    }>;
    subtotal?: number;
    serviceCharge?: number;
    tax?: number;
    total?: number;
    timestamp?: string;
    restaurantName?: string;
    restaurantAddress?: string;
    restaurantPhone?: string;
    qrToken?: string;
    qrCode?: string;
    printerPaperWidth?: number;
    qrTextAbove?: string;
    qrTextBelow?: string;
    billHeaderText?: string;
    billFooterText?: string;
}
/**
 * Generate ESC/POS thermal printer commands
 * Returns Uint8Array of binary commands
 */
export declare function generateESCPOS(receipt: ReceiptData): Uint8Array;
export interface KitchenOrderData {
    orderNumber: string;
    tableNumber: string;
    items: Array<{
        name: string;
        quantity: number;
        variants?: string;
        notes?: string;
    }>;
    timestamp: string;
    restaurantName?: string;
}
/**
 * Generate ESC/POS commands for kitchen order tickets
 * Optimized for TM-U220 Impact Printer (dot-matrix)
 */
export declare function generateKitchenOrderESCPOS(data: KitchenOrderData): Uint8Array;
export interface KPayReceiptData {
    restaurantName: string;
    tableName?: string;
    orderRef?: string;
    transactionNo?: string;
    refNo?: string;
    paymentMethod?: string;
    amountCents: number;
    currency: string;
    timestamp: string;
    status: string;
    approvalCode?: string;
    printerPaperWidth?: number;
}
/**
 * Generate ESC/POS commands for a KPay payment receipt
 */
export declare function generateKPayReceiptESCPOS(data: KPayReceiptData): Uint8Array;
//# sourceMappingURL=thermalPrinterService.d.ts.map