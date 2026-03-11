/**
 * Printer Settings Service
 * Manages printer configuration caching and retrieval
 * Keeps settings in memory and syncs with backend on demand
 * 
 * Note: Backend stores a SINGLE printer config for all uses (qr, bill, kitchen)
 * The backend schema has: printer_type, printer_host, printer_port, bluetooth_device_id, etc.
 * NOT separate qr_printer_type, bill_printer_type, etc. columns
 */

import { apiClient } from './apiClient';

export interface BackendPrinterSettings {
  id: number;
  
  // Fallback/legacy generic printer config
  printer_type?: string;
  printer_host?: string;
  printer_port?: number;
  printer_usb_vendor_id?: string;
  printer_usb_product_id?: string;
  bluetooth_device_id?: string;
  bluetooth_device_name?: string;
  
  // QR Code Printer Configuration
  qr_printer_type?: string;
  qr_printer_host?: string;
  qr_printer_port?: number;
  qr_bluetooth_device_id?: string;
  qr_bluetooth_device_name?: string;
  qr_auto_print?: boolean;
  
  // Bill/Receipt Printer Configuration
  bill_printer_type?: string;
  bill_printer_host?: string;
  bill_printer_port?: number;
  bill_bluetooth_device_id?: string;
  bill_bluetooth_device_name?: string;
  bill_auto_print?: boolean;
  
  // Kitchen Order Printer Configuration
  kitchen_printer_type?: string;
  kitchen_printer_host?: string;
  kitchen_printer_port?: number;
  kitchen_bluetooth_device_id?: string;
  kitchen_bluetooth_device_name?: string;
  kitchen_auto_print?: boolean;
  
  // Other settings
  print_logo?: boolean;
  printer_paper_width?: number; // Paper width in mm (80 for standard, 58 for compact)
}

class PrinterSettingsService {
  private cache: Map<string, BackendPrinterSettings> = new Map();
  private lastFetchTime: Map<string, number> = new Map();
  private CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get printer settings for a restaurant
   * Uses cache if available and not expired, otherwise fetches from backend
   */
  async getPrinterSettings(restaurantId: string, forceRefresh: boolean = false): Promise<BackendPrinterSettings> {
    console.log(`[PrinterSettings] Getting settings for restaurant ${restaurantId}, forceRefresh=${forceRefresh}`);
    
    const cacheKey = `restaurant_${restaurantId}`;
    const cachedSettings = this.cache.get(cacheKey);
    const lastFetch = this.lastFetchTime.get(cacheKey);
    const now = Date.now();
    
    // Return cache if valid and not forced refresh
    if (cachedSettings && lastFetch && !forceRefresh && (now - lastFetch) < this.CACHE_DURATION_MS) {
      console.log(`[PrinterSettings] Using cached settings for ${restaurantId}`);
      return cachedSettings;
    }

    // Fetch from backend
    try {
      console.log(`[PrinterSettings] Fetching fresh settings from backend for ${restaurantId}`);
      const response = await apiClient.get(`/api/restaurants/${restaurantId}/printer-settings`);
      const settings = response.data as BackendPrinterSettings;
      
      // Cache the settings
      this.cache.set(cacheKey, settings);
      this.lastFetchTime.set(cacheKey, now);
      
      console.log(`[PrinterSettings] Successfully fetched and cached settings:`, {
        qr_printer_type: settings.qr_printer_type,
        bill_printer_type: settings.bill_printer_type,
        kitchen_printer_type: settings.kitchen_printer_type,
        qr_printer_host: settings.qr_printer_host,
        bill_printer_host: settings.bill_printer_host,
        kitchen_printer_host: settings.kitchen_printer_host,
        qr_bluetooth_device_id: settings.qr_bluetooth_device_id,
        bill_bluetooth_device_id: settings.bill_bluetooth_device_id,
        kitchen_bluetooth_device_id: settings.kitchen_bluetooth_device_id,
      });
      
      return settings;
    } catch (err: any) {
      console.error(`[PrinterSettings] Error fetching settings:`, err.message);
      
      // If error and we have cached data, return it even if expired
      if (cachedSettings) {
        console.log(`[PrinterSettings] Returning expired cache due to fetch error`);
        return cachedSettings;
      }
      
      throw err;
    }
  }

  /**
   * Get a specific printer config for a document type (QR, Bill, or Kitchen)
   * Returns per-printer-type configuration
   */
  async getPrinterConfigForType(
    restaurantId: string,
    docType: 'qr' | 'bill' | 'kitchen'
  ): Promise<{
    type?: string;
    host?: string;
    port?: number;
    bluetoothDeviceId?: string;
    bluetoothDeviceName?: string;
    autoPrint?: boolean;
  }> {
    const settings = await this.getPrinterSettings(restaurantId);
    const prefix = docType;
    
    return {
      type: settings[`${prefix}_printer_type` as keyof BackendPrinterSettings] as string,
      host: settings[`${prefix}_printer_host` as keyof BackendPrinterSettings] as string,
      port: settings[`${prefix}_printer_port` as keyof BackendPrinterSettings] as number,
      bluetoothDeviceId: settings[`${prefix}_bluetooth_device_id` as keyof BackendPrinterSettings] as string,
      bluetoothDeviceName: settings[`${prefix}_bluetooth_device_name` as keyof BackendPrinterSettings] as string,
      autoPrint: settings[`${prefix}_auto_print` as keyof BackendPrinterSettings] as boolean,
    };
  }

  /**
   * Invalidate cache for a restaurant
   * Call this after updating printer settings
   */
  invalidateCache(restaurantId: string): void {
    const cacheKey = `restaurant_${restaurantId}`;
    this.cache.delete(cacheKey);
    this.lastFetchTime.delete(cacheKey);
    console.log(`[PrinterSettings] Cache invalidated for ${restaurantId}`);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
    this.lastFetchTime.clear();
    console.log(`[PrinterSettings] All cache cleared`);
  }
}

// Export singleton instance
export const printerSettingsService = new PrinterSettingsService();

