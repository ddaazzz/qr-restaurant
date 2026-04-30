/**
 * Payment Asia Transaction Types
 * Comprehensive type definitions for Payment Asia transaction handling
 *
 * This file provides TypeScript interfaces for:
 * 1. Database model types (payment_asia_transactions table)
 * 2. Service request/response types
 * 3. Webhook and callback types
 * 4. Transaction status and state management
 */
/**
 * Payment Asia Transaction Status Enum
 * Represents all possible states of a payment transaction
 */
export declare enum PaymentAsiaTransactionStatus {
    PENDING = "pending",// Transaction initiated, awaiting payment
    APPROVED = "approved",// Payment successfully approved
    FAILED = "failed",// Payment failed or declined
    CANCELLED = "cancelled",// Transaction cancelled by user/merchant
    REFUNDED = "refunded"
}
/**
 * Payment Asia Transaction Type
 * Distinguishes between payment and refund transactions
 */
export declare enum PaymentAsiaTransactionType {
    PAYMENT = "payment",// Initial payment transaction
    REFUND = "refund"
}
/**
 * Payment Gateway Environment
 * Indicates whether transaction is in sandbox or production
 */
export declare enum PaymentGatewayEnvironment {
    SANDBOX = "sandbox",
    PRODUCTION = "production"
}
/**
 * PaymentAsiaTransaction
 * Main database model representing a Payment Asia transaction record
 * Maps to payment_asia_transactions table in PostgreSQL
 */
export interface PaymentAsiaTransaction {
    id: number;
    orderId: number | null;
    sessionId: number | null;
    restaurantId: number;
    merchantReference: string;
    transactionId: string | null;
    amountCents: bigint | number;
    currencyCode: string;
    status: PaymentAsiaTransactionStatus | string;
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    paymentMethod: string | null;
    paymentGatewayEnv: PaymentGatewayEnvironment | string;
    transactionType: PaymentAsiaTransactionType | string;
    requestData: Record<string, any>;
    responseData: Record<string, any>;
    signature: string | null;
    refundReference: string | null;
    refundAmountCents: bigint | number | null;
    refundTransactionId: string | null;
    createdAt: Date;
    approvedAt: Date | null;
    failedAt: Date | null;
    refundedAt: Date | null;
    errorCode: string | null;
    errorMessage: string | null;
    notes: string | null;
}
/**
 * CreatePaymentAsiaTransactionRequest
 * Data needed to create a new payment transaction record
 */
export interface CreatePaymentAsiaTransactionRequest {
    orderId?: number;
    sessionId?: number;
    restaurantId: number;
    merchantReference: string;
    amountCents: number;
    currencyCode?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    paymentGatewayEnv?: PaymentGatewayEnvironment | string;
    requestData?: Record<string, any>;
    network?: string;
    notes?: string;
}
/**
 * UpdatePaymentAsiaTransactionRequest
 * Data for updating an existing transaction (primarily for status updates)
 */
export interface UpdatePaymentAsiaTransactionRequest {
    transactionId?: string;
    status?: PaymentAsiaTransactionStatus | string;
    paymentMethod?: string;
    responseData?: Record<string, any>;
    signature?: string;
    errorCode?: string;
    errorMessage?: string;
    approvedAt?: Date;
    failedAt?: Date;
    notes?: string;
}
/**
 * PaymentAsiaWebhookRequest
 * Data structure expected from Payment Asia webhook callback
 */
export interface PaymentAsiaWebhookRequest {
    merchant_reference: string;
    request_reference?: string;
    transaction_id?: string;
    currency: string;
    amount: string;
    status: '0' | '1' | '2';
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    payment_method?: string;
    sign: string;
    timestamp?: string;
    [key: string]: any;
}
/**
 * PaymentAsiaWebhookResponse
 * Response structure for webhook callback validation
 */
export interface PaymentAsiaWebhookResponse {
    success: boolean;
    message: string;
    transactionId?: number;
    merchantReference?: string;
    error?: string;
}
/**
 * PaymentAsiaTransactionQueryOptions
 * Options for filtering and querying transactions
 */
export interface PaymentAsiaTransactionQueryOptions {
    restaurantId?: number;
    status?: PaymentAsiaTransactionStatus | string;
    orderId?: number;
    sessionId?: number;
    merchantReference?: string;
    transactionId?: string;
    customerEmail?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'approvedAt' | 'amountCents';
    sortOrder?: 'ASC' | 'DESC';
}
/**
 * PaymentAsiaTransactionStats
 * Statistics about Payment Asia transactions
 */
export interface PaymentAsiaTransactionStats {
    restaurantId: number;
    totalTransactions: number;
    approvedCount: number;
    failedCount: number;
    cancelledCount: number;
    refundedCount: number;
    totalApprovedAmount: number;
    totalRefundedAmount: number;
    avgTransactionAmount: number;
    successRate: number;
    datePeriod?: {
        from: Date;
        to: Date;
    };
}
/**
 * PaymentAsiaRefundRequest
 * Data structure for initiating a refund
 */
export interface PaymentAsiaRefundRequest {
    originalTransactionId: number;
    refundAmountCents: number;
    reason: string;
    requestedBy: string;
    merchantReference?: string;
}
/**
 * PaymentAsiaRefundResponse
 * Response from processing a refund request
 */
export interface PaymentAsiaRefundResponse {
    success: boolean;
    refundTransactionId: number;
    merchantReference: string;
    message: string;
    error?: string;
}
/**
 * PaymentAsiaReconciliation
 * Data for reconciling transactions against Payment Asia reports
 */
export interface PaymentAsiaReconciliation {
    transactionId: number;
    merchantReference: string;
    expectedAmount: number;
    reportedAmount: number;
    status: 'matched' | 'mismatch' | 'missing_in_report' | 'extra_in_report';
    discrepancyNotes: string;
    reconciliedAt: Date;
}
/**
 * PaymentAsiaTransactionReport
 * Report data for Payment Asia transactions
 */
export interface PaymentAsiaTransactionReport {
    restaurantId: number;
    periodStart: Date;
    periodEnd: Date;
    totalTransactions: number;
    stats: PaymentAsiaTransactionStats;
    transactions: PaymentAsiaTransaction[];
    reconciliationStatus?: {
        totalReconciled: number;
        totalMatched: number;
        totalMismatches: number;
        anomalies: PaymentAsiaReconciliation[];
    };
}
//# sourceMappingURL=paymentAsiaTransactionTypes.d.ts.map