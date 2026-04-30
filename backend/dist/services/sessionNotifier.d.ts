import { EventEmitter } from 'events';
/**
 * SessionNotifier - Listens to PostgreSQL NOTIFY events for new sessions
 * and broadcasts them to connected WebSocket clients
 */
export declare class SessionNotifier extends EventEmitter {
    private listenClient;
    private connected;
    private printedSessions;
    constructor();
    /**
     * Start listening for new session notifications from PostgreSQL
     */
    start(): Promise<void>;
    /**
     * Stop listening for notifications
     */
    stop(): Promise<void>;
    /**
     * Mark a session as already printed (prevent duplicate prints)
     */
    markPrinted(sessionId: number): void;
    /**
     * Clear printed sessions (useful for testing or when resetting)
     */
    clearPrinted(): void;
    /**
     * Check if a session has been auto-printed
     */
    hasBeenPrinted(sessionId: number): boolean;
}
export declare const sessionNotifier: SessionNotifier;
//# sourceMappingURL=sessionNotifier.d.ts.map