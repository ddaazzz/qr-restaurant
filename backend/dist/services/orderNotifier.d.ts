import { EventEmitter } from 'events';
/**
 * OrderNotifier - Listens to PostgreSQL NOTIFY events for new orders
 * and broadcasts them to connected WebSocket clients for real-time kitchen display
 */
export declare class OrderNotifier extends EventEmitter {
    private listenClient;
    private connected;
    constructor();
    /**
     * Start listening for order notifications from PostgreSQL
     */
    start(): Promise<void>;
    /**
     * Stop listening for notifications
     */
    stop(): Promise<void>;
}
export declare const orderNotifier: OrderNotifier;
//# sourceMappingURL=orderNotifier.d.ts.map