/**
 * Payment Asia Transactions Repository (DAO)
 * Database access layer for payment_asia_transactions table
 * 
 * Provides all CRUD operations and queries for Payment Asia transactions
 * including payment tracking, refund management, and reporting.
 */

import pool from '../config/db';
import {
  PaymentAsiaTransaction,
  CreatePaymentAsiaTransactionRequest,
  UpdatePaymentAsiaTransactionRequest,
  PaymentAsiaTransactionQueryOptions,
  PaymentAsiaTransactionStats,
  PaymentAsiaRefundRequest,
  PaymentAsiaRefundResponse,
  PaymentAsiaTransactionStatus,
} from './paymentAsiaTransactionTypes';

/**
 * PaymentAsiaTransactionRepository
 * Handles all database operations for payment_asia_transactions table
 */
class PaymentAsiaTransactionRepository {
  /**
   * Create a new payment transaction record
   */
  async createTransaction(
    data: CreatePaymentAsiaTransactionRequest
  ): Promise<PaymentAsiaTransaction> {
    const query = `
      INSERT INTO payment_asia_transactions (
        order_id, session_id, restaurant_id,
        merchant_reference, amount_cents, currency_code,
        status, customer_name, customer_email, customer_phone,
        payment_gateway_env, transaction_type, request_data, network, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING
        id, order_id AS "orderId", session_id AS "sessionId",
        restaurant_id AS "restaurantId", merchant_reference AS "merchantReference",
        transaction_id AS "transactionId", amount_cents AS "amountCents",
        currency_code AS "currencyCode", status, customer_name AS "customerName",
        customer_email AS "customerEmail", customer_phone AS "customerPhone",
        payment_method AS "paymentMethod", payment_gateway_env AS "paymentGatewayEnv",
        transaction_type AS "transactionType", request_data AS "requestData",
        response_data AS "responseData", signature, refund_reference AS "refundReference",
        refund_amount_cents AS "refundAmountCents", refund_transaction_id AS "refundTransactionId",
        created_at AS "createdAt", approved_at AS "approvedAt",
        failed_at AS "failedAt", refunded_at AS "refundedAt",
        error_code AS "errorCode", error_message AS "errorMessage", notes
    `;

    const result = await pool.query(query, [
      data.orderId || null,
      data.sessionId || null,
      data.restaurantId,
      data.merchantReference,
      data.amountCents,
      data.currencyCode || 'SGD',
      'pending',
      data.customerName || null,
      data.customerEmail || null,
      data.customerPhone || null,
      data.paymentGatewayEnv || 'sandbox',
      'payment',
      JSON.stringify(data.requestData || {}),
      data.network || null,
      data.notes || null,
    ]);

    return this.mapRowToTransaction(result.rows[0]);
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(id: number): Promise<PaymentAsiaTransaction | null> {
    const query = `
      SELECT
        id, order_id AS "orderId", session_id AS "sessionId",
        restaurant_id AS "restaurantId", merchant_reference AS "merchantReference",
        transaction_id AS "transactionId", amount_cents AS "amountCents",
        currency_code AS "currencyCode", status, customer_name AS "customerName",
        customer_email AS "customerEmail", customer_phone AS "customerPhone",
        payment_method AS "paymentMethod", payment_gateway_env AS "paymentGatewayEnv",
        transaction_type AS "transactionType", request_data AS "requestData",
        response_data AS "responseData", signature, refund_reference AS "refundReference",
        refund_amount_cents AS "refundAmountCents", refund_transaction_id AS "refundTransactionId",
        created_at AS "createdAt", approved_at AS "approvedAt",
        failed_at AS "failedAt", refunded_at AS "refundedAt",
        error_code AS "errorCode", error_message AS "errorMessage", notes
      FROM payment_asia_transactions
      WHERE id = $1
    `;

    const result = await pool.query(query, [id]);
    return result.rows.length > 0 ? this.mapRowToTransaction(result.rows[0]) : null;
  }

  /**
   * Get transaction by merchant reference
   */
  async getTransactionByMerchantReference(
    merchantReference: string
  ): Promise<PaymentAsiaTransaction | null> {
    const query = `
      SELECT
        id, order_id AS "orderId", session_id AS "sessionId",
        restaurant_id AS "restaurantId", merchant_reference AS "merchantReference",
        transaction_id AS "transactionId", amount_cents AS "amountCents",
        currency_code AS "currencyCode", status, customer_name AS "customerName",
        customer_email AS "customerEmail", customer_phone AS "customerPhone",
        payment_method AS "paymentMethod", payment_gateway_env AS "paymentGatewayEnv",
        transaction_type AS "transactionType", request_data AS "requestData",
        response_data AS "responseData", signature, refund_reference AS "refundReference",
        refund_amount_cents AS "refundAmountCents", refund_transaction_id AS "refundTransactionId",
        created_at AS "createdAt", approved_at AS "approvedAt",
        failed_at AS "failedAt", refunded_at AS "refundedAt",
        error_code AS "errorCode", error_message AS "errorMessage", notes
      FROM payment_asia_transactions
      WHERE merchant_reference = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [merchantReference]);
    return result.rows.length > 0 ? this.mapRowToTransaction(result.rows[0]) : null;
  }

  /**
   * Get transaction by Payment Asia transaction ID
   */
  async getTransactionByPaymentAsiaId(
    transactionId: string
  ): Promise<PaymentAsiaTransaction | null> {
    const query = `
      SELECT
        id, order_id AS "orderId", session_id AS "sessionId",
        restaurant_id AS "restaurantId", merchant_reference AS "merchantReference",
        transaction_id AS "transactionId", amount_cents AS "amountCents",
        currency_code AS "currencyCode", status, customer_name AS "customerName",
        customer_email AS "customerEmail", customer_phone AS "customerPhone",
        payment_method AS "paymentMethod", payment_gateway_env AS "paymentGatewayEnv",
        transaction_type AS "transactionType", request_data AS "requestData",
        response_data AS "responseData", signature, refund_reference AS "refundReference",
        refund_amount_cents AS "refundAmountCents", refund_transaction_id AS "refundTransactionId",
        created_at AS "createdAt", approved_at AS "approvedAt",
        failed_at AS "failedAt", refunded_at AS "refundedAt",
        error_code AS "errorCode", error_message AS "errorMessage", notes
      FROM payment_asia_transactions
      WHERE transaction_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [transactionId]);
    return result.rows.length > 0 ? this.mapRowToTransaction(result.rows[0]) : null;
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    id: number,
    data: UpdatePaymentAsiaTransactionRequest
  ): Promise<PaymentAsiaTransaction | null> {
    const fields: string[] = [];
    const values: any[] = [id];
    let paramCount = 2;

    if (data.transactionId !== undefined) {
      fields.push(`transaction_id = $${paramCount++}`);
      values.push(data.transactionId);
    }

    if (data.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(data.status);
    }

    if (data.paymentMethod !== undefined) {
      fields.push(`payment_method = $${paramCount++}`);
      values.push(data.paymentMethod);
    }

    if (data.responseData !== undefined) {
      fields.push(`response_data = $${paramCount++}`);
      values.push(JSON.stringify(data.responseData));
    }

    if (data.signature !== undefined) {
      fields.push(`signature = $${paramCount++}`);
      values.push(data.signature);
    }

    if (data.errorCode !== undefined) {
      fields.push(`error_code = $${paramCount++}`);
      values.push(data.errorCode);
    }

    if (data.errorMessage !== undefined) {
      fields.push(`error_message = $${paramCount++}`);
      values.push(data.errorMessage);
    }

    if (data.approvedAt !== undefined) {
      fields.push(`approved_at = $${paramCount++}`);
      values.push(data.approvedAt);
    }

    if (data.failedAt !== undefined) {
      fields.push(`failed_at = $${paramCount++}`);
      values.push(data.failedAt);
    }

    if (data.notes !== undefined) {
      fields.push(`notes = $${paramCount++}`);
      values.push(data.notes);
    }

    if (fields.length === 0) {
      return this.getTransactionById(id);
    }

    const query = `
      UPDATE payment_asia_transactions
      SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING
        id, order_id AS "orderId", session_id AS "sessionId",
        restaurant_id AS "restaurantId", merchant_reference AS "merchantReference",
        transaction_id AS "transactionId", amount_cents AS "amountCents",
        currency_code AS "currencyCode", status, customer_name AS "customerName",
        customer_email AS "customerEmail", customer_phone AS "customerPhone",
        payment_method AS "paymentMethod", payment_gateway_env AS "paymentGatewayEnv",
        transaction_type AS "transactionType", request_data AS "requestData",
        response_data AS "responseData", signature, refund_reference AS "refundReference",
        refund_amount_cents AS "refundAmountCents", refund_transaction_id AS "refundTransactionId",
        created_at AS "createdAt", approved_at AS "approvedAt",
        failed_at AS "failedAt", refunded_at AS "refundedAt",
        error_code AS "errorCode", error_message AS "errorMessage", notes
    `;

    const result = await pool.query(query, values);
    return result.rows.length > 0 ? this.mapRowToTransaction(result.rows[0]) : null;
  }

