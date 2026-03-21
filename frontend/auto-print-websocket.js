/**
 * WebSocket Client for Real-Time Auto-Print Events
 * Listens for new session notifications from backend and triggers printing
 */

class AutoPrintWebSocketClient {
  constructor() {
    this.socket = null;
    this.restaurantId = null;
    this.connected = false;
    this.autoRetry = true;
    this.retryCount = 0;
    this.maxRetries = 10;
  }

  /**
   * Initialize the WebSocket connection
   * @param restaurantId Restaurant ID to filter events for
   * @param onNewSession Callback when new session detected
   */
  initialize(restaurantId, onNewSession) {
    this.restaurantId = restaurantId;

    // Load socket.io from CDN or assume it's available globally
    if (typeof io === 'undefined') {
      console.warn('[AutoPrint] Socket.IO not available, skipping WebSocket initialization');
      return;
    }

    try {
      const socketURL = this.getSocketURL();
      console.log('[AutoPrint] Connecting to WebSocket at', socketURL);

      this.socket = io(socketURL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      // Connection events
      this.socket.on('connect', () => {
        console.log('[AutoPrint] WebSocket connected');
        this.connected = true;
        this.retryCount = 0;

        // Subscribe to this restaurant's auto-print events
        if (this.restaurantId) {
          this.socket.emit('subscribe-auto-print', {
            restaurantId: this.restaurantId,
          });
          console.log('[AutoPrint] Subscribed to restaurant', this.restaurantId);
        }
      });

      this.socket.on('disconnect', () => {
        console.log('[AutoPrint] WebSocket disconnected');
        this.connected = false;
      });

      this.socket.on('error', (error) => {
        console.error('[AutoPrint] WebSocket error:', error);
      });

      // Listen for new session events
      this.socket.on('new-session', (event) => {
        console.log('[AutoPrint] Received new-session event:', event);

        if (onNewSession) {
          onNewSession(event);
        }

        // Auto-print QR if enabled
        this.handleAutoprint(event);
      });

      // Health check
      setInterval(() => {
        if (this.socket && this.connected) {
          this.socket.emit('ping');
        }
      }, 30000);
    } catch (err) {
      console.error('[AutoPrint] Failed to initialize WebSocket:', err);
    }
  }

  /**
   * Get the correct socket URL based on current location
   */
  getSocketURL() {
    // If we're in an iframe or popup, use the parent's origin
    try {
      const origin = window.parent.location.origin || window.location.origin;
      return origin;
    } catch {
      return window.location.origin;
    }
  }

  /**
   * Handle auto-printing when new session detected
   */
  async handleAutoprint(event) {
    try {
      // Get printer settings from backend
      const settings = await this.getPrinterSettings(event.restaurantId);

      if (!settings) {
        console.warn('[AutoPrint] Could not retrieve printer settings');
        return;
      }

      // Check if QR auto-print is enabled
      if (settings.auto_print === 'true' || settings.auto_print === true) {
        console.log('[AutoPrint] Auto-printing QR code for session', event.sessionId);

        // Trigger QR printing with autoPrint=true flag to suppress alerts
        // Pass event data so printQR can use tableId without needing to fetch session
        if (typeof printQR === 'function') {
          await printQR(event.sessionId, true, event);
        } else {
          console.warn('[AutoPrint] printQR function not available');
        }
      } else {
        console.log('[AutoPrint] QR auto-print disabled for this restaurant');
      }
    } catch (err) {
      console.error('[AutoPrint] Error handling auto-print:', err);
    }
  }

  /**
   * Retrieve printer settings for a restaurant
   */
  async getPrinterSettings(restaurantId) {
    try {
      const response = await fetch(`/api/restaurants/${restaurantId}/printer-settings`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        console.error('[AutoPrint] Failed to get printer settings:', response.status);
        return null;
      }

      const data = await response.json();

      // Find QR printer in the array
      const qrPrinter = data.find(p => p.type === 'QR');
      if (qrPrinter && qrPrinter.settings) {
        return qrPrinter.settings;
      }

      return null;
    } catch (err) {
      console.error('[AutoPrint] Error fetching printer settings:', err);
      return null;
    }
  }

  /**
   * Disconnect the WebSocket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
      console.log('[AutoPrint] WebSocket disconnected');
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Manually trigger a test notification (for debugging)
   */
  testNotification(event) {
    console.log('[AutoPrint] Test notification:', event);
    this.handleAutoprint(event);
  }
}

// Export singleton instance
const autoPrintClient = new AutoPrintWebSocketClient();
