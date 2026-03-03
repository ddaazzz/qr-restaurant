import AsyncStorage from '@react-native-async-storage/async-storage';
import { BluetoothPrinter, PrinterConfig } from '../types';

class StorageService {
  private readonly PRINTERS_KEY = '@qr_restaurant:printers';
  private readonly SAVED_TABLES_KEY = '@qr_restaurant:saved_tables';
  private readonly USER_PREFS_KEY = '@qr_restaurant:user_prefs';
  private readonly MENU_CACHE_KEY = '@qr_restaurant:menu_cache';
  private readonly CACHE_EXPIRY_KEY = '@qr_restaurant:cache_expiry';

  // Printer storage
  async savePrinter(printer: BluetoothPrinter & PrinterConfig): Promise<void> {
    try {
      const existing = await this.getPrinters();
      const updated = existing.filter((p) => p.id !== printer.id);
      updated.push(printer);
      await AsyncStorage.setItem(this.PRINTERS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving printer:', error);
    }
  }

  async getPrinters(): Promise<(BluetoothPrinter & PrinterConfig)[]> {
    try {
      const data = await AsyncStorage.getItem(this.PRINTERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting printers:', error);
      return [];
    }
  }

  async deletePrinter(printerId: string): Promise<void> {
    try {
      const existing = await this.getPrinters();
      const updated = existing.filter((p) => p.id !== printerId);
      await AsyncStorage.setItem(this.PRINTERS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error deleting printer:', error);
    }
  }

  // Menu caching
  async cacheMenu(restaurantId: string, menu: any): Promise<void> {
    try {
      await AsyncStorage.setItem(`${this.MENU_CACHE_KEY}:${restaurantId}`, JSON.stringify(menu));
      await AsyncStorage.setItem(
        `${this.CACHE_EXPIRY_KEY}:${restaurantId}`,
        Date.now().toString()
      );
    } catch (error) {
      console.error('Error caching menu:', error);
    }
  }

  async getCachedMenu(restaurantId: string): Promise<any | null> {
    try {
      const data = await AsyncStorage.getItem(`${this.MENU_CACHE_KEY}:${restaurantId}`);
      if (!data) return null;

      // Check cache expiry (24 hours)
      const expiry = await AsyncStorage.getItem(`${this.CACHE_EXPIRY_KEY}:${restaurantId}`);
      if (expiry) {
        const cacheAge = Date.now() - parseInt(expiry);
        if (cacheAge > 24 * 60 * 60 * 1000) {
          // Cache expired
          await this.clearMenuCache(restaurantId);
          return null;
        }
      }

      return JSON.parse(data);
    } catch (error) {
      console.error('Error getting cached menu:', error);
      return null;
    }
  }

  async clearMenuCache(restaurantId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${this.MENU_CACHE_KEY}:${restaurantId}`);
      await AsyncStorage.removeItem(`${this.CACHE_EXPIRY_KEY}:${restaurantId}`);
    } catch (error) {
      console.error('Error clearing menu cache:', error);
    }
  }

  // User preferences
  async saveUserPreferences(preferences: any): Promise<void> {
    try {
      await AsyncStorage.setItem(this.USER_PREFS_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  }

  async getUserPreferences(): Promise<any> {
    try {
      const data = await AsyncStorage.getItem(this.USER_PREFS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error getting preferences:', error);
      return {};
    }
  }

  // Draft orders
  async saveDraftOrder(sessionId: string, order: any): Promise<void> {
    try {
      await AsyncStorage.setItem(`@draft_order:${sessionId}`, JSON.stringify(order));
    } catch (error) {
      console.error('Error saving draft order:', error);
    }
  }

  async getDraftOrder(sessionId: string): Promise<any | null> {
    try {
      const data = await AsyncStorage.getItem(`@draft_order:${sessionId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting draft order:', error);
      return null;
    }
  }

  async deleteDraftOrder(sessionId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`@draft_order:${sessionId}`);
    } catch (error) {
      console.error('Error deleting draft order:', error);
    }
  }

  // General key-value storage
  async setItem(key: string, value: any): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting item ${key}:`, error);
    }
  }

  async getItem(key: string): Promise<any> {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Error getting item ${key}:`, error);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing item ${key}:`, error);
    }
  }
}

export const storageService = new StorageService();
