"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentGatewayEnvironment = exports.PaymentAsiaTransactionType = exports.PaymentAsiaTransactionStatus = void 0;
/**
 * Payment Asia Transaction Status Enum
 * Represents all possible states of a payment transaction
 */
var PaymentAsiaTransactionStatus;
(function (PaymentAsiaTransactionStatus) {
    PaymentAsiaTransactionStatus["PENDING"] = "pending";
    PaymentAsiaTransactionStatus["APPROVED"] = "approved";
    PaymentAsiaTransactionStatus["FAILED"] = "failed";
    PaymentAsiaTransactionStatus["CANCELLED"] = "cancelled";
    PaymentAsiaTransactionStatus["REFUNDED"] = "refunded";
})(PaymentAsiaTransactionStatus || (exports.PaymentAsiaTransactionStatus = PaymentAsiaTransactionStatus = {}));
/**
 * Payment Asia Transaction Type
 * Distinguishes between payment and refund transactions
 */
var PaymentAsiaTransactionType;
(function (PaymentAsiaTransactionType) {
    PaymentAsiaTransactionType["PAYMENT"] = "payment";
    PaymentAsiaTransactionType["REFUND"] = "refund";
})(PaymentAsiaTransactionType || (exports.PaymentAsiaTransactionType = PaymentAsiaTransactionType = {}));
/**
 * Payment Gateway Environment
 * Indicates whether transaction is in sandbox or production
 */
var PaymentGatewayEnvironment;
(function (PaymentGatewayEnvironment) {
    PaymentGatewayEnvironment["SANDBOX"] = "sandbox";
    PaymentGatewayEnvironment["PRODUCTION"] = "production";
})(PaymentGatewayEnvironment || (exports.PaymentGatewayEnvironment = PaymentGatewayEnvironment = {}));
//# sourceMappingURL=paymentAsiaTransactionTypes.js.map