/**
 * Printer Auto-Connect Service
 * 
 * Handles automatic reconnection to printers with exponential backoff
 * Manages retry strategies for connection failures
 */

export interface AutoConnectConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

interface ReconnectionAttempt {
  deviceId: string;
  printerType: 'qr' | 'bill' | 'kitchen';
  retryCount: number;
  nextRetryTime: number; // timestamp
  lastError?: string;
}

class PrinterAutoConnectService {
  private config: AutoConnectConfig = {
    maxRetries: 5,
    initialDelayMs: 1000, // 1 second
    maxDelayMs: 30000, // 30 seconds
    backoffMultiplier: 2,
  };

  private reconnectionAttempts: Map<string, ReconnectionAttempt> = new Map();
  private reconnectCallbacks: ((
    deviceId: string,
    printerType: 'qr' | 'bill' | 'kitchen'
  ) => Promise<boolean>)[] = [];
  private reconnectIntervalId: NodeJS.Timeout | null = null;

  constructor(config?: Partial<AutoConnectConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Register a callback to be called when attempting to reconnect
   * Should return true if reconnection successful
   */
  onReconnect(
    callback: (deviceId: string, printerType: 'qr' | 'bill' | 'kitchen') => Promise<boolean>
  ): void {
    this.reconnectCallbacks.push(callback);
  }

  /**
   * Start auto-reconnection attempt for a device
   */
  startReconnect(
    deviceId: string,
    printerType: 'qr' | 'bill' | 'kitchen',
    error?: string
  ): void {
    const key = `${printerType}_${deviceId}`;
    const existing = this.reconnectionAttempts.get(key);

    const attempt: ReconnectionAttempt = {
      deviceId,
      printerType,
      retryCount: existing ? existing.retryCount + 1 : 0,
      nextRetryTime: this.calculateNextRetryTime(existing ? existing.retryCount : 0),
      lastError: error,
    };

    if (attempt.retryCount > this.config.maxRetries) {
      console.error(
        `[AutoConnect] Max retries exceeded for ${printerType} ${deviceId}`
      );
      this.reconnectionAttempts.delete(key);
      return;
    }

    this.reconnectionAttempts.set(key, attempt);
    const delaySeconds = Math.round((attempt.nextRetryTime - Date.now()) / 1000);
    console.log(
      `[AutoConnect] Scheduled reconnect for ${printerType} ${deviceId} in ${delaySeconds}s (attempt ${attempt.retryCount + 1}/${this.config.maxRetries + 1})`
    );

    // Start polling if not already started
    if (!this.reconnectIntervalId) {
      this.startReconnectLoop();
    }
  }

  /**
   * Cancel reconnection attempts for a device
   */
  cancelReconnect(deviceId: string, printerType?: 'qr' | 'bill' | 'kitchen'): void {
    if (printerType) {
      const key = `${printerType}_${deviceId}`;
      this.reconnectionAttempts.delete(key);
      console.log(`[AutoConnect] Cancelled reconnect for ${printerType} ${deviceId}`);
    } else {
      // Cancel all devices
      for (const key of this.reconnectionAttempts.keys()) {
        if (key.includes(deviceId)) {
          this.reconnectionAttempts.delete(key);
        }
      }
    }
  }

  /**
   * Get current reconnection status for a device
   */
  getReconnectStatus(
    deviceId: string,
    printerType: 'qr' | 'bill' | 'kitchen'
  ): ReconnectionAttempt | null {
    const key = `${printerType}_${deviceId}`;
    return this.reconnectionAttempts.get(key) || null;
  }

  /**
   * Get all pending reconnection attempts
   */
  getAllPendingReconnects(): ReconnectionAttempt[] {
    return Array.from(this.reconnectionAttempts.values());
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  private calculateNextRetryTime(retryCount: number): number {
    const delayMs = Math.min(
      this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, retryCount),
      this.config.maxDelayMs
    );
    return Date.now() + delayMs;
  }

  /**
   * Start polling loop to check for reconnection attempts
   */
  private startReconnectLoop(): void {
    console.log('[AutoConnect] Starting reconnect loop');
    
    this.reconnectIntervalId = setInterval(async () => {
      const now = Date.now();
      const attempts = Array.from(this.reconnectionAttempts.values());

      for (const attempt of attempts) {
        if (now >= attempt.nextRetryTime) {
          await this.executeReconnect(attempt);
        }
      }

      // Stop polling if no more attempts
      if (this.reconnectionAttempts.size === 0) {
        this.stopReconnectLoop();
      }
    }, 1000); // Check every second
  }

  /**
   * Stop polling loop
   */
  private stopReconnectLoop(): void {
    if (this.reconnectIntervalId) {
      clearInterval(this.reconnectIntervalId);
      this.reconnectIntervalId = null;
      console.log('[AutoConnect] Stopped reconnect loop');
    }
  }

  /**
   * Execute a single reconnection attempt
   */
  private async executeReconnect(attempt: ReconnectionAttempt): Promise<void> {
    const key = `${attempt.printerType}_${attempt.deviceId}`;
    console.log(
      `[AutoConnect] Attempting reconnect for ${attempt.printerType} ${attempt.deviceId} (attempt ${attempt.retryCount + 1})`
    );

    let connected = false;
    let lastError: string | undefined;

    // Try all registered reconnect callbacks
    for (const callback of this.reconnectCallbacks) {
      try {
        if (await callback(attempt.deviceId, attempt.printerType)) {
          connected = true;
          break;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`[AutoConnect] Reconnect callback error:`, lastError);
      }
    }

    if (connected) {
      console.log(
        `[AutoConnect] ✅ Successfully reconnected to ${attempt.printerType} ${attempt.deviceId}`
      );
      this.reconnectionAttempts.delete(key);
    } else {
      // Schedule next retry
      attempt.retryCount++;
      attempt.nextRetryTime = this.calculateNextRetryTime(attempt.retryCount);
      attempt.lastError = lastError;

      if (attempt.retryCount > this.config.maxRetries) {
        console.error(
          `[AutoConnect] ❌ Failed to reconnect to ${attempt.printerType} ${attempt.deviceId} after ${this.config.maxRetries + 1} attempts`
        );
        this.reconnectionAttempts.delete(key);
      } else {
        const delaySeconds = Math.round((attempt.nextRetryTime - Date.now()) / 1000);
        console.log(
          `[AutoConnect] Retry ${attempt.retryCount + 1}/${this.config.maxRetries + 1} scheduled for ${delaySeconds}s`
        );
      }
    }
  }

  /**
   * Clear all reconnection attempts
   */
  clearAll(): void {
    this.reconnectionAttempts.clear();
    this.stopReconnectLoop();
    console.log('[AutoConnect] Cleared all reconnection attempts');
  }
}

export const printerAutoConnectService = new PrinterAutoConnectService();
export default PrinterAutoConnectService;
