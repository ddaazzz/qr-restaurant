import { PrinterQueueService } from "../services/printerQueue";
declare const router: import("express-serve-static-core").Router;
/**
 * Initialize printer queue service (call this in app startup)
 */
export declare function initializePrinterQueue(config?: any): PrinterQueueService;
/**
 * Get printer queue service instance
 */
export declare function getPrinterQueueInstance(): PrinterQueueService;
export default router;
//# sourceMappingURL=printer.routes.d.ts.map