  /**
   * Query transactions with filters
   */
  async queryTransactions(
    options: PaymentAsiaTransactionQueryOptions
  ): Promise<{ transactions: PaymentAsiaTransaction[]; total: number }> {
    let whereConditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (options.restaurantId !== undefined) {
      whereConditions.push(`restaurant_id = $${paramCount++}`);
      values.push(options.restaurantId);
    }

    if (options.status !== undefined) {
      whereConditions.push(`status = $${paramCount++}`);
      values.push(options.status);
    }

    if (options.orderId !== undefined) {
      whereConditions.push(`order_id = $${paramCount++}`);
      values.push(options.orderId);
    }

    if (options.sessionId !== undefined) {
      whereConditions.push(`session_id = $${paramCount++}`);
      values.push(options.sessionId);
    }

    if (options.merchantReference !== undefined) {
      whereConditions.push(`merchant_reference = $${paramCount++}`);
      values.push(options.merchantReference);
    }

    if (options.transactionId !== undefined) {
      whereConditions.push(`transaction_id = $${paramCount++}`);
      values.push(options.transactionId);
    }

    if (options.customerEmail !== undefined) {
      whereConditions.push(`customer_email = $${paramCount++}`);
      values.push(options.customerEmail);
    }

    if (options.dateFrom !== undefined) {
      whereConditions.push(`created_at >= $${paramCount++}`);
      values.push(options.dateFrom);
    }

    if (options.dateTo !== undefined) {
      whereConditions.push(`created_at <= $${paramCount++}`);
      values.push(options.dateTo);
    }

    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM payment_asia_transactions ${whereClause}`;
    const countResult = await pool.query(countQuery, values.slice(0, paramCount - 1));
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'DESC';
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    const sortByMap: Record<string, string> = {
      createdAt: 'created_at',
      approvedAt: 'approved_at',
      amountCents: 'amount_cents',
    };

    const query = `
      SELECT
        id, order_id AS "orderId", session_id AS "sessionId",
        restaurant_id AS "restaurantId", merchant_reference AS "merchantReference",
        transaction_id AS "transactionId", amount_cents AS "amountCents",
        currency_code AS "currencyCode", status, customer_name AS "customerName",
        customer_email AS "customerEmail", customer_phone AS "customerPhone",
        payment_method AS "paymentMethod", payment_gateway_env AS "paymentGatewayEnv",
        transaction_type AS "transactionType", request_data AS "requestData",
        response_data AS "responseData", signature, refund_reference AS "refundReference",
        refund_amount_cents AS "refundAmountCents", refund_transaction_id AS "refundTransactionId",
        created_at AS "createdAt", approved_at AS "approvedAt",
        failed_at AS "failedAt", refunded_at AS "refundedAt",
        error_code AS "errorCode", error_message AS "errorMessage", notes
      FROM payment_asia_transactions
      ${whereClause}
      ORDER BY ${sortByMap[sortBy]} ${sortOrder}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    values.push(limit, offset);

    const result = await pool.query(query, values);

    return {
      transactions: result.rows.map((row) => this.mapRowToTransaction(row)),
      total,
    };
  }

