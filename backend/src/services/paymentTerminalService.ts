/**
 * Payment Terminal Service
 * Centralizes payment terminal operations and caching
 * Eliminates duplicate terminal lookup logic across routes
 */

import pool from '../config/db';

interface PaymentTerminal {
  id: number;
  restaurantId: number;
  vendorName: string;
  terminalId: string;
  secretCode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cache for initialized payment terminals
 * Structure: Map<"${restaurantId}:${vendorName}", PaymentTerminal>
 */
const terminalCache = new Map<string, { data: PaymentTerminal; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get the active payment terminal for a restaurant and vendor
 * Uses in-memory cache to avoid repeated database queries
 * 
 * @param restaurantId - The restaurant ID
 * @param vendorName - Payment vendor name ('payment-asia', 'kpay', etc)
 * @returns Active terminal configuration or null
 */
export async function getActiveTerminal(
  restaurantId: number,
  vendorName: string
): Promise<PaymentTerminal | null> {
  const cacheKey = `${restaurantId}:${vendorName}`;
  const cached = terminalCache.get(cacheKey);

  // Return cached value if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data || null;
  }

  // Query database for active terminal
  try {
    const result = await pool.query(
      `SELECT id, restaurant_id, vendor_name, terminal_id, secret_code, 
              is_active, created_at, updated_at
       FROM payment_terminals
       WHERE restaurant_id = $1 AND vendor_name = $2 AND is_active = true
       LIMIT 1`,
      [restaurantId, vendorName]
    );

    const terminal = result.rows[0] || null;

    // Cache the result
    terminalCache.set(cacheKey, {
      data: terminal,
      timestamp: Date.now(),
    });

    return terminal;
  } catch (error) {
    console.error('[PaymentTerminalService] Error fetching terminal:', error);
    return null;
  }
}

/**
 * Get the terminal secret code for webhook signature verification
 * Combined lookup for commonly needed operation
 * 
 * @param restaurantId - The restaurant ID
 * @param vendorName - Payment vendor name
 * @returns Secret code or empty string if not found
 */
export async function getTerminalSecretCode(
  restaurantId: number,
  vendorName: string
): Promise<string> {
  const terminal = await getActiveTerminal(restaurantId, vendorName);
  return terminal?.secretCode || '';
}

/**
 * Get all active terminals for a restaurant
 * Useful for payment gateway selection and configuration
 * 
 * @param restaurantId - The restaurant ID
 * @returns Array of active terminals
 */
export async function getRestaurantTerminals(restaurantId: number): Promise<PaymentTerminal[]> {
  try {
    const result = await pool.query(
      `SELECT id, restaurant_id, vendor_name, terminal_id, secret_code, 
              is_active, created_at, updated_at
       FROM payment_terminals
       WHERE restaurant_id = $1 AND is_active = true
       ORDER BY vendor_name ASC`,
      [restaurantId]
    );

    return result.rows;
  } catch (error) {
    console.error('[PaymentTerminalService] Error fetching terminals:', error);
    return [];
  }
}

/**
 * Check if a restaurant has an active terminal configured for a vendor
 * Quick boolean check without returning full data
 * 
 * @param restaurantId - The restaurant ID
 * @param vendorName - Payment vendor name
 * @returns true if active terminal exists
 */
export async function hasActiveTerminal(
  restaurantId: number,
  vendorName: string
): Promise<boolean> {
  const terminal = await getActiveTerminal(restaurantId, vendorName);
  return terminal !== null;
}

/**
 * Invalidate cache for a specific terminal
 * Call after updating terminal configuration
 * 
 * @param restaurantId - The restaurant ID
 * @param vendorName - Payment vendor name
 */
export function invalidateTerminalCache(restaurantId: number, vendorName?: string): void {
  if (vendorName) {
    const cacheKey = `${restaurantId}:${vendorName}`;
    terminalCache.delete(cacheKey);
  } else {
    // Invalidate all terminals for restaurant
    const keysToDelete = Array.from(terminalCache.keys()).filter(key =>
      key.startsWith(`${restaurantId}:`)
    );
    keysToDelete.forEach(key => terminalCache.delete(key));
  }
}

/**
 * Clear entire terminal cache
 * Use with caution - typically after database migrations or cache corruption
 */
export function clearTerminalCache(): void {
  terminalCache.clear();
}

/**
 * Get cache statistics for monitoring
 * Useful for debugging cache hits/misses
 */
export function getCacheStats() {
  return {
    cacheSize: terminalCache.size,
    entries: Array.from(terminalCache.keys()),
    ttl: `${CACHE_TTL / 1000} seconds`,
  };
}
