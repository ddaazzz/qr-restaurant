/**
 * Payment Terminal Service
 * Centralizes payment terminal operations and caching
 * Eliminates duplicate terminal lookup logic across routes
 */
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
 * Get the active payment terminal for a restaurant and vendor
 * Uses in-memory cache to avoid repeated database queries
 *
 * @param restaurantId - The restaurant ID
 * @param vendorName - Payment vendor name ('payment-asia', 'kpay', etc)
 * @returns Active terminal configuration or null
 */
export declare function getActiveTerminal(restaurantId: number, vendorName: string): Promise<PaymentTerminal | null>;
/**
 * Get the terminal secret code for webhook signature verification
 * Combined lookup for commonly needed operation
 *
 * @param restaurantId - The restaurant ID
 * @param vendorName - Payment vendor name
 * @returns Secret code or empty string if not found
 */
export declare function getTerminalSecretCode(restaurantId: number, vendorName: string): Promise<string>;
/**
 * Get all active terminals for a restaurant
 * Useful for payment gateway selection and configuration
 *
 * @param restaurantId - The restaurant ID
 * @returns Array of active terminals
 */
export declare function getRestaurantTerminals(restaurantId: number): Promise<PaymentTerminal[]>;
/**
 * Check if a restaurant has an active terminal configured for a vendor
 * Quick boolean check without returning full data
 *
 * @param restaurantId - The restaurant ID
 * @param vendorName - Payment vendor name
 * @returns true if active terminal exists
 */
export declare function hasActiveTerminal(restaurantId: number, vendorName: string): Promise<boolean>;
/**
 * Invalidate cache for a specific terminal
 * Call after updating terminal configuration
 *
 * @param restaurantId - The restaurant ID
 * @param vendorName - Payment vendor name
 */
export declare function invalidateTerminalCache(restaurantId: number, vendorName?: string): void;
/**
 * Clear entire terminal cache
 * Use with caution - typically after database migrations or cache corruption
 */
export declare function clearTerminalCache(): void;
/**
 * Get cache statistics for monitoring
 * Useful for debugging cache hits/misses
 */
export declare function getCacheStats(): {
    cacheSize: number;
    entries: string[];
    ttl: string;
};
export {};
//# sourceMappingURL=paymentTerminalService.d.ts.map