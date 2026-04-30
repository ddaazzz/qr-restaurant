"use strict";
/**
 * Payment Status Mapper
 * Centralizes payment status code conversion logic for all payment providers
 * Eliminates duplicate mapping code across webhook handlers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentAsiaStatus = getPaymentAsiaStatus;
exports.getTransactionStatus = getTransactionStatus;
exports.getReturnCallbackStatus = getReturnCallbackStatus;
exports.isPaymentApproved = isPaymentApproved;
exports.isPaymentFailed = isPaymentFailed;
exports.getStatusDescription = getStatusDescription;
/**
 * Map Payment Asia webhook status codes to internal payment status
 * Payment Asia codes: 0=pending, 1=approved, 2=failed, 4=processing, 6=approved, 8=approved
 *
 * @param statusCode - Status code from Payment Asia
 * @returns Internal payment status: 'pending', 'completed', 'failed', 'processing'
 */
function getPaymentAsiaStatus(statusCode) {
    if (statusCode === 1 || statusCode === 6 || statusCode === 8) {
        return 'completed';
    }
    else if (statusCode === 2) {
        return 'failed';
    }
    else if (statusCode === 4) {
        return 'processing';
    }
    // status 0 = pending (payment not yet completed)
    return 'pending';
}
/**
 * Map Payment Asia webhook status to transaction status
 * Transaction status: 'approved', 'failed', 'pending', 'cancelled', 'refunded'
 *
 * @param webhookStatus - Status from webhook ('0', '1', '2')
 * @returns Transaction status enum value
 */
function getTransactionStatus(webhookStatus) {
    const code = parseInt(webhookStatus);
    if (code === 1 || code === 6 || code === 8) {
        return 'approved';
    }
    else if (code === 2) {
        return 'failed';
    }
    // code 0 = pending, code 4 = processing — both remain pending internally
    return 'pending';
}
/**
 * Map numeric status codes from Payment Asia return callback
 * Used in GET /payment/return endpoint
 * Codes: 0=failed, 1=approved, 2=rejected, 4=processing, 6=approved, 8=approved
 *
 * @param statusCode - Numeric status code
 * @returns 'completed', 'failed', or 'processing'
 */
function getReturnCallbackStatus(statusCode) {
    if (statusCode === 1 || statusCode === 6 || statusCode === 8) {
        return 'completed';
    }
    else if (statusCode === 0 || statusCode === 2) {
        return 'failed';
    }
    else if (statusCode === 4) {
        return 'processing';
    }
    return 'pending';
}
/**
 * Check if payment is approved/completed based on Payment Asia status code
 * Helper method for quick approval checks
 */
function isPaymentApproved(statusCode) {
    return statusCode === 1 || statusCode === 6 || statusCode === 8;
}
/**
 * Check if payment failed based on Payment Asia status code
 * Helper method for quick failure checks
 */
function isPaymentFailed(statusCode) {
    return statusCode === 2;
}
/**
 * Get human-readable status description
 * Useful for logs and error messages
 */
function getStatusDescription(statusCode) {
    const descriptions = {
        0: 'Pending',
        1: 'Approved',
        2: 'Failed/Rejected',
        4: 'Processing',
        6: 'Approved',
        8: 'Approved',
    };
    return descriptions[statusCode] || 'Unknown';
}
//# sourceMappingURL=paymentStatusMapper.js.map