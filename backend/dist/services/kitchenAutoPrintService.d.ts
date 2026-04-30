/**
 * Kitchen Auto-Print Service
 * Listens to PostgreSQL notifications for new orders
 * Automatically routes orders to configured kitchen printers
 * NO MANUAL ACTION NEEDED - Always auto-prints
 */
export declare class KitchenAutoPrintService {
    private initialized;
    /**
     * Initialize the kitchen auto-print service
     * Starts listening to order notifications
     */
    initialize(): Promise<void>;
    /**
     * Handle new order - fetch details, determine routing, and print
     */
    private handleNewOrder;
    /**
     * Stop the service
     */
    stop(): void;
    private handleKitchenDispatch;
}
export declare const kitchenAutoPrintService: KitchenAutoPrintService;
//# sourceMappingURL=kitchenAutoPrintService.d.ts.map