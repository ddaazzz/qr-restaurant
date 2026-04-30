"use strict";
/**
 * Printer Configuration Service
 * Centralizes all printer configuration queries and selection logic
 * Eliminates duplicate queries from multiple route endpoints
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRestaurantPrinterConfig = getRestaurantPrinterConfig;
exports.getRestaurantPrinters = getRestaurantPrinters;
exports.getPrinterByType = getPrinterByType;
exports.selectPrinterForRestaurant = selectPrinterForRestaurant;
exports.hasConfiguredPrinter = hasConfiguredPrinter;
exports.hasBluetoothPrinter = hasBluetoothPrinter;
exports.getBluetoothPrinterConfig = getBluetoothPrinterConfig;
exports.hasValidNetworkPrinter = hasValidNetworkPrinter;
exports.getPrinterConfigSummary = getPrinterConfigSummary;
const db_1 = __importDefault(require("../config/db"));
/**
 * Get printer configuration for a restaurant
 * Queries unified printers table instead of restaurants table
 *
 * @param restaurantId - Restaurant ID
 * @returns Printer configuration or null
 */
async function getRestaurantPrinterConfig(restaurantId) {
    try {
        const result = await db_1.default.query(`SELECT id, restaurant_id, printer_type, terminal_id, ip_address, port, 
              device_id, service_uuid, characteristic_uuid, is_default, is_active,
              created_at, updated_at
       FROM printers
       WHERE restaurant_id = $1 AND is_active = true
       LIMIT 1`, [restaurantId]);
        if (result.rowCount === 0) {
            return null;
        }
        return mapRowToConfig(result.rows[0]);
    }
    catch (error) {
        console.error('[PrinterConfigService] Error fetching printer config:', error);
        return null;
    }
}
/**
 * Get all printer configurations for a restaurant
 * Useful for printer selection dropdown or multi-printer support
 *
 * @param restaurantId - Restaurant ID
 * @returns Array of printer configurations
 */
async function getRestaurantPrinters(restaurantId) {
    try {
        const result = await db_1.default.query(`SELECT id, restaurant_id, printer_type, terminal_id, ip_address, port, 
              device_id, service_uuid, characteristic_uuid, is_default, is_active,
              created_at, updated_at
       FROM printers
       WHERE restaurant_id = $1
       ORDER BY is_default DESC, is_active DESC, created_at ASC`, [restaurantId]);
        return result.rows.map(mapRowToConfig);
    }
    catch (error) {
        console.error('[PrinterConfigService] Error fetching printers:', error);
        return [];
    }
}
/**
 * Get printer by specific type
 * Useful for selecting specific printer type (thermal, inkjet, etc)
 *
 * @param restaurantId - Restaurant ID
 * @param printerType - Type filter ('thermal', 'inkjet', 'network', 'browser')
 * @returns Printer config or null
 */
async function getPrinterByType(restaurantId, printerType) {
    try {
        const result = await db_1.default.query(`SELECT id, restaurant_id, printer_type, terminal_id, ip_address, port, 
              device_id, service_uuid, characteristic_uuid, is_default, is_active,
              created_at, updated_at
       FROM printers
       WHERE restaurant_id = $1 AND printer_type = $2 AND is_active = true
       LIMIT 1`, [restaurantId, printerType]);
        if (result.rowCount === 0) {
            return null;
        }
        return mapRowToConfig(result.rows[0]);
    }
    catch (error) {
        console.error('[PrinterConfigService] Error fetching printer by type:', error);
        return null;
    }
}
/**
 * Select printer for use in print job
 * Returns default printer if available, otherwise first active printer,
 * optionally filtered by type
 *
 * @param restaurantId - Restaurant ID
 * @param printerType - Optional type filter
 * @returns Selected printer config or null
 */
async function selectPrinterForRestaurant(restaurantId, printerType) {
    try {
        let query = `SELECT id, restaurant_id, printer_type, terminal_id, ip_address, port, 
                        device_id, service_uuid, characteristic_uuid, is_default, is_active,
                        created_at, updated_at
                 FROM printers
                 WHERE restaurant_id = $1 AND is_active = true`;
        const params = [restaurantId];
        if (printerType) {
            query += ` AND printer_type = $2`;
            params.push(printerType);
        }
        query += ` ORDER BY is_default DESC LIMIT 1`;
        const result = await db_1.default.query(query, params);
        if (result.rowCount === 0) {
            return null;
        }
        return mapRowToConfig(result.rows[0]);
    }
    catch (error) {
        console.error('[PrinterConfigService] Error selecting printer:', error);
        return null;
    }
}
/**
 * Check if restaurant has a configured printer
 * Quick boolean check without returning full config
 *
 * @param restaurantId - Restaurant ID
 * @returns true if active printer exists
 */
