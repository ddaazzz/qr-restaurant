import { EventEmitter } from 'events';
import { Client } from 'pg';

/**
 * OrderNotifier - Listens to PostgreSQL NOTIFY events for new orders
 * and broadcasts them to connected WebSocket clients for real-time kitchen display
 */
export class OrderNotifier extends EventEmitter {
  private listenClient: Client | null = null;
  private connected = false;

  constructor() {
    super();
  }

  /**
   * Start listening for order notifications from PostgreSQL
   */
  async start() {
    if (this.connected) {
      console.log('[OrderNotifier] Already connected');
      return;
    }

    try {
      // Configure SSL for remote databases
      const dbUrl = process.env.DATABASE_URL || '';
      const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
      const isProduction = process.env.NODE_ENV === 'production';

      // Create a separate client just for listening
      const clientConfig: any = {
        connectionString: process.env.DATABASE_URL,
      };

      // Only enable SSL for production or remote databases
      if (isProduction || !isLocalhost) {
        clientConfig.ssl = { rejectUnauthorized: false };
      }

      this.listenClient = new Client(clientConfig);
      await this.listenClient.connect();
      console.log('[OrderNotifier] Connected to PostgreSQL');

      // Set up listener for order events
      this.listenClient.on('notification', (msg) => {
        try {
          console.log('[OrderNotifier] Received NOTIFY on channel:', msg.channel, 'Payload:', msg.payload);
          if (msg.channel === 'new_order') {
            const payload = JSON.parse(msg.payload ?? '{}');
            console.log('[OrderNotifier] ✅ New order detected:', payload);
            this.emit('new-order', {
              orderId: payload.id,
              sessionId: payload.session_id,
              restaurantId: payload.restaurant_id,
              status: payload.status,
              createdAt: payload.created_at,
            });
          } else if (msg.channel === 'order_status_change') {
            const payload = JSON.parse(msg.payload ?? '{}');
            console.log('[OrderNotifier] ✅ Order status changed:', payload);
            this.emit('order-status-changed', {
              orderId: payload.id,
              sessionId: payload.session_id,
              restaurantId: payload.restaurant_id,
              oldStatus: payload.old_status,
              newStatus: payload.new_status,
              updatedAt: payload.updated_at,
            });
          }
        } catch (err) {
          console.error('[OrderNotifier] Error parsing notification:', err);
        }
      });

      // LISTEN to both channels
      await this.listenClient.query('LISTEN new_order');
      await this.listenClient.query('LISTEN order_status_change');
      this.connected = true;
      console.log('[OrderNotifier] Listening for order notifications');
    } catch (err) {
      console.error('[OrderNotifier] Failed to start:', err);
      this.connected = false;
    }
  }

  /**
   * Stop listening for notifications
   */
  async stop() {
    if (this.listenClient) {
      try {
        await this.listenClient.query('UNLISTEN new_order');
        await this.listenClient.query('UNLISTEN order_status_change');
        await this.listenClient.end();
        this.listenClient = null;
        this.connected = false;
        console.log('[OrderNotifier] Stopped listening');
      } catch (err) {
        console.error('[OrderNotifier] Error stopping:', err);
      }
    }
  }
}

// Export singleton instance
export const orderNotifier = new OrderNotifier();
