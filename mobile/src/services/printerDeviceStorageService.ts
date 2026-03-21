/**
 * Persistent Device Storage Service
 * 
 * Saves user's printer device selections (device ID & name) to AsyncStorage
 * so they persist across app restarts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SavedPrinterDevice {
  deviceId: string;
  deviceName: string;
  printerType: 'qr' | 'bill' | 'kitchen';
  lastConnected: number; // timestamp
}

class PrinterDeviceStorageService {
  private readonly STORAGE_KEY = 'saved_printer_devices';

  /**
   * Save a printer device selection
   */
  async savePrinterDevice(
    printerType: 'qr' | 'bill' | 'kitchen',
    deviceId: string,
    deviceName: string
  ): Promise<void> {
    try {
      const devices = await this.getAllSavedDevices();
      
      // Find and update existing device or add new one
      const existingIndex = devices.findIndex(
        d => d.printerType === printerType && d.deviceId === deviceId
      );
      
      const newDevice: SavedPrinterDevice = {
        deviceId,
        deviceName,
        printerType,
        lastConnected: Date.now(),
      };
      
      if (existingIndex >= 0) {
        devices[existingIndex] = newDevice;
      } else {
        devices.push(newDevice);
      }
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(devices));
      console.log(`[DeviceStorage] Saved ${printerType} printer: ${deviceName} (${deviceId})`);
    } catch (err) {
      console.error(`[DeviceStorage] Error saving printer device:`, err);
    }
  }

  /**
   * Get the most recently used device for a printer type
   */
  async getLastUsedDevice(
    printerType: 'qr' | 'bill' | 'kitchen'
  ): Promise<SavedPrinterDevice | null> {
    try {
      const devices = await this.getAllSavedDevices();
      const typeDevices = devices.filter(d => d.printerType === printerType);
      
      if (typeDevices.length === 0) return null;
      
      // Return most recently used
      return typeDevices.reduce((latest, current) =>
        current.lastConnected > latest.lastConnected ? current : latest
      );
    } catch (err) {
      console.error(`[DeviceStorage] Error getting last used device:`, err);
      return null;
    }
  }

  /**
   * Get all saved devices for a printer type
   */
  async getSavedDevicesForType(
    printerType: 'qr' | 'bill' | 'kitchen'
  ): Promise<SavedPrinterDevice[]> {
    try {
      const devices = await this.getAllSavedDevices();
      return devices.filter(d => d.printerType === printerType);
    } catch (err) {
      console.error(`[DeviceStorage] Error getting devices for type:`, err);
      return [];
    }
  }

  /**
   * Get all saved devices
   */
  async getAllSavedDevices(): Promise<SavedPrinterDevice[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error(`[DeviceStorage] Error reading storage:`, err);
      return [];
    }
  }

  /**
   * Remove a specific device from saved list
   */
  async removeDevice(deviceId: string): Promise<void> {
    try {
      const devices = await this.getAllSavedDevices();
      const filtered = devices.filter(d => d.deviceId !== deviceId);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      console.log(`[DeviceStorage] Removed device: ${deviceId}`);
    } catch (err) {
      console.error(`[DeviceStorage] Error removing device:`, err);
    }
  }

  /**
   * Clear all saved devices
   */
  async clearAllDevices(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      console.log(`[DeviceStorage] Cleared all saved devices`);
    } catch (err) {
      console.error(`[DeviceStorage] Error clearing devices:`, err);
    }
  }

  /**
   * Update device's last connected timestamp
   */
  async updateLastConnected(deviceId: string): Promise<void> {
    try {
      const devices = await this.getAllSavedDevices();
      const device = devices.find(d => d.deviceId === deviceId);
      if (device) {
        device.lastConnected = Date.now();
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(devices));
      }
    } catch (err) {
      console.error(`[DeviceStorage] Error updating last connected:`, err);
    }
  }
}

export const printerDeviceStorageService = new PrinterDeviceStorageService();
export default PrinterDeviceStorageService;
