/**
 * Printer Types Enumeration
 * Centralized definition of all supported printer types
 * Eliminates hardcoded printer type strings scattered across codebase
 */

/**
 * Enum for all supported printer types
 * Used throughout application for type safety and consistency
 */
export enum PrinterType {
  THERMAL_NETWORK = 'thermal-network',  // Thermal printer via network
  THERMAL_USB = 'thermal-usb',          // Thermal printer via USB
  THERMAL_BLUETOOTH = 'thermal-bluetooth', // Thermal printer via Bluetooth
  THERMAL = 'thermal',                  // Generic thermal (backwards compatibility)
  INKJET = 'inkjet',                    // Inkjet printer
  NETWORK = 'network',                  // Generic network printer
  BROWSER = 'browser',                  // Browser-based printing
  BLUETOOTH = 'bluetooth',              // Generic Bluetooth printer
}

/**
 * Record of printer type display names
 * Used for UI labels and logs
 */
export const PRINTER_TYPE_NAMES: Record<PrinterType, string> = {
  [PrinterType.THERMAL_NETWORK]: 'Thermal (Network)',
  [PrinterType.THERMAL_USB]: 'Thermal (USB)',
  [PrinterType.THERMAL_BLUETOOTH]: 'Thermal (Bluetooth)',
  [PrinterType.THERMAL]: 'Thermal',
  [PrinterType.INKJET]: 'Inkjet',
  [PrinterType.NETWORK]: 'Network',
  [PrinterType.BROWSER]: 'Browser',
  [PrinterType.BLUETOOTH]: 'Bluetooth',
};

/**
 * Record of printer type descriptions
 * Used in configuration UI and help text
 */
export const PRINTER_TYPE_DESCRIPTIONS: Record<PrinterType, string> = {
  [PrinterType.THERMAL_NETWORK]:
    'Thermal printer connected via network (WiFi or Ethernet)',
  [PrinterType.THERMAL_USB]: 'Thermal printer connected via USB',
  [PrinterType.THERMAL_BLUETOOTH]: 'Thermal printer connected via Bluetooth',
  [PrinterType.THERMAL]: 'Thermal printer (unspecified connection)',
  [PrinterType.INKJET]: 'Inkjet printer for high-quality printing',
  [PrinterType.NETWORK]: 'Network printer (any type)',
  [PrinterType.BROWSER]: 'Browser-based printing (system print dialog)',
  [PrinterType.BLUETOOTH]: 'Bluetooth printer (unspecified type)',
};

/**
 * Thermal printer types (any connection method)
 * Used to determine if printer supports specific formatting
 */
export const THERMAL_PRINTER_TYPES: PrinterType[] = [
  PrinterType.THERMAL_NETWORK,
  PrinterType.THERMAL_USB,
  PrinterType.THERMAL_BLUETOOTH,
  PrinterType.THERMAL,
];

/**
 * Network-connected printer types
 * Used for connection handling and timeout configuration
 */
export const NETWORK_PRINTER_TYPES: PrinterType[] = [
  PrinterType.THERMAL_NETWORK,
  PrinterType.NETWORK,
];

/**
 * Bluetooth-connected printer types
 * Used for Bluetooth-specific configuration and pairing
 */
export const BLUETOOTH_PRINTER_TYPES: PrinterType[] = [
  PrinterType.THERMAL_BLUETOOTH,
  PrinterType.BLUETOOTH,
];

/**
 * USB-connected printer types
 * Used for USB-specific connection handling
 */
export const USB_PRINTER_TYPES: PrinterType[] = [PrinterType.THERMAL_USB];

/**
 * Check if printer type is thermal
 * Thermal printers support ESC/POS formatting and specific print quality settings
 */
export function isThermalPrinter(type: string): boolean {
  return THERMAL_PRINTER_TYPES.includes(type as PrinterType);
}

/**
 * Check if printer type connects via network
 * Network printers need IP address and port configuration
 */
export function isNetworkPrinter(type: string): boolean {
  return NETWORK_PRINTER_TYPES.includes(type as PrinterType);
}

/**
 * Check if printer type connects via Bluetooth
 * Bluetooth printers need device ID and UUID configuration
 */
export function isBluetoothPrinter(type: string): boolean {
  return BLUETOOTH_PRINTER_TYPES.includes(type as PrinterType);
}

/**
 * Check if printer type connects via USB
 * USB printers may need specific driver configuration
 */
export function isUSBPrinter(type: string): boolean {
  return USB_PRINTER_TYPES.includes(type as PrinterType);
}

/**
 * Get all available printer types for configuration dropdown
 */
export function getAllPrinterTypes(): PrinterType[] {
  return Object.values(PrinterType);
}

/**
 * Get printer type display name
 * Safe lookup with fallback to type value itself
 */
export function getPrinterTypeName(type: string): string {
  return PRINTER_TYPE_NAMES[type as PrinterType] || type;
}

/**
 * Get printer type description
 * Safe lookup with fallback to empty string
 */
export function getPrinterTypeDescription(type: string): string {
  return PRINTER_TYPE_DESCRIPTIONS[type as PrinterType] || '';
}

/**
 * Validate printer type
 * Check if provided type is a valid PrinterType
 */
export function isValidPrinterType(type: string): boolean {
  return Object.values(PrinterType).includes(type as PrinterType);
}

/**
 * Get configuration fields needed for printer type
 * Helps determine which form fields to show in UI
 */
export function getRequiredConfigFields(type: string): string[] {
  const fields: Record<PrinterType, string[]> = {
    [PrinterType.THERMAL_NETWORK]: ['ipAddress', 'port'],
    [PrinterType.THERMAL_USB]: [],
    [PrinterType.THERMAL_BLUETOOTH]: ['deviceId', 'serviceUuid', 'characteristicUuid'],
    [PrinterType.THERMAL]: [],
    [PrinterType.INKJET]: ['ipAddress', 'port'],
    [PrinterType.NETWORK]: ['ipAddress', 'port'],
    [PrinterType.BROWSER]: [],
    [PrinterType.BLUETOOTH]: ['deviceId', 'serviceUuid', 'characteristicUuid'],
  };

  return fields[type as PrinterType] || [];
}

/**
 * Get optional configuration fields for printer type
 * Fields that improve functionality but aren't strictly required
 */
export function getOptionalConfigFields(type: string): string[] {
  const fields: Record<PrinterType, string[]> = {
    [PrinterType.THERMAL_NETWORK]: ['terminalId'],
    [PrinterType.THERMAL_USB]: ['terminalId'],
    [PrinterType.THERMAL_BLUETOOTH]: ['terminalId'],
    [PrinterType.THERMAL]: ['terminalId'],
    [PrinterType.INKJET]: ['terminalId'],
    [PrinterType.NETWORK]: ['terminalId'],
    [PrinterType.BROWSER]: ['terminalId'],
    [PrinterType.BLUETOOTH]: ['terminalId'],
  };

  return fields[type as PrinterType] || [];
}
