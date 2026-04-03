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
export function getPaymentAsiaStatus(statusCode: number): string {
  if (statusCode === 1 || statusCode === 6 || statusCode === 8) {
    return 'completed';
  } else if (statusCode === 0 || statusCode === 2) {
    return 'failed';
  } else if (statusCode === 4) {
    return 'processing';
  }
  return 'pending';
}

/**
 * Map Payment Asia webhook status to transaction status
 * Transaction status: 'approved', 'failed', 'pending', 'cancelled', 'refunded'
 * 
 * @param webhookStatus - Status from webhook ('0', '1', '2')
 * @returns Transaction status enum value
 */
export function getTransactionStatus(webhookStatus: string): string {
  const code = parseInt(webhookStatus);
  if (code === 1 || code === 6 || code === 8) {
    return 'approved';
  } else if (code === 0 || code === 2) {
    return 'failed';
  }
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
export function getReturnCallbackStatus(statusCode: number): string {
  if (statusCode === 1 || statusCode === 6 || statusCode === 8) {
    return 'completed';
  } else if (statusCode === 0 || statusCode === 2) {
    return 'failed';
  } else if (statusCode === 4) {
    return 'processing';
  }
  return 'pending';
}

/**
 * Check if payment is approved/completed based on Payment Asia status code
 * Helper method for quick approval checks
 */
export function isPaymentApproved(statusCode: number): boolean {
  return statusCode === 1 || statusCode === 6 || statusCode === 8;
}

/**
 * Check if payment failed based on Payment Asia status code
 * Helper method for quick failure checks
 */
export function isPaymentFailed(statusCode: number): boolean {
  return statusCode === 0 || statusCode === 2;
}

/**
 * Get human-readable status description
 * Useful for logs and error messages
 */
export function getStatusDescription(statusCode: number): string {
  const descriptions: Record<number, string> = {
    0: 'Pending',
    1: 'Approved',
    2: 'Failed/Rejected',
    4: 'Processing',
    6: 'Approved',
    8: 'Approved',
  };
  return descriptions[statusCode] || 'Unknown';
}
