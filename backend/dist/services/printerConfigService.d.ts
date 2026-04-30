/**
 * Printer Configuration Service
 * Centralizes all printer configuration queries and selection logic
 * Eliminates duplicate queries from multiple route endpoints
 */
export interface PrinterConfig {
    id: number;
    restaurantId: number;
    printerType: string;
    terminalId?: string;
    ipAddress?: string;
    port?: number;
    deviceId?: string;
    serviceUuid?: string;
    characteristicUuid?: string;
    isDefault: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Get printer configuration for a restaurant
 * Queries unified printers table instead of restaurants table
 *
 * @param restaurantId - Restaurant ID
 * @returns Printer configuration or null
 */
export declare function getRestaurantPrinterConfig(restaurantId: number): Promise<PrinterConfig | null>;
/**
 * Get all printer configurations for a restaurant
 * Useful for printer selection dropdown or multi-printer support
 *
 * @param restaurantId - Restaurant ID
 * @returns Array of printer configurations
 */
export declare function getRestaurantPrinters(restaurantId: number): Promise<PrinterConfig[]>;
/**
 * Get printer by specific type
 * Useful for selecting specific printer type (thermal, inkjet, etc)
 *
 * @param restaurantId - Restaurant ID
 * @param printerType - Type filter ('thermal', 'inkjet', 'network', 'browser')
 * @returns Printer config or null
 */
export declare function getPrinterByType(restaurantId: number, printerType: string): Promise<PrinterConfig | null>;
/**
 * Select printer for use in print job
 * Returns default printer if available, otherwise first active printer,
 * optionally filtered by type
 *
 * @param restaurantId - Restaurant ID
 * @param printerType - Optional type filter
 * @returns Selected printer config or null
 */
export declare function selectPrinterForRestaurant(restaurantId: number, printerType?: string): Promise<PrinterConfig | null>;
/**
 * Check if restaurant has a configured printer
 * Quick boolean check without returning full config
 *
 * @param restaurantId - Restaurant ID
 * @returns true if active printer exists
 */
export declare function hasConfiguredPrinter(restaurantId: number): Promise<boolean>;
/**
 * Check if Bluetooth printer is configured
 * Used to determine if WebBluetooth API should be enabled in UI
 *
 * @param restaurantId - Restaurant ID
 * @returns true if Bluetooth printer configured
 */
export declare function hasBluetoothPrinter(restaurantId: number): Promise<boolean>;
/**
 * Get Bluetooth printer configuration
 * Fetches device ID and service/characteristic UUIDs for WebBluetooth connection
 *
 * @param restaurantId - Restaurant ID
 * @returns Bluetooth config or null
 */
export declare function getBluetoothPrinterConfig(restaurantId: number): Promise<{
    id: any;
    deviceId: any;
    serviceUuid: any;
    characteristicUuid: any;
} | null>;
/**
 * Check if network printer is configured with valid IP and port
 * Validates connection details before attempting to use
 *
 * @param restaurantId - Restaurant ID
 * @returns true if network printer properly configured
 */
export declare function hasValidNetworkPrinter(restaurantId: number): Promise<boolean>;
/**
 * Get printer configuration summary for logging/debugging
 * Returns safe string representation of config
 */
export declare function getPrinterConfigSummary(config: PrinterConfig | null): string;
//# sourceMappingURL=printerConfigService.d.ts.map