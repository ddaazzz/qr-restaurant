import { EventEmitter } from 'events';
import pool from '../config/db';
import { Client } from 'pg';

/**
 * SessionNotifier - Listens to PostgreSQL NOTIFY events for new sessions
 * and broadcasts them to connected WebSocket clients
 */
export class SessionNotifier extends EventEmitter {
  private listenClient: Client | null = null;
  private connected = false;
  private printedSessions = new Set<number>(); // Track which sessions have been auto-printed
  private reconnectTimer?: NodeJS.Timeout;

  constructor() {
    super();
  }

  private scheduleReconnect(delayMs = 5000) {
    if (this.reconnectTimer) return;
    console.log(`[SessionNotifier] Reconnecting in ${delayMs / 1000}s...`);
    this.reconnectTimer = setTimeout(async () => {
      delete this.reconnectTimer;
      this.connected = false;
      this.listenClient = null;
      try { await this.start(); } catch (e) { /* start() logs internally */ }
    }, delayMs);
  }

  /**
   * Start listening for new session notifications from PostgreSQL
   */
  async start() {
    if (this.connected) {
      console.log('[SessionNotifier] Already connected');
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

      // Handle connection errors so they don't become uncaught exceptions
      this.listenClient.on('error', (err: Error) => {
        console.warn('[SessionNotifier] Client error:', err.message);
        this.connected = false;
        this.scheduleReconnect();
      });

      this.listenClient.on('end', () => {
        if (this.connected) {
          console.warn('[SessionNotifier] Connection ended unexpectedly — reconnecting');
          this.connected = false;
          this.scheduleReconnect();
        }
      });

      await this.listenClient.connect();
      console.log('[SessionNotifier] Connected to PostgreSQL');

      // Set up listener for new_session channel
      this.listenClient.on('notification', (msg) => {
        if (msg.channel === 'new_session') {
          try {
            const payload = JSON.parse(msg.payload ?? '{}');
            console.log('[SessionNotifier] New session detected:', payload);
            
            // Check if we should auto-print (haven't printed this session before)
            if (!this.printedSessions.has(payload.id)) {
              this.emit('new-session', {
                sessionId: payload.id,
                tableId: payload.table_id,
                restaurantId: payload.restaurant_id,
                pax: payload.pax,
                startedAt: payload.started_at,
              });
              
              // Mark as printed
              this.printedSessions.add(payload.id);
            }
          } catch (err) {
            console.error('[SessionNotifier] Error parsing notification:', err);
          }
        }
      });

      // LISTEN to the new_session channel
      await this.listenClient.query('LISTEN new_session');
      this.connected = true;
      console.log('[SessionNotifier] Listening for new_session notifications');
    } catch (err) {
      console.error('[SessionNotifier] Failed to start:', err);
      this.connected = false;
    }
  }

  /**
   * Stop listening for notifications
   */
  async stop() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      delete this.reconnectTimer;
    }
    if (this.listenClient) {
      try {
        await this.listenClient.query('UNLISTEN new_session');
        await this.listenClient.end();
      } catch { /* ignore on shutdown */ }
      this.listenClient = null;
      this.connected = false;
      console.log('[SessionNotifier] Stopped listening');
    }
  }

  /**
   * Mark a session as already printed (prevent duplicate prints)
   */
  markPrinted(sessionId: number) {
    this.printedSessions.add(sessionId);
  }

  /**
   * Clear printed sessions (useful for testing or when resetting)
   */
  clearPrinted() {
    this.printedSessions.clear();
  }

  /**
   * Check if a session has been auto-printed
   */
  hasBeenPrinted(sessionId: number): boolean {
    return this.printedSessions.has(sessionId);
  }
}

// Export singleton instance
export const sessionNotifier = new SessionNotifier();
