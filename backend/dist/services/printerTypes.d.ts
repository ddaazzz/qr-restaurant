/**
 * Printer Types Enumeration
 * Centralized definition of all supported printer types
 * Eliminates hardcoded printer type strings scattered across codebase
 */
/**
 * Enum for all supported printer types
 * Used throughout application for type safety and consistency
 */
export declare enum PrinterType {
    THERMAL_NETWORK = "thermal-network",// Thermal printer via network
    THERMAL_USB = "thermal-usb",// Thermal printer via USB
    THERMAL_BLUETOOTH = "thermal-bluetooth",// Thermal printer via Bluetooth
    THERMAL = "thermal",// Generic thermal (backwards compatibility)
    INKJET = "inkjet",// Inkjet printer
    NETWORK = "network",// Generic network printer
    BROWSER = "browser",// Browser-based printing
    BLUETOOTH = "bluetooth"
}
/**
 * Record of printer type display names
 * Used for UI labels and logs
 */
export declare const PRINTER_TYPE_NAMES: Record<PrinterType, string>;
/**
 * Record of printer type descriptions
 * Used in configuration UI and help text
 */
export declare const PRINTER_TYPE_DESCRIPTIONS: Record<PrinterType, string>;
/**
 * Thermal printer types (any connection method)
 * Used to determine if printer supports specific formatting
 */
export declare const THERMAL_PRINTER_TYPES: PrinterType[];
/**
 * Network-connected printer types
 * Used for connection handling and timeout configuration
 */
export declare const NETWORK_PRINTER_TYPES: PrinterType[];
/**
 * Bluetooth-connected printer types
 * Used for Bluetooth-specific configuration and pairing
 */
export declare const BLUETOOTH_PRINTER_TYPES: PrinterType[];
/**
 * USB-connected printer types
 * Used for USB-specific connection handling
 */
export declare const USB_PRINTER_TYPES: PrinterType[];
/**
 * Check if printer type is thermal
 * Thermal printers support ESC/POS formatting and specific print quality settings
 */
export declare function isThermalPrinter(type: string): boolean;
/**
 * Check if printer type connects via network
 * Network printers need IP address and port configuration
 */
export declare function isNetworkPrinter(type: string): boolean;
/**
 * Check if printer type connects via Bluetooth
 * Bluetooth printers need device ID and UUID configuration
 */
export declare function isBluetoothPrinter(type: string): boolean;
/**
 * Check if printer type connects via USB
 * USB printers may need specific driver configuration
 */
export declare function isUSBPrinter(type: string): boolean;
/**
 * Get all available printer types for configuration dropdown
 */
export declare function getAllPrinterTypes(): PrinterType[];
/**
 * Get printer type display name
 * Safe lookup with fallback to type value itself
 */
export declare function getPrinterTypeName(type: string): string;
/**
 * Get printer type description
 * Safe lookup with fallback to empty string
 */
export declare function getPrinterTypeDescription(type: string): string;
/**
 * Validate printer type
 * Check if provided type is a valid PrinterType
 */
export declare function isValidPrinterType(type: string): boolean;
/**
 * Get configuration fields needed for printer type
 * Helps determine which form fields to show in UI
 */
export declare function getRequiredConfigFields(type: string): string[];
/**
 * Get optional configuration fields for printer type
 * Fields that improve functionality but aren't strictly required
 */
export declare function getOptionalConfigFields(type: string): string[];
//# sourceMappingURL=printerTypes.d.ts.map