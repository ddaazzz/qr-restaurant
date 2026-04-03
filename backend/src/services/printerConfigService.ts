/**
 * Printer Configuration Service
 * Centralizes all printer configuration queries and selection logic
 * Eliminates duplicate queries from multiple route endpoints
 */

import pool from '../config/db';

export interface PrinterConfig {
  id: number;
  restaurantId: number;
  printerType: string; // 'thermal', 'inkjet', 'network', 'browser', 'bluetooth'
  terminalId?: string;
  ipAddress?: string;
  port?: number;
  deviceId?: string; // For Bluetooth printers
  serviceUuid?: string; // For Bluetooth
  characteristicUuid?: string; // For Bluetooth
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
export async function getRestaurantPrinterConfig(restaurantId: number): Promise<PrinterConfig | null> {
  try {
    const result = await pool.query(
      `SELECT id, restaurant_id, printer_type, terminal_id, ip_address, port, 
              device_id, service_uuid, characteristic_uuid, is_default, is_active,
              created_at, updated_at
       FROM printers
       WHERE restaurant_id = $1 AND is_active = true
       LIMIT 1`,
      [restaurantId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapRowToConfig(result.rows[0]);
  } catch (error) {
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
export async function getRestaurantPrinters(restaurantId: number): Promise<PrinterConfig[]> {
  try {
    const result = await pool.query(
      `SELECT id, restaurant_id, printer_type, terminal_id, ip_address, port, 
              device_id, service_uuid, characteristic_uuid, is_default, is_active,
              created_at, updated_at
       FROM printers
       WHERE restaurant_id = $1
       ORDER BY is_default DESC, is_active DESC, created_at ASC`,
      [restaurantId]
    );

    return result.rows.map(mapRowToConfig);
  } catch (error) {
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
export async function getPrinterByType(
  restaurantId: number,
  printerType: string
): Promise<PrinterConfig | null> {
  try {
    const result = await pool.query(
      `SELECT id, restaurant_id, printer_type, terminal_id, ip_address, port, 
              device_id, service_uuid, characteristic_uuid, is_default, is_active,
              created_at, updated_at
       FROM printers
       WHERE restaurant_id = $1 AND printer_type = $2 AND is_active = true
       LIMIT 1`,
      [restaurantId, printerType]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapRowToConfig(result.rows[0]);
  } catch (error) {
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
export async function selectPrinterForRestaurant(
  restaurantId: number,
  printerType?: string
): Promise<PrinterConfig | null> {
  try {
    let query = `SELECT id, restaurant_id, printer_type, terminal_id, ip_address, port, 
                        device_id, service_uuid, characteristic_uuid, is_default, is_active,
                        created_at, updated_at
                 FROM printers
                 WHERE restaurant_id = $1 AND is_active = true`;
    const params: any[] = [restaurantId];

    if (printerType) {
      query += ` AND printer_type = $2`;
      params.push(printerType);
    }

    query += ` ORDER BY is_default DESC LIMIT 1`;

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return null;
    }

    return mapRowToConfig(result.rows[0]);
  } catch (error) {
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
export async function hasConfiguredPrinter(restaurantId: number): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT 1 FROM printers WHERE restaurant_id = $1 AND is_active = true LIMIT 1`,
      [restaurantId]
    );
    return ((result.rowCount ?? 0) > 0);
  } catch (error) {
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
export async function hasBluetoothPrinter(restaurantId: number): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT 1 FROM printers WHERE restaurant_id = $1 AND printer_type = 'bluetooth' AND is_active = true LIMIT 1`,
      [restaurantId]
    );
    return ((result.rowCount ?? 0) > 0);
  } catch (error) {
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
export async function getBluetoothPrinterConfig(restaurantId: number) {
  try {
    const result = await pool.query(
      `SELECT id, device_id, service_uuid, characteristic_uuid
       FROM printers
       WHERE restaurant_id = $1 AND printer_type = 'bluetooth' AND is_active = true
       LIMIT 1`,
      [restaurantId]
    );

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
  } catch (error) {
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
export async function hasValidNetworkPrinter(restaurantId: number): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT 1 FROM printers 
       WHERE restaurant_id = $1 
       AND printer_type = 'network' 
       AND is_active = true
       AND ip_address IS NOT NULL
       AND port IS NOT NULL
       LIMIT 1`,
      [restaurantId]
    );
    return ((result.rowCount ?? 0) > 0);
  } catch (error) {
    console.error('[PrinterConfigService] Error checking network printer:', error);
    return false;
  }
}

/**
 * Map database row to PrinterConfig interface
 * Converts snake_case to camelCase for TypeScript consistency
 */
function mapRowToConfig(row: any): PrinterConfig {
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
export function getPrinterConfigSummary(config: PrinterConfig | null): string {
  if (!config) {
    return 'No printer configured';
  }

  let summary = `${config.printerType} printer`;
  if (config.ipAddress) summary += ` (${config.ipAddress}:${config.port})`;
  if (config.deviceId) summary += ` [Device: ${config.deviceId.substring(0, 8)}...]`;

  return summary;
}
