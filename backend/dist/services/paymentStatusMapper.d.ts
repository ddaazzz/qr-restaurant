/**
 * Payment Status Mapper
 * Centralizes payment status code conversion logic for all payment providers
 * Eliminates duplicate mapping code across webhook handlers
 */
/**
 * Map Payment Asia webhook status codes to internal payment status
 * Payment Asia codes: 0=pending, 1=approved, 2=failed, 4=processing, 6=approved, 8=approved
 *
 * @param statusCode - Status code from Payment Asia
 * @returns Internal payment status: 'pending', 'completed', 'failed', 'processing'
 */
export declare function getPaymentAsiaStatus(statusCode: number): string;
/**
 * Map Payment Asia webhook status to transaction status
 * Transaction status: 'approved', 'failed', 'pending', 'cancelled', 'refunded'
 *
 * @param webhookStatus - Status from webhook ('0', '1', '2')
 * @returns Transaction status enum value
 */
export declare function getTransactionStatus(webhookStatus: string): string;
/**
 * Map numeric status codes from Payment Asia return callback
 * Used in GET /payment/return endpoint
 * Codes: 0=failed, 1=approved, 2=rejected, 4=processing, 6=approved, 8=approved
 *
 * @param statusCode - Numeric status code
 * @returns 'completed', 'failed', or 'processing'
 */
export declare function getReturnCallbackStatus(statusCode: number): string;
/**
 * Check if payment is approved/completed based on Payment Asia status code
 * Helper method for quick approval checks
 */
export declare function isPaymentApproved(statusCode: number): boolean;
/**
 * Check if payment failed based on Payment Asia status code
 * Helper method for quick failure checks
 */
export declare function isPaymentFailed(statusCode: number): boolean;
/**
 * Get human-readable status description
 * Useful for logs and error messages
 */
export declare function getStatusDescription(statusCode: number): string;
//# sourceMappingURL=paymentStatusMapper.d.ts.map