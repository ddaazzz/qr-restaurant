/**
 * Printer Session Service (Mobile Equivalent of Web App's window.bluetoothSessions)
 * 
 * Manages persistent printer connections to avoid repeated device scanning/pairing prompts
 * Matches web app architecture exactly for feature parity
 * 
 * Structure:
 * {
 *   'kitchen': { deviceId, connected, lastUsed, characteristics }
 *   'qr': { deviceId, connected, lastUsed, characteristics }
 *   'bill': { deviceId, connected, lastUsed, characteristics }
 * }
 */

import { Device } from 'react-native-ble-plx';
import { BluetoothService } from './bluetoothService';

export interface PrinterSession {
  deviceId: string;
  deviceName?: string;
  connected: boolean;
  lastUsed: number; // timestamp
  device?: Device;
  characteristics?: any;
  serviceUUID?: string;
}

class PrinterSessionService {
  private sessions: Map<string, PrinterSession> = new Map();
  private bluetoothService: BluetoothService;

  constructor() {
    this.bluetoothService = new BluetoothService();
  }

  /**
   * Get existing session for printer type (like web app's window.bluetoothSessions['KITCHEN'])
   */
  getSession(printerType: 'qr' | 'bill' | 'kitchen'): PrinterSession | null {
    const session = this.sessions.get(printerType.toUpperCase());
    if (session && !session.connected) {
      console.log(`[PrinterSession] Session for ${printerType} exists but not connected`);
      return null; // Session expired or disconnected
    }
    return session || null;
  }

  /**
   * Store a printer session (like web app's window.bluetoothSessions['KITCHEN'] = {...})
   */
  setSession(
    printerType: 'qr' | 'bill' | 'kitchen',
    session: PrinterSession
  ): void {
    const key = printerType.toUpperCase();
    console.log(`[PrinterSession] ✅ Stored session for ${printerType}:`, {
      deviceId: session.deviceId,
      deviceName: session.deviceName,
      connected: session.connected
    });
    this.sessions.set(key, { ...session, lastUsed: Date.now() });
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
   * Mark session as disconnected (but keep it for reconnection)
   */
  markDisconnected(printerType: 'qr' | 'bill' | 'kitchen'): void {
    const session = this.sessions.get(printerType.toUpperCase());
    if (session) {
      session.connected = false;
      console.log(`[PrinterSession] Marked ${printerType} as disconnected`);
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
}

// Singleton instance (matches web app pattern)
export const printerSessionService = new PrinterSessionService();

export default PrinterSessionService;
