"use strict";
/**
 * Payment Vendor Service
 * Manages payment provider selection and configuration at restaurant level
 * Eliminates duplicate vendor selection logic in routes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivePaymentVendor = getActivePaymentVendor;
exports.setActivePaymentVendor = setActivePaymentVendor;
exports.getPaymentVendorConfig = getPaymentVendorConfig;
exports.isVendorAvailable = isVendorAvailable;
exports.getPrimaryPaymentVendor = getPrimaryPaymentVendor;
exports.setOrderPayEnabled = setOrderPayEnabled;
exports.getVendorDisplayName = getVendorDisplayName;
exports.getVendorIcon = getVendorIcon;
const db_1 = __importDefault(require("../config/db"));
const paymentTerminalService_1 = require("./paymentTerminalService");
/**
 * Get the currently active payment vendor for a restaurant
 *
 * @param restaurantId - Restaurant ID
 * @returns Active vendor name or 'none' if not configured
 */
async function getActivePaymentVendor(restaurantId) {
    try {
        const result = await db_1.default.query(`SELECT active_payment_vendor FROM restaurants WHERE id = $1`, [restaurantId]);
        if (result.rowCount === 0) {
            return 'none';
        }
        const vendor = result.rows[0].active_payment_vendor;
        return vendor || 'none';
    }
    catch (error) {
        console.error('[PaymentVendorService] Error getting active vendor:', error);
        return 'none';
    }
}
/**
 * Set the active payment vendor for a restaurant
 * Validates that terminal exists before setting
 *
 * @param restaurantId - Restaurant ID
 * @param vendorName - Payment vendor to activate
 * @param terminalId - Terminal ID to use (optional)
 * @returns true if update successful
 */
async function setActivePaymentVendor(restaurantId, vendorName, terminalId) {
    try {
        // Special case: vendor 'none' doesn't require terminal verification
        if (vendorName === 'none') {
            await db_1.default.query(`UPDATE restaurants SET active_payment_vendor = $1, updated_at = NOW() WHERE id = $2`, ['none', restaurantId]);
            (0, paymentTerminalService_1.invalidateTerminalCache)(restaurantId);
            return true;
        }
        // Verify that an active terminal exists for this vendor
        const terminal = await (0, paymentTerminalService_1.getActiveTerminal)(restaurantId, vendorName);
        if (!terminal) {
            console.warn(`[PaymentVendorService] No active terminal found for vendor ${vendorName}`);
            return false;
        }
        // Update the active vendor
        await db_1.default.query(`UPDATE restaurants SET active_payment_vendor = $1, updated_at = NOW() WHERE id = $2`, [vendorName, restaurantId]);
        (0, paymentTerminalService_1.invalidateTerminalCache)(restaurantId, vendorName);
        return true;
    }
    catch (error) {
        console.error('[PaymentVendorService] Error setting active vendor:', error);
        return false;
    }
}
/**
 * Get payment vendor configuration for a restaurant
 * Combines active vendor, order pay status, and available options
 *
 * @param restaurantId - Restaurant ID
 * @returns Full vendor configuration
 */
async function getPaymentVendorConfig(restaurantId) {
    try {
        const result = await db_1.default.query(`SELECT active_payment_vendor, order_pay_enabled 
       FROM restaurants WHERE id = $1`, [restaurantId]);
        if (result.rowCount === 0) {
            return {
                activeVendor: 'none',
                isOrderPayEnabled: false,
                availableVendors: [],
            };
        }
        const row = result.rows[0];
        const activeVendor = row.active_payment_vendor || 'none';
        const availableVendors = [];
        if (await (0, paymentTerminalService_1.getActiveTerminal)(restaurantId, 'payment-asia')) {
            availableVendors.push('payment-asia');
        }
        if (await (0, paymentTerminalService_1.getActiveTerminal)(restaurantId, 'kpay')) {
            availableVendors.push('kpay');
        }
        return {
            activeVendor: activeVendor,
            isOrderPayEnabled: row.order_pay_enabled === true,
            availableVendors,
        };
    }
    catch (error) {
        console.error('[PaymentVendorService] Error getting vendor config:', error);
        return {
            activeVendor: 'none',
            isOrderPayEnabled: false,
            availableVendors: [],
        };
    }
}
/**
 * Check if restaurant can use a specific payment vendor
 * Validates: vendor exists in database, terminal is active
 *
 * @param restaurantId - Restaurant ID
 * @param vendorName - Vendor to check
 * @returns true if vendor is available
 */
async function isVendorAvailable(restaurantId, vendorName) {
    if (vendorName === 'none')
        return true;
    return !!(await (0, paymentTerminalService_1.getActiveTerminal)(restaurantId, vendorName));
}
/**
 * Get the primary payment vendor for checkout
 * Returns active vendor if configured, otherwise first available vendor
 * Falls back to 'none' if no vendors available
 *
 * @param restaurantId - Restaurant ID
 * @returns Payment vendor to use for transactions
 */
async function getPrimaryPaymentVendor(restaurantId) {
    const config = await getPaymentVendorConfig(restaurantId);
    // Use active vendor if set and available
    if (config.activeVendor !== 'none' && config.availableVendors.includes(config.activeVendor)) {
        return config.activeVendor;
    }
    // Fall back to first available vendor
    if (config.availableVendors.length > 0) {
        return config.availableVendors[0];
    }
    return 'none';
}
/**
 * Update Order & Pay status for payment vendor
 * Validates that vendor has active terminal before enabling
 *
 * @param restaurantId - Restaurant ID
 * @param enabled - Enable or disable Order & Pay
 * @returns true if update successful
 */
async function setOrderPayEnabled(restaurantId, enabled) {
    try {
        // If enabling, verify that a payment vendor is active
        if (enabled) {
            const activeVendor = await getActivePaymentVendor(restaurantId);
            if (activeVendor === 'none') {
                console.warn('[PaymentVendorService] Cannot enable Order & Pay without active payment vendor');
                return false;
            }
            const terminal = await (0, paymentTerminalService_1.getActiveTerminal)(restaurantId, activeVendor);
            if (!terminal) {
                console.warn('[PaymentVendorService] Cannot enable Order & Pay - no active terminal for vendor');
                return false;
            }
        }
        await db_1.default.query(`UPDATE restaurants SET order_pay_enabled = $1, updated_at = NOW() WHERE id = $2`, [enabled, restaurantId]);
        return true;
    }
    catch (error) {
        console.error('[PaymentVendorService] Error updating Order & Pay status:', error);
        return false;
    }
}
/**
 * Get vendor display name for UI
 * Useful for consistent vendor naming across application
 */
function getVendorDisplayName(vendorName) {
    const displayNames = {
        'payment-asia': 'Payment Asia',
        kpay: 'KPay',
        none: 'No Payment Gateway',
    };
    return displayNames[vendorName] || vendorName;
}
/**
 * Get vendor icon/logo identifier
 * Used in frontend for consistent icon display
 */
function getVendorIcon(vendorName) {
    const iconMap = {
        'payment-asia': 'payment-asia-logo',
        kpay: 'kpay-logo',
        none: 'no-payment',
    };
    return iconMap[vendorName];
}
//# sourceMappingURL=paymentVendorService.js.map