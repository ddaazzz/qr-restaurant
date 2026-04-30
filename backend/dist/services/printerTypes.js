"use strict";
/**
 * Printer Types Enumeration
 * Centralized definition of all supported printer types
 * Eliminates hardcoded printer type strings scattered across codebase
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.USB_PRINTER_TYPES = exports.BLUETOOTH_PRINTER_TYPES = exports.NETWORK_PRINTER_TYPES = exports.THERMAL_PRINTER_TYPES = exports.PRINTER_TYPE_DESCRIPTIONS = exports.PRINTER_TYPE_NAMES = exports.PrinterType = void 0;
exports.isThermalPrinter = isThermalPrinter;
exports.isNetworkPrinter = isNetworkPrinter;
exports.isBluetoothPrinter = isBluetoothPrinter;
exports.isUSBPrinter = isUSBPrinter;
exports.getAllPrinterTypes = getAllPrinterTypes;
exports.getPrinterTypeName = getPrinterTypeName;
exports.getPrinterTypeDescription = getPrinterTypeDescription;
exports.isValidPrinterType = isValidPrinterType;
exports.getRequiredConfigFields = getRequiredConfigFields;
exports.getOptionalConfigFields = getOptionalConfigFields;
/**
 * Enum for all supported printer types
 * Used throughout application for type safety and consistency
 */
var PrinterType;
(function (PrinterType) {
    PrinterType["THERMAL_NETWORK"] = "thermal-network";
    PrinterType["THERMAL_USB"] = "thermal-usb";
    PrinterType["THERMAL_BLUETOOTH"] = "thermal-bluetooth";
    PrinterType["THERMAL"] = "thermal";
    PrinterType["INKJET"] = "inkjet";
    PrinterType["NETWORK"] = "network";
    PrinterType["BROWSER"] = "browser";
    PrinterType["BLUETOOTH"] = "bluetooth";
})(PrinterType || (exports.PrinterType = PrinterType = {}));
/**
 * Record of printer type display names
 * Used for UI labels and logs
 */
exports.PRINTER_TYPE_NAMES = {
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
exports.PRINTER_TYPE_DESCRIPTIONS = {
    [PrinterType.THERMAL_NETWORK]: 'Thermal printer connected via network (WiFi or Ethernet)',
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
exports.THERMAL_PRINTER_TYPES = [
    PrinterType.THERMAL_NETWORK,
    PrinterType.THERMAL_USB,
    PrinterType.THERMAL_BLUETOOTH,
    PrinterType.THERMAL,
];
/**
 * Network-connected printer types
 * Used for connection handling and timeout configuration
 */
exports.NETWORK_PRINTER_TYPES = [
    PrinterType.THERMAL_NETWORK,
    PrinterType.NETWORK,
];
/**
 * Bluetooth-connected printer types
 * Used for Bluetooth-specific configuration and pairing
 */
exports.BLUETOOTH_PRINTER_TYPES = [
    PrinterType.THERMAL_BLUETOOTH,
    PrinterType.BLUETOOTH,
];
/**
 * USB-connected printer types
 * Used for USB-specific connection handling
 */
exports.USB_PRINTER_TYPES = [PrinterType.THERMAL_USB];
/**
 * Check if printer type is thermal
 * Thermal printers support ESC/POS formatting and specific print quality settings
 */
function isThermalPrinter(type) {
    return exports.THERMAL_PRINTER_TYPES.includes(type);
}
/**
 * Check if printer type connects via network
 * Network printers need IP address and port configuration
 */
function isNetworkPrinter(type) {
    return exports.NETWORK_PRINTER_TYPES.includes(type);
}
/**
 * Check if printer type connects via Bluetooth
 * Bluetooth printers need device ID and UUID configuration
 */
function isBluetoothPrinter(type) {
    return exports.BLUETOOTH_PRINTER_TYPES.includes(type);
}
/**
 * Check if printer type connects via USB
 * USB printers may need specific driver configuration
 */
function isUSBPrinter(type) {
    return exports.USB_PRINTER_TYPES.includes(type);
}
/**
 * Get all available printer types for configuration dropdown
 */
function getAllPrinterTypes() {
    return Object.values(PrinterType);
}
/**
 * Get printer type display name
 * Safe lookup with fallback to type value itself
 */
function getPrinterTypeName(type) {
    return exports.PRINTER_TYPE_NAMES[type] || type;
}
/**
 * Get printer type description
 * Safe lookup with fallback to empty string
 */
function getPrinterTypeDescription(type) {
    return exports.PRINTER_TYPE_DESCRIPTIONS[type] || '';
}
/**
 * Validate printer type
 * Check if provided type is a valid PrinterType
 */
function isValidPrinterType(type) {
    return Object.values(PrinterType).includes(type);
}
/**
 * Get configuration fields needed for printer type
 * Helps determine which form fields to show in UI
 */
function getRequiredConfigFields(type) {
    const fields = {
        [PrinterType.THERMAL_NETWORK]: ['ipAddress', 'port'],
        [PrinterType.THERMAL_USB]: [],
        [PrinterType.THERMAL_BLUETOOTH]: ['deviceId', 'serviceUuid', 'characteristicUuid'],
        [PrinterType.THERMAL]: [],
        [PrinterType.INKJET]: ['ipAddress', 'port'],
        [PrinterType.NETWORK]: ['ipAddress', 'port'],
        [PrinterType.BROWSER]: [],
        [PrinterType.BLUETOOTH]: ['deviceId', 'serviceUuid', 'characteristicUuid'],
    };
    return fields[type] || [];
}
/**
 * Get optional configuration fields for printer type
 * Fields that improve functionality but aren't strictly required
 */
function getOptionalConfigFields(type) {
    const fields = {
        [PrinterType.THERMAL_NETWORK]: ['terminalId'],
        [PrinterType.THERMAL_USB]: ['terminalId'],
        [PrinterType.THERMAL_BLUETOOTH]: ['terminalId'],
        [PrinterType.THERMAL]: ['terminalId'],
        [PrinterType.INKJET]: ['terminalId'],
        [PrinterType.NETWORK]: ['terminalId'],
        [PrinterType.BROWSER]: ['terminalId'],
        [PrinterType.BLUETOOTH]: ['terminalId'],
    };
    return fields[type] || [];
}
//# sourceMappingURL=printerTypes.js.map