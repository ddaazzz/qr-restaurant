/**
 * Printer Session Service (Mobile Equivalent of Web App's window.bluetoothSessions)
 * 
 * Manages persistent printer connections to avoid repeated device scanning/pairing prompts
 * Supports multiple devices per printer type with automatic persistence
 * 
 * Structure:
 * {
 *   'kitchen': { deviceId, connected, lastUsed, characteristics, activeDeviceId }
 *   'qr': { deviceId, connected, lastUsed, characteristics, activeDeviceId }
 *   'bill': { deviceId, connected, lastUsed, characteristics, activeDeviceId }
 * }
 */

import { Device } from 'react-native-ble-plx';
import { bluetoothService } from './bluetoothService';
import { printerDeviceStorageService } from './printerDeviceStorageService';
import { printerAutoConnectService } from './printerAutoConnectService';

export interface PrinterSession {
  deviceId: string;
  deviceName?: string;
  connected: boolean;
  lastUsed: number; // timestamp
  device?: Device;
  characteristics?: any;
  serviceUUID?: string;
  retryCount?: number; // For auto-reconnect tracking
  allDevices?: Map<string, { name: string; lastUsed: number }>; // All devices for this printer type
  activeDeviceId?: string; // Currently selected device ID
}

class PrinterSessionService {
  private sessions: Map<string, PrinterSession> = new Map();
  private isInitialized = false;

  constructor() {
    this.initializeAutoConnect();
  }

  /**
   * Initialize auto-reconnect callbacks
   */
  private initializeAutoConnect(): void {
    // Register auto-reconnect callback
    printerAutoConnectService.onReconnect(async (deviceId: string, printerType) => {
      try {
        const session = this.getSession(printerType);
        if (session && session.deviceId === deviceId) {
          console.log(`[PrinterSession] Auto-reconnect attempting ${printerType} ${deviceId}`);
          const connected = await bluetoothService.connectToPrinter(deviceId);
          if (connected) {
            this.markConnected(printerType);
          }
          return connected;
        }
      } catch (err) {
        console.error('[PrinterSession] Auto-reconnect error:', err);
      }
      return false;
    });
  }

