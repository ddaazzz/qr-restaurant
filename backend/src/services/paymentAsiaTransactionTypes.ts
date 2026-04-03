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
export enum PaymentAsiaTransactionStatus {
  PENDING = 'pending',        // Transaction initiated, awaiting payment
  APPROVED = 'approved',      // Payment successfully approved
  FAILED = 'failed',          // Payment failed or declined
  CANCELLED = 'cancelled',    // Transaction cancelled by user/merchant
  REFUNDED = 'refunded',      // Payment refunded
}

/**
 * Payment Asia Transaction Type
 * Distinguishes between payment and refund transactions
 */
export enum PaymentAsiaTransactionType {
  PAYMENT = 'payment',        // Initial payment transaction
  REFUND = 'refund',          // Refund transaction
}

/**
 * Payment Gateway Environment
 * Indicates whether transaction is in sandbox or production
 */
export enum PaymentGatewayEnvironment {
  SANDBOX = 'sandbox',
  PRODUCTION = 'production',
}

/**
 * PaymentAsiaTransaction
 * Main database model representing a Payment Asia transaction record
 * Maps to payment_asia_transactions table in PostgreSQL
 */
export interface PaymentAsiaTransaction {
  id: number;
  
  // Relationships
  orderId: number | null;
  sessionId: number | null;
  restaurantId: number;
  
  // Transaction identifiers
  merchantReference: string;   // Unique identifier from merchant
  transactionId: string | null; // ID from Payment Asia response
  
  // Amount and currency
  amountCents: bigint | number;
  currencyCode: string;        // ISO 4217 code (SGD, HKD, MYR, etc)
  
  // Payment status
  status: PaymentAsiaTransactionStatus | string;
  
  // Customer information
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  
  // Payment details
  paymentMethod: string | null;      // e.g., 'credit_card', 'bank_transfer', 'alipay'
  paymentGatewayEnv: PaymentGatewayEnvironment | string;
  
  // Transaction type
  transactionType: PaymentAsiaTransactionType | string;
  
  // Request/Response data
  requestData: Record<string, any>;
  responseData: Record<string, any>;
  signature: string | null;
  
  // Refund information
  refundReference: string | null;
  refundAmountCents: bigint | number | null;
  refundTransactionId: string | null;
  
  // Timestamp tracking
  createdAt: Date;
  approvedAt: Date | null;
  failedAt: Date | null;
  refundedAt: Date | null;
  
  // Error tracking
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
  status: '0' | '1' | '2';  // 0=pending, 1=approved, 2=failed
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  payment_method?: string;
  sign: string;              // Signature for validation
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
  successRate: number;           // Percentage of approved transactions
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
  originalTransactionId: number; // ID of the payment_asia_transactions record to refund
  refundAmountCents: number;
  reason: string;
  requestedBy: string;           // User or system that requested the refund
  merchantReference?: string;    // Override default merchant reference generation
}

/**
 * PaymentAsiaRefundResponse
 * Response from processing a refund request
 */
export interface PaymentAsiaRefundResponse {
  success: boolean;
  refundTransactionId: number;  // ID of the new refund transaction
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
