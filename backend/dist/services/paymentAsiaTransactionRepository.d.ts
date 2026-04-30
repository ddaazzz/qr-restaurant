/**
 * Payment Asia Transactions Repository (DAO)
 * Database access layer for payment_asia_transactions table
 *
 * Provides all CRUD operations and queries for Payment Asia transactions
 * including payment tracking, refund management, and reporting.
 */
import { PaymentAsiaTransaction, CreatePaymentAsiaTransactionRequest, UpdatePaymentAsiaTransactionRequest, PaymentAsiaTransactionQueryOptions, PaymentAsiaTransactionStats, PaymentAsiaRefundRequest, PaymentAsiaRefundResponse } from './paymentAsiaTransactionTypes';
/**
 * PaymentAsiaTransactionRepository
 * Handles all database operations for payment_asia_transactions table
 */
declare class PaymentAsiaTransactionRepository {
    /**
     * Create a new payment transaction record
     */
    createTransaction(data: CreatePaymentAsiaTransactionRequest): Promise<PaymentAsiaTransaction>;
    /**
     * Get transaction by ID
     */
    getTransactionById(id: number): Promise<PaymentAsiaTransaction | null>;
    /**
     * Get transaction by merchant reference
     */
    getTransactionByMerchantReference(merchantReference: string): Promise<PaymentAsiaTransaction | null>;
    /**
     * Get transaction by Payment Asia transaction ID
     */
    getTransactionByPaymentAsiaId(transactionId: string): Promise<PaymentAsiaTransaction | null>;
    /**
     * Update transaction status
     */
    updateTransactionStatus(id: number, data: UpdatePaymentAsiaTransactionRequest): Promise<PaymentAsiaTransaction | null>;
    /**
     * Query transactions with filters
     */
    queryTransactions(options: PaymentAsiaTransactionQueryOptions): Promise<{
        transactions: PaymentAsiaTransaction[];
        total: number;
    }>;
    /**
     * Get transaction statistics for a restaurant
     */
    getTransactionStats(restaurantId: number, dateFrom?: Date, dateTo?: Date): Promise<PaymentAsiaTransactionStats>;
    /**
     * Create a refund transaction
     */
    createRefund(refundRequest: PaymentAsiaRefundRequest): Promise<PaymentAsiaRefundResponse>;
    /**
     * Get transactions for reconciliation
     */
    getTransactionsForReconciliation(restaurantId: number, dateFrom: Date, dateTo: Date): Promise<PaymentAsiaTransaction[]>;
    /**
     * Helper method to map database row to TypeScript object
     */
    private mapRowToTransaction;
}
declare const _default: PaymentAsiaTransactionRepository;
export default _default;
//# sourceMappingURL=paymentAsiaTransactionRepository.d.ts.map