  /**
   * Get transaction statistics for a restaurant
   */
  async getTransactionStats(
    restaurantId: number,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<PaymentAsiaTransactionStats> {
    let whereClause = 'WHERE restaurant_id = $1';
    const params: any[] = [restaurantId];

    if (dateFrom) {
      whereClause += ` AND created_at >= $${params.length + 1}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ` AND created_at <= $${params.length + 1}`;
      params.push(dateTo);
    }

    const query = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
        SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as refunded_count,
        SUM(CASE WHEN status = 'approved' THEN amount_cents ELSE 0 END) as total_approved_amount,
        SUM(CASE WHEN transaction_type = 'refund' THEN refund_amount_cents ELSE 0 END) as total_refunded_amount,
        AVG(amount_cents) as avg_amount
      FROM payment_asia_transactions
      ${whereClause}
    `;

    const result = await pool.query(query, params);
    const row = result.rows[0];

    const totalTransactions = parseInt(row.total) || 0;
    const approvedCount = parseInt(row.approved_count) || 0;

    return {
      restaurantId,
      totalTransactions,
      approvedCount,
      failedCount: parseInt(row.failed_count) || 0,
      cancelledCount: parseInt(row.cancelled_count) || 0,
      refundedCount: parseInt(row.refunded_count) || 0,
      totalApprovedAmount: parseInt(row.total_approved_amount) || 0,
      totalRefundedAmount: parseInt(row.total_refunded_amount) || 0,
      avgTransactionAmount: Math.round(parseFloat(row.avg_amount) || 0),
      successRate:
        totalTransactions > 0 ? (approvedCount / totalTransactions) * 100 : 0,
      ...(dateFrom || dateTo ? { datePeriod: { from: dateFrom as Date, to: dateTo as Date } } : {}),
    };
  }

  /**
   * Create a refund transaction
   */
  async createRefund(
    refundRequest: PaymentAsiaRefundRequest
  ): Promise<PaymentAsiaRefundResponse> {
    // Get original transaction
    const originalTx = await this.getTransactionById(refundRequest.originalTransactionId);

    if (!originalTx || originalTx.status !== 'approved') {
      throw new Error('Original transaction not found or not in approved state');
    }

    // Generate refund merchant reference
    const merchantRef = refundRequest.merchantReference || `${originalTx.merchantReference}-REFUND-${Date.now()}`;

    // Create refund transaction
    const refundTx = await this.createTransaction({
      restaurantId: originalTx.restaurantId,
      merchantReference: merchantRef,
      amountCents: refundRequest.refundAmountCents,
      currencyCode: originalTx.currencyCode,
      ...(originalTx.customerEmail ? { customerEmail: originalTx.customerEmail } : {}),
      ...(originalTx.customerName ? { customerName: originalTx.customerName } : {}),
      paymentGatewayEnv: originalTx.paymentGatewayEnv,
      notes: `Refund for transaction ${originalTx.id}: ${refundRequest.reason}. Requested by: ${refundRequest.requestedBy}`,
    });

    // Update original transaction with refund reference
    await pool.query(
      `
      UPDATE payment_asia_transactions
      SET refund_reference = $1, refund_amount_cents = $2
      WHERE id = $3
      `,
      [merchantRef, refundRequest.refundAmountCents, refundRequest.originalTransactionId]
    );

    return {
      success: true,
      refundTransactionId: refundTx.id,
      merchantReference: merchantRef,
      message: `Refund initiated. Transaction ID: ${refundTx.id}`,
    };
  }

  /**
   * Get transactions for reconciliation
   */
  async getTransactionsForReconciliation(
    restaurantId: number,
    dateFrom: Date,
    dateTo: Date
  ): Promise<PaymentAsiaTransaction[]> {
    const query = `
      SELECT
        id, order_id AS "orderId", session_id AS "sessionId",
        restaurant_id AS "restaurantId", merchant_reference AS "merchantReference",
        transaction_id AS "transactionId", amount_cents AS "amountCents",
        currency_code AS "currencyCode", status, customer_name AS "customerName",
        customer_email AS "customerEmail", customer_phone AS "customerPhone",
        payment_method AS "paymentMethod", payment_gateway_env AS "paymentGatewayEnv",
        transaction_type AS "transactionType", request_data AS "requestData",
        response_data AS "responseData", signature, refund_reference AS "refundReference",
        refund_amount_cents AS "refundAmountCents", refund_transaction_id AS "refundTransactionId",
        created_at AS "createdAt", approved_at AS "approvedAt",
        failed_at AS "failedAt", refunded_at AS "refundedAt",
        error_code AS "errorCode", error_message AS "errorMessage", notes
      FROM payment_asia_transactions
      WHERE restaurant_id = $1
        AND created_at >= $2
        AND created_at <= $3
        AND status IN ('approved', 'refunded')
      ORDER BY created_at ASC
    `;

    const result = await pool.query(query, [restaurantId, dateFrom, dateTo]);
    return result.rows.map((row) => this.mapRowToTransaction(row));
  }

  /**
   * Helper method to map database row to TypeScript object
   */
  private mapRowToTransaction(row: any): PaymentAsiaTransaction {
    return {
      id: row.id,
      orderId: row.orderId,
      sessionId: row.sessionId,
      restaurantId: row.restaurantId,
      merchantReference: row.merchantReference,
      transactionId: row.transactionId,
      amountCents: BigInt(row.amountCents),
      currencyCode: row.currencyCode,
      status: row.status,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      customerPhone: row.customerPhone,
      paymentMethod: row.paymentMethod,
      paymentGatewayEnv: row.paymentGatewayEnv,
      transactionType: row.transactionType,
      requestData: row.requestData || {},
      responseData: row.responseData || {},
      signature: row.signature,
      refundReference: row.refundReference,
      refundAmountCents: row.refundAmountCents ? BigInt(row.refundAmountCents) : null,
      refundTransactionId: row.refundTransactionId,
      createdAt: row.createdAt,
      approvedAt: row.approvedAt,
      failedAt: row.failedAt,
      refundedAt: row.refundedAt,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      notes: row.notes,
    };
  }
}

export default new PaymentAsiaTransactionRepository();
