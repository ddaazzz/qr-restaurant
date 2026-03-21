/**
 * Kitchen Order WebSocket Client (DISPLAY + FALLBACK PRINT)
 * 
 * DUAL PRINTING APPROACH:
 * PRIMARY (Always works - server-side):
 *   1. Order created in database
 *   2. PostgreSQL trigger fires → NOTIFY 'new_order' channel
 *   3. Backend OrderNotifier receives event
 *   4. Backend KitchenAutoPrintService processes order → PRINTS AUTOMATICALLY
 * 
 * FALLBACK (Optional - only if kitchen staff is logged in):
 *   1. If kitchen printer session established (window.bluetoothSessions.KITCHEN)
 *   2. Frontend receives WebSocket event
 *   3. Frontend calls printKitchenOrder() to print via established session
 * 
 * KEY BENEFIT: Even if kitchen staff isn't logged in, orders still auto-print via backend!
 * If kitchen staff IS logged in AND has printer session, they'll print twice (redundant but safe).
 */

class KitchenOrderWebSocketClient {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
  }

  /**
   * Connect to WebSocket server for real-time updates + fallback printing
   * Backend service handles ALL printing automatically
   * If printer session established, frontend can print as backup
   */
  connect(restaurantId) {
    if (!restaurantId) {
      console.error('[KitchenDisplay] restaurantId not provided');
      return;
    }

    this.restaurantId = restaurantId;

    // Use the same host as current page
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const host = window.location.host;
    const socketUrl = `${protocol}//${host}`;

    console.log(`[KitchenDisplay] Connecting to WebSocket for display updates: ${socketUrl}`);

    this.socket = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      transports: ['websocket', 'polling'],
    });

    // Connection established
    this.socket.on('connect', () => {
      console.log('[KitchenDisplay] ✅ WebSocket connected');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;

      // Subscribe to kitchen orders for this restaurant (DISPLAY UPDATES ONLY)
      this.socket.emit('subscribe-kitchen-orders', {
        restaurantId: this.restaurantId,
      });
      console.log('[KitchenDisplay] ✅ Subscribed to real-time order updates');
    });

    // Listen for new orders - PRINT using established session + UPDATE DISPLAY
    this.socket.on('new-order', (event) => {
      console.log('[KitchenDisplay] 📦 New order received:', event);
      
      // If kitchen printer session is established, print immediately
      if (window.bluetoothSessions && window.bluetoothSessions.KITCHEN && window.bluetoothSessions.KITCHEN.connected) {
        this.printOrderToKitchenPrinter(event);
      } else {
        console.log('[KitchenDisplay] No printer session available - backend will handle printing');
      }
      
      // Refresh kitchen order list
      if (typeof loadKitchenOrders === 'function') {
        loadKitchenOrders();
      }
    });

    // Listen for order status changes
    this.socket.on('order-status-changed', (event) => {
      console.log('[KitchenDisplay] 📋 Order status updated:', event);
      // TODO: Update order status in UI
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      console.error('[KitchenDisplay] WebSocket error:', error);
    });

    // Disconnection
    this.socket.on('disconnect', () => {
      console.warn('[KitchenDisplay] WebSocket disconnected - printing still works on server');
    });

    // Reconnection attempts
    this.socket.on('reconnect_attempt', () => {
      this.reconnectAttempts++;
      console.log(
        `[KitchenDisplay] Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
      );
    });
  }

  /**
   * Print order using kitchen printer session (if available)
   * This is a fallback - backend service also prints independently
   */
  async printOrderToKitchenPrinter(orderData) {
    console.log('[KitchenDisplay] 🖇️ Printing order to kitchen printer...', orderData);
    
    try {
      // Call the print function with the order data
      if (typeof printKitchenOrder === 'function') {
        await printKitchenOrder({
          id: orderData.id,
          session_id: orderData.session_id,
          restaurant_id: orderData.restaurant_id,
          table_number: orderData.table_number,
          items: orderData.items,
          created_at: orderData.created_at,
          number: orderData.number
        });
        console.log('[KitchenDisplay] ✅ Order printed successfully');
      } else {
        console.log('[KitchenDisplay] printKitchenOrder function not available');
      }
    } catch (error) {
      console.error('[KitchenDisplay] ❌ Failed to print order:', error);
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      console.log('[KitchenDisplay] WebSocket disconnected');
    }
  }
}

// Create singleton instance
const kitchenOrderWebSocketClient = new KitchenOrderWebSocketClient();