  /**
   * Initialize: Load previously saved devices from storage
   */
  async loadSavedDevices(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const allDevices = await printerDeviceStorageService.getAllSavedDevices();
      console.log(`[PrinterSession] Loaded ${allDevices.length} saved devices from storage`);

      // Group by printer type and restore sessions for last used device
      for (const printerType of ['qr', 'bill', 'kitchen']) {
        const typeDevices = allDevices.filter(d => d.printerType === printerType as any);
        if (typeDevices.length > 0) {
          // Use most recently used device
          const lastUsed = typeDevices[0];
          const session: PrinterSession = {
            deviceId: lastUsed.deviceId,
            deviceName: lastUsed.deviceName,
            connected: false, // Will be reconnected automatically
            lastUsed: lastUsed.lastConnected,
            activeDeviceId: lastUsed.deviceId,
            allDevices: new Map(typeDevices.map(d => [
              d.deviceId,
              { name: d.deviceName, lastUsed: d.lastConnected }
            ])),
          };
          this.sessions.set(printerType.toUpperCase(), session);
          console.log(`[PrinterSession] Restored ${printerType} device: ${lastUsed.deviceName}`);
        }
      }

      this.isInitialized = true;
    } catch (err) {
      console.error('[PrinterSession] Error loading saved devices:', err);
    }
  }

  /**
   * Get existing session for printer type
   */
  getSession(printerType: 'qr' | 'bill' | 'kitchen'): PrinterSession | null {
    const session = this.sessions.get(printerType.toUpperCase());
    if (session && !session.connected) {
      console.log(`[PrinterSession] Session for ${printerType} exists but not connected`);
      return null; // Return null if not connected, but keep session for reconnect
    }
    return session || null;
  }

  /**
   * Get session including disconnected ones (for diagnostics/reconnect)
   */
  getSessionAny(printerType: 'qr' | 'bill' | 'kitchen'): PrinterSession | null {
    return this.sessions.get(printerType.toUpperCase()) || null;
  }

  /**
   * Store a printer session and persist to storage
   */
  async setSession(
    printerType: 'qr' | 'bill' | 'kitchen',
    session: PrinterSession
  ): Promise<void> {
    const key = printerType.toUpperCase();
    
    // Update in-memory session
    if (!this.sessions.has(key)) {
      this.sessions.set(key, session);
    } else {
      const existing = this.sessions.get(key)!;
      this.sessions.set(key, {
        ...existing,
        ...session,
        lastUsed: Date.now(),
        allDevices: existing.allDevices || new Map(),
      });
    }

    // Add to all devices list
    const session_with_devices = this.sessions.get(key)!;
    if (!session_with_devices.allDevices) {
      session_with_devices.allDevices = new Map();
    }
    session_with_devices.allDevices.set(session.deviceId, {
      name: session.deviceName || 'Unknown',
      lastUsed: Date.now(),
    });

    // Persist to AsyncStorage
    await printerDeviceStorageService.savePrinterDevice(
      printerType,
      session.deviceId,
      session.deviceName || 'Unknown Device'
    );

    console.log(`[PrinterSession] ✅ Stored session for ${printerType}:`, {
      deviceId: session.deviceId,
      deviceName: session.deviceName,
      connected: session.connected,
      totalDevices: session_with_devices.allDevices.size,
    });
  }

  /**
   * Add a device to the session's device list
   */
  async addDeviceToSession(
    printerType: 'qr' | 'bill' | 'kitchen',
    deviceId: string,
    deviceName: string
  ): Promise<void> {
    const key = printerType.toUpperCase();
    let session = this.sessions.get(key);

    if (!session) {
      session = {
        deviceId,
        deviceName,
        connected: false,
        lastUsed: Date.now(),
        allDevices: new Map(),
        activeDeviceId: deviceId,
      };
      this.sessions.set(key, session);
    }

    if (!session.allDevices) {
      session.allDevices = new Map();
    }

    session.allDevices.set(deviceId, {
      name: deviceName,
      lastUsed: Date.now(),
    });

    // Persist to storage
    await printerDeviceStorageService.savePrinterDevice(printerType, deviceId, deviceName);
    console.log(`[PrinterSession] Added device to ${printerType}: ${deviceName}`);
  }

  /**
   * Switch active device for a printer type
   */
  async switchDevice(
    printerType: 'qr' | 'bill' | 'kitchen',
    deviceId: string
  ): Promise<boolean> {
    const key = printerType.toUpperCase();
    const session = this.sessions.get(key);

    if (!session) {
      console.error(`[PrinterSession] No session for ${printerType}`);
      return false;
    }

    if (!session.allDevices?.has(deviceId)) {
      console.error(`[PrinterSession] Device ${deviceId} not in session`);
      return false;
    }

    session.activeDeviceId = deviceId;
    session.deviceId = deviceId;
    session.connected = false; // Will need to reconnect to new device

    console.log(`[PrinterSession] Switched ${printerType} to device ${deviceId}`);
    return true;
  }

  /**
   * Get all devices for a printer type
   */
  getAllDevicesForType(
    printerType: 'qr' | 'bill' | 'kitchen'
  ): Array<{ deviceId: string; name: string; lastUsed: number }> {
    const session = this.sessions.get(printerType.toUpperCase());
    if (!session?.allDevices) return [];

    return Array.from(session.allDevices.entries()).map(([id, data]) => ({
      deviceId: id,
      ...data,
    }));
  }

  /**
   * Clear a printer session
   */
  clearSession(printerType: 'qr' | 'bill' | 'kitchen'): void {
    const key = printerType.toUpperCase();
    this.sessions.delete(key);
    console.log(`[PrinterSession] Cleared session for ${printerType}`);
  }

  /**
   * Clear all sessions
   */
  clearAllSessions(): void {
    this.sessions.clear();
    console.log('[PrinterSession] Cleared all sessions');
  }

  /**
   * Check if all required printer types have active sessions
   */
  hasActiveSession(printerType: 'qr' | 'bill' | 'kitchen'): boolean {
    const session = this.getSession(printerType);
    return !!(session && session.connected);
  }

  /**
   * Get all active sessions (for diagnostics)
   */
  getAllSessions(): Map<string, PrinterSession> {
    return new Map(this.sessions);
  }

  /**
   * Mark session as disconnected and trigger auto-reconnect
   */
  markDisconnected(
    printerType: 'qr' | 'bill' | 'kitchen',
    error?: string
  ): void {
    const session = this.sessions.get(printerType.toUpperCase());
    if (session) {
      session.connected = false;
      console.log(`[PrinterSession] Marked ${printerType} as disconnected`);

      // Trigger auto-reconnect with exponential backoff
      printerAutoConnectService.startReconnect(
        session.deviceId,
        printerType,
        error
      );
    }
  }

  /**
   * Mark session as connected
   */
  markConnected(printerType: 'qr' | 'bill' | 'kitchen'): void {
    const session = this.sessions.get(printerType.toUpperCase());
    if (session) {
      session.connected = true;
      session.lastUsed = Date.now();
      console.log(`[PrinterSession] Marked ${printerType} as connected`);
    }
  }

  /**
   * Get session duration (how long since last used)
   */
  getSessionDuration(printerType: 'qr' | 'bill' | 'kitchen'): number | null {
    const session = this.sessions.get(printerType.toUpperCase());
    if (!session) return null;
    return Date.now() - session.lastUsed;
  }

  /**
   * Check if session is stale (older than 1 hour)
   */
  isSessionStale(printerType: 'qr' | 'bill' | 'kitchen'): boolean {
    const duration = this.getSessionDuration(printerType);
    if (!duration) return true;
    const ONE_HOUR = 60 * 60 * 1000;
    return duration > ONE_HOUR;
  }

  /**
   * Get diagnostic info about all sessions
   */
  getDiagnostics(): {
    sessions: {
      printerType: string;
      activeDeviceId: string;
      connected: boolean;
      availableDevices: number;
      lastUsed: number;
    }[];
    isInitialized: boolean;
    autoConnectPending: number;
  } {
    const sessions = Array.from(this.sessions.entries()).map(([type, session]) => ({
      printerType: type.toLowerCase(),
      activeDeviceId: session.deviceId,
      connected: session.connected,
      availableDevices: session.allDevices?.size || 0,
      lastUsed: session.lastUsed,
    }));

    return {
      sessions,
      isInitialized: this.isInitialized,
      autoConnectPending: printerAutoConnectService.getAllPendingReconnects().length,
    };
  }
}

// Singleton instance (matches web app pattern)
export const printerSessionService = new PrinterSessionService();

export default PrinterSessionService;
