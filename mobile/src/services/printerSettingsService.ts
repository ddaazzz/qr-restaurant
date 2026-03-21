/**
 * Printer Settings Service
 * Manages printer configuration caching and retrieval
 * Keeps settings in memory and syncs with backend on demand
 * 
 * NEW SCHEMA (Migration 040): Unified printers table with one row per type (QR, Bill, Kitchen)
 * API returns array format: [{ type: 'QR', printer_type, printer_host, ... }, ...]
 * Service converts to flat format for backward compatibility with existing screens
 * 
 * KITCHEN SPECIAL: Stores multi-printer array in settings.printers: [{id, name, type, host, bluetoothDevice, categories}, ...]
 */

import { apiClient } from './apiClient';

export interface PrinterRow {
  id: number;
  restaurant_id: number;
  type: 'QR' | 'Bill' | 'Kitchen';  // NEW: unified type field
  printer_type?: string;             // 'network' | 'bluetooth' | 'none'
  printer_host?: string;
  printer_port?: number;
  bluetooth_device_id?: string;
  bluetooth_device_name?: string;
  menu_category_id?: number;
  settings?: {                       // JSONB field for format-specific settings
    code_size?: string;
    text_above?: string;
    text_below?: string;
    font_size?: string;
    header_text?: string;
    footer_text?: string;
    auto_print?: boolean;
    printers?: KitchenPrinter[];     // NEW: Kitchen multi-printer array
  };
  created_at?: string;
  updated_at?: string;
}

export interface KitchenPrinter {
  id: string;
  name: string;
  type: 'network' | 'bluetooth';
  host?: string;                     // For network printers
  bluetoothDevice?: string;          // Device name for Bluetooth
  categories: number[];              // Menu category IDs
}

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
  qr_text_above?: string;
  qr_text_below?: string;
  qr_code_size?: string;
  
  // Bill/Receipt Printer Configuration
  bill_printer_type?: string;
  bill_printer_host?: string;
  bill_printer_port?: number;
  bill_bluetooth_device_id?: string;
  bill_bluetooth_device_name?: string;
  bill_auto_print?: boolean;
  bill_paper_width?: string;
  bill_show_phone?: boolean;
  bill_show_address?: boolean;
  bill_show_time?: boolean;
  bill_show_items?: boolean;
  bill_show_total?: boolean;
  bill_footer_msg?: string;
  
  // Kitchen Order Printer Configuration
  kitchen_printer_type?: string;
  kitchen_printer_host?: string;
  kitchen_printer_port?: number;
  kitchen_bluetooth_device_id?: string;
  kitchen_bluetooth_device_name?: string;
  kitchen_auto_print?: boolean;
  kitchen_printers?: KitchenPrinter[];  // NEW: Array of kitchen printers
  
  // Other settings
  print_logo?: boolean;
  printer_paper_width?: number; // Paper width in mm (80 for standard, 58 for compact)
}

