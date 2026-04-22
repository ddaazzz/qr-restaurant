export interface PrinterConfig {
    type: "network" | "usb" | "browser";
    host?: string;
    port?: number;
    vendorId?: string;
    productId?: string;
}
export interface PrintJobPayload {
    orderNumber: string;
    tableNumber: string;
    items: {
        name: string;
        quantity: number;
        variants?: string;
        isAddon?: boolean;
    }[];
    timestamp: string;
    restaurantName: string;
    type: "kitchen" | "bill";
}
/**
 * Generate receipt HTML for browser printing
 */
export declare const generateReceiptHTML: (payload: PrintJobPayload) => string;
/**
 * Print to thermal printer using ESC/POS
 */
export declare const printOrder: (config: PrinterConfig, payload: PrintJobPayload) => Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Test printer connection
 */
export declare const testPrinterConnection: (config: PrinterConfig) => Promise<{
    success: boolean;
    error?: string;
}>;
//# sourceMappingURL=printerService.d.ts.map