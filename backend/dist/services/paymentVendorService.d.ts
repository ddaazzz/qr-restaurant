/**
 * Payment Vendor Service
 * Manages payment provider selection and configuration at restaurant level
 * Eliminates duplicate vendor selection logic in routes
 */
export type PaymentVendor = 'payment-asia' | 'kpay' | 'none';
interface PaymentVendorConfig {
    activeVendor: PaymentVendor;
    isOrderPayEnabled: boolean;
    availableVendors: PaymentVendor[];
}
/**
 * Get the currently active payment vendor for a restaurant
 *
 * @param restaurantId - Restaurant ID
 * @returns Active vendor name or 'none' if not configured
 */
export declare function getActivePaymentVendor(restaurantId: number): Promise<PaymentVendor>;
/**
 * Set the active payment vendor for a restaurant
 * Validates that terminal exists before setting
 *
 * @param restaurantId - Restaurant ID
 * @param vendorName - Payment vendor to activate
 * @param terminalId - Terminal ID to use (optional)
 * @returns true if update successful
 */
export declare function setActivePaymentVendor(restaurantId: number, vendorName: PaymentVendor, terminalId?: number): Promise<boolean>;
/**
 * Get payment vendor configuration for a restaurant
 * Combines active vendor, order pay status, and available options
 *
 * @param restaurantId - Restaurant ID
 * @returns Full vendor configuration
 */
export declare function getPaymentVendorConfig(restaurantId: number): Promise<PaymentVendorConfig>;
/**
 * Check if restaurant can use a specific payment vendor
 * Validates: vendor exists in database, terminal is active
 *
 * @param restaurantId - Restaurant ID
 * @param vendorName - Vendor to check
 * @returns true if vendor is available
 */
export declare function isVendorAvailable(restaurantId: number, vendorName: PaymentVendor): Promise<boolean>;
/**
 * Get the primary payment vendor for checkout
 * Returns active vendor if configured, otherwise first available vendor
 * Falls back to 'none' if no vendors available
 *
 * @param restaurantId - Restaurant ID
 * @returns Payment vendor to use for transactions
 */
export declare function getPrimaryPaymentVendor(restaurantId: number): Promise<PaymentVendor>;
/**
 * Update Order & Pay status for payment vendor
 * Validates that vendor has active terminal before enabling
 *
 * @param restaurantId - Restaurant ID
 * @param enabled - Enable or disable Order & Pay
 * @returns true if update successful
 */
export declare function setOrderPayEnabled(restaurantId: number, enabled: boolean): Promise<boolean>;
/**
 * Get vendor display name for UI
 * Useful for consistent vendor naming across application
 */
export declare function getVendorDisplayName(vendorName: PaymentVendor): string;
/**
 * Get vendor icon/logo identifier
 * Used in frontend for consistent icon display
 */
export declare function getVendorIcon(vendorName: PaymentVendor): string;
export {};
//# sourceMappingURL=paymentVendorService.d.ts.map