class PrinterSettingsService {
  private cache: Map<string, BackendPrinterSettings> = new Map();
  private lastFetchTime: Map<string, number> = new Map();
  private CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Convert unified printer array format to flat format for backward compatibility
   * API returns: [{ type: 'QR', printer_type, ... }, { type: 'Kitchen', settings: { printers: [...] } }]
   * This converts to: { qr_printer_type, qr_printer_host, kitchen_printers, ... }
   */
  private convertArrayFormatToFlatFormat(printerRows: PrinterRow[]): BackendPrinterSettings {
    const flat: BackendPrinterSettings = { id: 0 };

    for (const row of printerRows) {
      const type = row.type.toLowerCase(); // 'qr', 'bill', 'kitchen'
      const prefix = `${type}_`;

      // Map unified fields to per-type prefixed fields
      if (row.printer_type) flat[`${prefix}printer_type` as keyof BackendPrinterSettings] = row.printer_type;
      if (row.printer_host) flat[`${prefix}printer_host` as keyof BackendPrinterSettings] = row.printer_host;
      if (row.printer_port) flat[`${prefix}printer_port` as keyof BackendPrinterSettings] = row.printer_port;
      if (row.bluetooth_device_id) flat[`${prefix}bluetooth_device_id` as keyof BackendPrinterSettings] = row.bluetooth_device_id;
      if (row.bluetooth_device_name) flat[`${prefix}bluetooth_device_name` as keyof BackendPrinterSettings] = row.bluetooth_device_name;

      // Extract settings (format-specific configuration)
      if (row.settings) {
        if (row.type === 'QR') {
          if (row.settings.text_above) flat.qr_text_above = row.settings.text_above;
          if (row.settings.text_below) flat.qr_text_below = row.settings.text_below;
          if (row.settings.code_size) flat.qr_code_size = row.settings.code_size;
          if (typeof row.settings.auto_print === 'boolean') flat.qr_auto_print = row.settings.auto_print;
        } else if (row.type === 'Bill') {
          if (row.settings.font_size) flat.bill_font_size = row.settings.font_size;
          if (row.settings.header_text) flat.bill_header_text = row.settings.header_text;
          if (row.settings.footer_text) flat.bill_footer_text = row.settings.footer_text;
          if (typeof row.settings.auto_print === 'boolean') flat.bill_auto_print = row.settings.auto_print;
        } else if (row.type === 'Kitchen') {
          if (typeof row.settings.auto_print === 'boolean') flat.kitchen_auto_print = row.settings.auto_print;
          // CRITICAL: Extract multi-printer array
          if (Array.isArray(row.settings.printers) && row.settings.printers.length > 0) {
            flat.kitchen_printers = row.settings.printers;
          }
        }
      }
    }

    return flat;
  }

  /**
   * Get printer settings for a restaurant
   * Uses cache if available and not expired, otherwise fetches from backend
   * NEW: Backend returns array format, service converts to flat format for compatibility
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

    // Fetch from backend - NEW: API returns array format
    try {
      console.log(`[PrinterSettings] Fetching fresh settings from backend for ${restaurantId}`);
      const response = await apiClient.get(`/api/restaurants/${restaurantId}/printer-settings`);
      
      // NEW: API returns array of PrinterRow objects
      const printerRows = Array.isArray(response.data) ? response.data : [response.data];
      console.log(`[PrinterSettings] Received ${printerRows.length} printer rows from API`);
      
      // Convert from array format to flat format
      const settings = this.convertArrayFormatToFlatFormat(printerRows);
      
      // Cache the converted settings
      this.cache.set(cacheKey, settings);
      this.lastFetchTime.set(cacheKey, now);
      
      console.log(`[PrinterSettings] Successfully fetched and cached settings:`, {
        qr_printer_type: settings.qr_printer_type,
        qr_text_above: settings.qr_text_above,
        qr_text_below: settings.qr_text_below,
        bill_printer_type: settings.bill_printer_type,
        kitchen_printer_type: settings.kitchen_printer_type,
        kitchen_printers_count: settings.kitchen_printers?.length || 0,
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
   * NEW: Get kitchen printers array with category routing info
   * Returns the multi-printer configuration for kitchen orders
   * Each printer has categories assigned for automatic routing
   */
  async getKitchenPrinters(restaurantId: string): Promise<KitchenPrinter[]> {
    const settings = await this.getPrinterSettings(restaurantId);
    return settings.kitchen_printers || [];
  }

  /**
   * NEW: Get printer for a specific order category
   * Matches order category to printer configuration for automatic routing
   */
  async getPrinterForCategory(
    restaurantId: string,
    categoryId: number
  ): Promise<KitchenPrinter | null> {
    const kitchenPrinters = await this.getKitchenPrinters(restaurantId);
    
    // Find first printer that has this category assigned
    const printer = kitchenPrinters.find(p => 
      p.categories && p.categories.includes(categoryId)
    );
    
    return printer || null;
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