async function hasConfiguredPrinter(restaurantId) {
    try {
        const result = await db_1.default.query(`SELECT 1 FROM printers WHERE restaurant_id = $1 AND is_active = true LIMIT 1`, [restaurantId]);
        return ((result.rowCount ?? 0) > 0);
    }
    catch (error) {
        console.error('[PrinterConfigService] Error checking printer:', error);
        return false;
    }
}
/**
 * Check if Bluetooth printer is configured
 * Used to determine if WebBluetooth API should be enabled in UI
 *
 * @param restaurantId - Restaurant ID
 * @returns true if Bluetooth printer configured
 */
async function hasBluetoothPrinter(restaurantId) {
    try {
        const result = await db_1.default.query(`SELECT 1 FROM printers WHERE restaurant_id = $1 AND printer_type = 'bluetooth' AND is_active = true LIMIT 1`, [restaurantId]);
        return ((result.rowCount ?? 0) > 0);
    }
    catch (error) {
        console.error('[PrinterConfigService] Error checking Bluetooth printer:', error);
        return false;
    }
}
/**
 * Get Bluetooth printer configuration
 * Fetches device ID and service/characteristic UUIDs for WebBluetooth connection
 *
 * @param restaurantId - Restaurant ID
 * @returns Bluetooth config or null
 */
async function getBluetoothPrinterConfig(restaurantId) {
    try {
        const result = await db_1.default.query(`SELECT id, device_id, service_uuid, characteristic_uuid
       FROM printers
       WHERE restaurant_id = $1 AND printer_type = 'bluetooth' AND is_active = true
       LIMIT 1`, [restaurantId]);
        if (result.rowCount === 0) {
            return null;
        }
        const row = result.rows[0];
        return {
            id: row.id,
            deviceId: row.device_id,
            serviceUuid: row.service_uuid,
            characteristicUuid: row.characteristic_uuid,
        };
    }
    catch (error) {
        console.error('[PrinterConfigService] Error fetching Bluetooth config:', error);
        return null;
    }
}
/**
 * Check if network printer is configured with valid IP and port
 * Validates connection details before attempting to use
 *
 * @param restaurantId - Restaurant ID
 * @returns true if network printer properly configured
 */
async function hasValidNetworkPrinter(restaurantId) {
    try {
        const result = await db_1.default.query(`SELECT 1 FROM printers 
       WHERE restaurant_id = $1 
       AND printer_type = 'network' 
       AND is_active = true
       AND ip_address IS NOT NULL
       AND port IS NOT NULL
       LIMIT 1`, [restaurantId]);
        return ((result.rowCount ?? 0) > 0);
    }
    catch (error) {
        console.error('[PrinterConfigService] Error checking network printer:', error);
        return false;
    }
}
/**
 * Map database row to PrinterConfig interface
 * Converts snake_case to camelCase for TypeScript consistency
 */
function mapRowToConfig(row) {
    return {
        id: row.id,
        restaurantId: row.restaurant_id,
        printerType: row.printer_type,
        terminalId: row.terminal_id,
        ipAddress: row.ip_address,
        port: row.port,
        deviceId: row.device_id,
        serviceUuid: row.service_uuid,
        characteristicUuid: row.characteristic_uuid,
        isDefault: row.is_default,
        isActive: row.is_active,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}
/**
 * Get printer configuration summary for logging/debugging
 * Returns safe string representation of config
 */
function getPrinterConfigSummary(config) {
    if (!config) {
        return 'No printer configured';
    }
    let summary = `${config.printerType} printer`;
    if (config.ipAddress)
        summary += ` (${config.ipAddress}:${config.port})`;
    if (config.deviceId)
        summary += ` [Device: ${config.deviceId.substring(0, 8)}...]`;
    return summary;
}
//# sourceMappingURL=printerConfigService.js.map