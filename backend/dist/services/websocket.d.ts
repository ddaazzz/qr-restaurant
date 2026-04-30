import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
export interface SessionEvent {
    sessionId: number;
    tableId: number;
    restaurantId: number;
    pax: number;
    createdAt: string;
}
export declare class WebSocketServer {
    private io;
    private connectedClients;
    /**
     * Initialize WebSocket server and attach to HTTP server
     */
    initialize(httpServer: HttpServer): void;
    /**
     * Broadcast session event to all connected clients for that restaurant
     */
    private broadcastSessionEvent;
    /**
     * Broadcast new order event to kitchen clients
     */
    private broadcastNewOrder;
    /**
     * Broadcast order status change event to kitchen clients
     */
    broadcastOrderStatusChange(event: any): void;
    /**
     * Get count of connected clients
     */
    getClientCount(): number;
    /**
     * Emit event to all connected clients
     */
    broadcastToAll(event: string, data: any): void;
    /**
     * Get the Socket.IO server instance (for testing or advanced usage)
     */
    getIO(): SocketIOServer | null;
}
export declare const webSocketServer: WebSocketServer;
//# sourceMappingURL=websocket.d.ts.map