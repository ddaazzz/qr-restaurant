"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webSocketServer = exports.WebSocketServer = void 0;
const socket_io_1 = require("socket.io");
const sessionNotifier_1 = require("./sessionNotifier");
const orderNotifier_1 = require("./orderNotifier");
class WebSocketServer {
    constructor() {
        this.io = null;
        this.connectedClients = new Map();
    }
    /**
     * Initialize WebSocket server and attach to HTTP server
     */
    initialize(httpServer) {
        this.io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || '*',
                methods: ['GET', 'POST'],
            },
            transports: ['websocket', 'polling'],
        });
        this.io.on('connection', (socket) => {
            console.log('[WebSocket] Client connected:', socket.id);
            this.connectedClients.set(socket.id, socket);
            // Handle disconnection
            socket.on('disconnect', () => {
                console.log('[WebSocket] Client disconnected:', socket.id);
                this.connectedClients.delete(socket.id);
            });
            // Health check
            socket.on('ping', () => {
                socket.emit('pong');
            });
            // When client subscribes to auto-print events
            socket.on('subscribe-auto-print', (data) => {
                const roomName = `restaurant-${data.restaurantId}-auto-print`;
                socket.join(roomName);
                console.log(`[WebSocket] Client ${socket.id} subscribed to ${roomName}`);
            });
            // When kitchen client subscribes to real-time order events
            socket.on('subscribe-kitchen-orders', (data) => {
                const roomName = `restaurant-${data.restaurantId}-kitchen-orders`;
                socket.join(roomName);
                console.log(`[WebSocket] ✅ Client ${socket.id} subscribed to kitchen-orders room: ${roomName}`);
            });
            // When staff subscribes to service request events
            socket.on('subscribe-service-requests', (data) => {
                const roomName = `restaurant-${data.restaurantId}-service-requests`;
                socket.join(roomName);
                console.log(`[WebSocket] Client ${socket.id} subscribed to service-requests room: ${roomName}`);
            });
        });
        // Set up listener for new session events from PostgreSQL
        sessionNotifier_1.sessionNotifier.on('new-session', (event) => {
            this.broadcastSessionEvent(event);
        });
        // Set up listener for new order events from PostgreSQL
        orderNotifier_1.orderNotifier.on('new-order', (event) => {
            console.log('[WebSocket] Received new-order event from OrderNotifier:', event);
            this.broadcastNewOrder(event);
        });
        // Set up listener for order status changes
        orderNotifier_1.orderNotifier.on('order-status-changed', (event) => {
            this.broadcastOrderStatusChange(event);
        });
        console.log('[WebSocket] Server initialized');
    }
    /**
     * Broadcast session event to all connected clients for that restaurant
     */
    broadcastSessionEvent(event) {
        if (!this.io) {
            console.warn('[WebSocket] Server not initialized');
            return;
        }
        const roomName = `restaurant-${event.restaurantId}-auto-print`;
        console.log(`[WebSocket] Broadcasting new session to ${roomName}:`, event);
        this.io.to(roomName).emit('new-session', {
            sessionId: event.sessionId,
            tableId: event.tableId,
            restaurantId: event.restaurantId,
            pax: event.pax,
            createdAt: event.createdAt,
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * Broadcast new order event to kitchen clients
     */
    broadcastNewOrder(event) {
        if (!this.io) {
            console.warn('[WebSocket] Server not initialized');
            return;
        }
        const roomName = `restaurant-${event.restaurantId}-kitchen-orders`;
        // Count clients in room for debugging
        const room = this.io.sockets.adapter.rooms.get(roomName);
        const clientCount = room ? room.size : 0;
        console.log(`[WebSocket] ✅ Broadcasting new order to ${roomName} (${clientCount} clients listening):`, event);
        this.io.to(roomName).emit('new-order', {
            orderId: event.orderId,
            sessionId: event.sessionId,
            restaurantId: event.restaurantId,
            status: event.status,
            createdAt: event.createdAt,
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * Broadcast order status change event to kitchen clients
     */
    broadcastOrderStatusChange(event) {
        if (!this.io) {
            console.warn('[WebSocket] Server not initialized');
            return;
        }
        const roomName = `restaurant-${event.restaurantId}-kitchen-orders`;
        console.log(`[WebSocket] Broadcasting order status change to ${roomName}:`, event);
        this.io.to(roomName).emit('order-status-changed', {
            orderId: event.orderId,
            sessionId: event.sessionId,
            restaurantId: event.restaurantId,
            oldStatus: event.oldStatus,
            newStatus: event.newStatus,
            updatedAt: event.updatedAt,
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * Get count of connected clients
     */
    getClientCount() {
        return this.connectedClients.size;
    }
    /**
     * Emit event to all connected clients
     */
    broadcastToAll(event, data) {
        if (this.io) {
            this.io.emit(event, data);
        }
    }
    /**
     * Get the Socket.IO server instance (for testing or advanced usage)
     */
    getIO() {
        return this.io;
    }
}
exports.WebSocketServer = WebSocketServer;
// Export singleton instance
exports.webSocketServer = new WebSocketServer();
//# sourceMappingURL=websocket.js.map