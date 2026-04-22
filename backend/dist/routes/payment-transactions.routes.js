"use strict";
/**
 * Payment Transactions Routes
 * Handles payment transaction creation and webhook processing
 * Supports Payment Asia and other online payment gateways
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const paymentAsiaService_1 = require("../services/paymentAsiaService");
const paymentAsiaTransactionRepository_1 = __importDefault(require("../services/paymentAsiaTransactionRepository"));
const paymentStatusMapper = __importStar(require("../services/paymentStatusMapper"));
const websocket_1 = require("../services/websocket");
const router = (0, express_1.Router)();
// In-memory store for test payment webhook notifications
// Key: merchant_reference, Value: payment result data
const testPaymentWebhooks = new Map();
/**
 * POST /api/restaurants/:restaurantId/sessions/:sessionId/orders/:orderId/initiate-payment
 * Initiate a payment transaction for an order (Payment Asia form-based flow)
 *
 * Request body:
 * {
 *   customer_name: string
 *   customer_email: string
 *   customer_phone: string
 *   customer_ip: string
 *   customer_address: string
 *   customer_state: string
 *   customer_country: string (2-letter code)
 * }
 *
 * Currency & Network Restrictions (Payment Asia):
 * - CreditCard, Fps: support HKD and USD
 * - Other channels (Alipay, Wechat, CUP, Octopus): support HKD only
 *
 * Returns:
 * {
 *   success: boolean
 *   message: string
 *   paymentUrl: string (Payment Asia form action URL - where to POST form)
 *   formData: object (ALL form fields including merchant_reference and sign)
 *   paymentRecordId: number
 *   error?: string (includes currency validation errors)
 * }
 */
router.post('/restaurants/:restaurantId/sessions/:sessionId/orders/:orderId/initiate-payment', async (req, res) => {
    try {
        const { restaurantId, sessionId, orderId } = req.params;
        const { customer_name, customer_email, } = req.body;
        // Validate truly required fields only
        if (!customer_name || !customer_email) {
            return res.status(400).json({
                error: 'Missing required fields: customer_name, customer_email',
            });
        }
        // Apply defaults for optional customer fields
        const customer_phone = req.body.customer_phone || '';
        const customer_ip = req.body.customer_ip || req.ip || '127.0.0.1';
        const customer_address = req.body.customer_address || 'N/A';
        const customer_state = req.body.customer_state || 'HK';
        const customer_country = req.body.customer_country || 'HK';
        // Map frontend payment method values to Payment Asia case-sensitive network names
        const NETWORK_MAPPING = {
            creditcard: 'CreditCard',
            fps: 'Fps',
            alipay: 'Alipay',
            wechat: 'Wechat',
            cup: 'CUP',
            octopus: 'Octopus',
            userdefine: 'UserDefine',
        };
        const rawNetwork = req.body.network || req.body.payment_method;
        const network = rawNetwork
            ? NETWORK_MAPPING[String(rawNetwork).toLowerCase()] || String(rawNetwork)
            : undefined;
        // Fetch restaurant payment configuration (including service charge)
        const restaurantRes = await db_1.default.query(`SELECT active_payment_vendor, active_payment_terminal_id, service_charge_percent FROM restaurants WHERE id = $1`, [restaurantId]);
        if (restaurantRes.rowCount === 0) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }
        const restaurant = restaurantRes.rows[0];
        if (restaurant.active_payment_vendor !== 'payment-asia') {
            return res.status(400).json({
                error: 'Payment Asia is not enabled for this restaurant',
            });
        }
        // Fetch Payment Asia terminal configuration
        const terminalRes = await db_1.default.query(`SELECT id, merchant_token, secret_code, payment_gateway_env FROM payment_terminals
         WHERE id = $1 AND restaurant_id = $2 AND vendor_name = 'payment-asia'`, [restaurant.active_payment_terminal_id, restaurantId]);
        if (terminalRes.rowCount === 0) {
            return res.status(400).json({
                error: 'Payment Asia terminal not configured',
            });
        }
        const terminal = terminalRes.rows[0];
        // Fetch order and calculate total (price_cents, exclude removed items)
        const orderRes = await db_1.default.query(`SELECT o.id, o.session_id, o.restaurant_id,
                COALESCE(SUM(oi.price_cents * oi.quantity), 0) as subtotal_cents
         FROM orders o
         LEFT JOIN order_items oi ON o.id = oi.order_id AND oi.removed = false
         WHERE o.id = $1 AND o.session_id = $2 AND o.restaurant_id = $3
         GROUP BY o.id, o.session_id, o.restaurant_id`, [orderId, sessionId, restaurantId]);
        if (orderRes.rowCount === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const order = orderRes.rows[0];
        const subtotalCents = parseInt(order.subtotal_cents) || 0;
        const serviceChargePercent = restaurant.service_charge_percent || 0;
        const serviceChargeCents = Math.round(subtotalCents * serviceChargePercent / 100);
        const totalCents = subtotalCents + serviceChargeCents;
        // Check for existing pending payment
        const existingPaymentRes = await db_1.default.query(`SELECT id FROM order_payments 
         WHERE order_id = $1 AND payment_status = 'pending'
         LIMIT 1`, [orderId]);
        // Generate unique chuio_order_reference for this payment attempt
        const chuioRef = `PA-${orderId}-${Date.now()}`;
        // Save chuio_order_reference to orders table
        await db_1.default.query(`UPDATE orders SET chuio_order_reference = $1, payment_method = 'payment-asia' WHERE id = $2`, [chuioRef, orderId]);
        let paymentRecord;
        if (existingPaymentRes.rowCount != null && existingPaymentRes.rowCount > 0) {
            // Update existing pending payment with fresh amount and new reference
            await db_1.default.query(`UPDATE order_payments SET amount_cents = $1, currency = 'HKD',
           chuio_order_reference = $2, updated_at = NOW() WHERE id = $3`, [totalCents, chuioRef, existingPaymentRes.rows[0].id]);
            paymentRecord = existingPaymentRes.rows[0];
        }
        else {
            const createPaymentRes = await db_1.default.query(`INSERT INTO order_payments
           (order_id, session_id, restaurant_id, vendor_name, payment_status,
            amount_cents, currency, customer_name, customer_email, customer_phone, chuio_order_reference)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`, [
                orderId, sessionId, restaurantId, 'payment-asia', 'pending',
                totalCents, 'HKD', customer_name, customer_email, customer_phone, chuioRef,
            ]);
            paymentRecord = createPaymentRes.rows[0];
        }
        // Initialize Payment Asia service
        paymentAsiaService_1.paymentAsiaService.initialize({
            merchantToken: terminal.merchant_token,
            secretCode: terminal.secret_code,
            environment: terminal.payment_gateway_env || 'sandbox',
        });
        // Build payment form data (all required fields for Payment Asia form submission)
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const menuReturnUrl = req.body.menu_return_url || '';
        const returnUrl = `${baseUrl}/api/restaurants/${restaurantId}/payment/return?order_id=${orderId}&payment_record_id=${paymentRecord.id}&merchant_reference=${encodeURIComponent(chuioRef)}${menuReturnUrl ? '&menu_return_url=' + encodeURIComponent(menuReturnUrl) : ''}`;
        const notifyUrl = `${baseUrl}/api/restaurants/${restaurantId}/webhook/payment-asia`;
        const formData = paymentAsiaService_1.paymentAsiaService.buildPaymentForm({
            orderId: chuioRef,
            amount: totalCents,
            currency: 'HKD',
            customerName: customer_name,
            customerEmail: customer_email,
            customerPhone: customer_phone,
            customerCountry: customer_country,
            customerState: customer_state,
            customerAddress: customer_address,
            customerIp: customer_ip,
            subject: `Order #${orderId}`,
            ...(network ? { network } : {}),
            returnUrl,
            notifyUrl,
        });
        const paymentUrl = paymentAsiaService_1.paymentAsiaService.getPaymentFormUrl(network);
        // Store form signature in database
        await db_1.default.query(`UPDATE order_payments 
         SET signature = $1, payment_url = $2, response_data = $3,
             updated_at = NOW()
         WHERE id = $4`, [formData.sign, paymentUrl, JSON.stringify(formData), paymentRecord.id]);
        // Log to payment_asia_transactions for audit trail
        try {
            const paymentAsiaTransaction = await paymentAsiaTransactionRepository_1.default.createTransaction({
                orderId: parseInt(orderId),
                sessionId: parseInt(sessionId),
                restaurantId: parseInt(restaurantId),
                merchantReference: chuioRef,
                amountCents: totalCents,
                currencyCode: 'HKD',
                customerName: customer_name,
                customerEmail: customer_email,
                customerPhone: customer_phone,
                paymentGatewayEnv: terminal.payment_gateway_env || 'sandbox',
                requestData: formData,
                ...(network ? { network } : {}),
                notes: `Order #${orderId}, Session #${sessionId}`,
            });
            console.log('[PaymentInitiate] Transaction logged:', paymentAsiaTransaction.id);
        }
        catch (auditError) {
            console.warn('[PaymentInitiate] Failed to log transaction:', auditError instanceof Error ? auditError.message : auditError);
            // Don't fail the payment if audit logging fails
        }
        // Return form data for frontend to submit
        return res.json({
            success: true,
            message: 'Payment form generated successfully',
            paymentUrl, // Frontend will POST to this URL
            formData, // All form fields to submit (including sign)
            paymentRecordId: paymentRecord.id,
        });
    }
    catch (error) {
        console.error('[PaymentTransaction] Error initiating payment:', error);
        return res.status(500).json({
            error: error.message || 'Failed to initiate payment',
        });
    }
});
/**
 * POST /api/restaurants/:restaurantId/webhook/payment-asia
 * Webhook endpoint for Payment Asia payment notifications
 *
 * Payment Asia sends POST data to this endpoint after customer payment
 */
router.post('/restaurants/:restaurantId/webhook/payment-asia', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const payload = req.body;
        console.log('[PaymentAsia Webhook] Received notification for restaurant:', restaurantId);
        console.log('[PaymentAsia Webhook] Payload fields:', Object.keys(payload).join(', '));
        // Extract signature from payload
        const receivedSignature = payload.sign;
        if (!receivedSignature) {
            console.warn('[PaymentAsia Webhook] No signature in webhook');
            return res.status(400).json({ error: 'No signature in webhook' });
        }
        // Find payment record by merchant_reference (order ID)
        const merchantRef = payload.merchant_reference;
        if (!merchantRef) {
            console.warn('[PaymentAsia Webhook] No merchant_reference in webhook');
            return res.status(400).json({ error: 'No merchant_reference in webhook' });
        }
        const paymentRes = await db_1.default.query(`SELECT op.id, op.order_id, op.session_id FROM order_payments op
       WHERE op.chuio_order_reference = $1 AND op.restaurant_id = $2
       LIMIT 1`, [merchantRef, restaurantId]);
        if (paymentRes.rowCount === 0) {
            console.warn('[PaymentAsia Webhook] Payment record not found for:', merchantRef);
            return res.status(404).json({ error: 'Payment record not found' });
        }
        const payment = paymentRes.rows[0];
        // Get terminal to verify signature
        const terminalRes = await db_1.default.query(`SELECT secret_code FROM payment_terminals 
       WHERE restaurant_id = $1 AND vendor_name = 'payment-asia' AND is_active = true`, [restaurantId]);
        if (terminalRes.rowCount === 0) {
            console.error('[PaymentAsia Webhook] Terminal not found for signature verification');
            return res.status(400).json({ error: 'Terminal not found' });
        }
        const terminal = terminalRes.rows[0];
        // Verify signature
        const isSignatureValid = paymentAsiaService_1.paymentAsiaService.verifyWebhookSignature(payload, receivedSignature, terminal.secret_code);
        if (!isSignatureValid) {
            console.error('[PaymentAsia Webhook] Signature verification failed');
            return res.status(401).json({ error: 'Invalid signature' });
        }
        // Determine payment status from Payment Asia response
        const statusCode = typeof payload.status === 'string' ? parseInt(payload.status) : payload.status;
        const paymentStatus = paymentStatusMapper.getPaymentAsiaStatus(statusCode);
        const completedAt = paymentStatusMapper.isPaymentApproved(statusCode) ? new Date() : null;
        const failedAt = paymentStatusMapper.isPaymentFailed(statusCode) ? new Date() : null;
        const errorMessage = paymentStatusMapper.isPaymentFailed(statusCode) ? 'Payment rejected' : null;
        // Update payment record
        await db_1.default.query(`UPDATE order_payments 
       SET payment_status = $1, webhook_received_at = NOW(), 
           completed_at = $2, failed_at = $3, error_message = $4,
           response_data = $5,
           updated_at = NOW()
       WHERE id = $6`, [paymentStatus, completedAt, failedAt, errorMessage, JSON.stringify(payload), payment.id]);
        // Update transaction audit log with webhook response
        try {
            const transactionStatus = paymentStatusMapper.getTransactionStatus(String(statusCode));
            const transaction = await paymentAsiaTransactionRepository_1.default
                .getTransactionByMerchantReference(payload.merchant_reference);
            if (transaction) {
                const updateData = {
                    transactionId: payload.request_reference || payload.transaction_id,
                    status: transactionStatus,
                    paymentMethod: payload.payment_method,
                    responseData: payload,
                    signature: payload.sign,
                    ...(paymentStatusMapper.isPaymentFailed(statusCode) ? { errorMessage: 'Payment rejected by Payment Asia' } : {}),
                };
                if (paymentStatusMapper.isPaymentApproved(statusCode)) {
                    updateData.approvedAt = new Date();
                }
                if (paymentStatusMapper.isPaymentFailed(statusCode)) {
                    updateData.failedAt = new Date();
                }
                await paymentAsiaTransactionRepository_1.default.updateTransactionStatus(transaction.id, updateData);
                console.log('[PaymentWebhook] Transaction updated:', transaction.id);
            }
            else {
                // Create new transaction if not found (webhook arrived before payment form)
                const newTransaction = await paymentAsiaTransactionRepository_1.default.createTransaction({
                    restaurantId: parseInt(restaurantId),
                    merchantReference: payload.merchant_reference,
                    amountCents: Math.round(parseFloat(payload.amount) * 100),
                    currencyCode: payload.currency,
                    paymentGatewayEnv: 'sandbox',
                    requestData: {},
                    notes: 'Transaction created from webhook (payment form data not available)',
                });
                const updateData = {
                    transactionId: payload.request_reference || payload.transaction_id,
                    status: transactionStatus,
                    responseData: payload,
                    signature: payload.sign,
                };
                if (paymentStatusMapper.isPaymentApproved(statusCode)) {
                    updateData.approvedAt = new Date();
                }
                if (paymentStatusMapper.isPaymentFailed(statusCode)) {
                    updateData.failedAt = new Date();
                }
                await paymentAsiaTransactionRepository_1.default.updateTransactionStatus(newTransaction.id, updateData);
                console.log('[PaymentWebhook] New transaction created:', newTransaction.id);
            }
        }
        catch (auditError) {
            console.warn('[PaymentWebhook] Failed to update transaction:', auditError instanceof Error ? auditError.message : auditError);
            // Don't fail the webhook if audit logging fails
        }
        // If payment successful, mark order as completed and notify staff
        if (paymentStatus === 'completed') {
            console.log('[PaymentAsia Webhook] Payment completed for order:', payment.order_id);
            await db_1.default.query(`UPDATE orders
         SET status = 'completed', payment_method = 'payment-asia', chuio_order_reference = $1
         WHERE id = $2 AND restaurant_id = $3`, [merchantRef, payment.order_id, restaurantId]);
        }
        else if (paymentStatus === 'failed') {
            // Reset payment_method so the customer can retry from the menu
            console.log('[PaymentAsia Webhook] Payment failed — resetting order payment_method for retry:', payment.order_id);
            await db_1.default.query(`UPDATE orders SET payment_method = NULL, chuio_order_reference = NULL
         WHERE id = $1 AND restaurant_id = $2`, [payment.order_id, restaurantId]);
        }
        if (paymentStatus === 'completed') {
            // Write to unified chuio_payments ledger
            try {
                const paNetworkRes = await db_1.default.query(`SELECT network, amount_cents, session_id, payment_gateway_env FROM payment_asia_transactions
           WHERE merchant_reference = $1 LIMIT 1`, [merchantRef]);
                const paRec = paNetworkRes.rows[0];
                const _paNetLabels = { Alipay: 'Alipay', Wechat: 'WeChat Pay', CreditCard: 'Credit Card', Octopus: 'Octopus', Fps: 'FPS', CUP: 'UnionPay' };
                const paMeth = paRec?.network ? (_paNetLabels[paRec.network] || paRec.network) : 'Online';
                await db_1.default.query(`INSERT INTO chuio_payments
             (restaurant_id, order_id, session_id, payment_vendor, payment_method,
              payment_gateway_env, order_reference, vendor_reference,
              amount_cents, currency_code, total_cents, status, completed_at, extra_data)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'HKD',$9,'completed',NOW(),$10)
           ON CONFLICT DO NOTHING`, [
                    restaurantId, payment.order_id, paRec?.session_id || payment.session_id,
                    'payment-asia', paMeth,
                    paRec?.payment_gateway_env || 'sandbox',
                    merchantRef, payload.request_reference || null,
                    paRec?.amount_cents || Math.round(parseFloat(payload.amount || '0') * 100),
                    JSON.stringify({ request_reference: payload.request_reference, currency: payload.currency }),
                ]);
            }
            catch (ledgerErr) {
                console.warn('[PaymentWebhook] chuio_payments write failed:', ledgerErr instanceof Error ? ledgerErr.message : ledgerErr);
            }
            // Notify kitchen/staff via WebSocket
            try {
                websocket_1.webSocketServer.broadcastOrderStatusChange({
                    orderId: payment.order_id,
                    sessionId: payment.session_id,
                    restaurantId: parseInt(restaurantId),
                    oldStatus: 'pending',
                    newStatus: 'completed',
                    updatedAt: new Date().toISOString(),
                });
            }
            catch (wsErr) {
                console.warn('[PaymentWebhook] WebSocket notification failed:', wsErr);
            }
        }
        // Return success to Payment Asia
        res.json({ success: true, message: 'Webhook processed' });
    }
    catch (error) {
        console.error('[PaymentAsia Webhook] Error processing webhook:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET/POST /api/restaurants/:restaurantId/payment/return
 * Payment Asia callback return - handles customer redirect after payment
 * Payment Asia sends: status=X&request_reference=Y&merchant_reference=Z
 * Our params: order_id=X&payment_record_id=Y&merchant_reference=Z
 * Note: Payment Asia may redirect via POST (body) or GET (query); our custom params are always in the query string.
 */
async function handlePaymentReturn(req, res) {
    try {
        const { restaurantId } = req.params;
        // Our custom params are always in the query string (appended to return_url at initiation time)
        const { order_id, payment_record_id } = req.query;
        // PA's own params may arrive in query (GET redirect) or body (POST redirect)
        const paParams = { ...req.body, ...req.query };
        const { status, request_reference, merchant_reference } = paParams;
        // Cast query parameters to strings
        const statusStr = String(status || '');
        const orderId = String(order_id || '');
        const paymentId = String(payment_record_id || '');
        const merchantRef = String(req.query.merchant_reference || merchant_reference || request_reference || `payment-${paymentId}`);
        const requestRef = String(request_reference || '');
        console.log('[PaymentReturn] Received return callback (' + req.method + ')');
        console.log('  Restaurant:', restaurantId);
        console.log('  Order:', orderId);
        console.log('  Status:', statusStr);
        console.log('  Merchant Ref:', merchantRef);
        if (!orderId || !paymentId) {
            return res.status(400).json({ error: 'Missing order_id or payment_record_id' });
        }
        // Parse numeric status code from Payment Asia
        const statusCode = parseInt(statusStr) || 0;
        const paymentStatus = paymentStatusMapper.getReturnCallbackStatus(statusCode);
        console.log('[PaymentReturn] Payment status:', paymentStatus, 'Status code:', statusCode);
        // Update order_payments record
        await db_1.default.query(`UPDATE order_payments
       SET payment_status = $1::text,
           transaction_id = $2::text,
           response_data = jsonb_set(
             COALESCE(response_data, '{}'::jsonb),
             '{payment_return}',
             $3::jsonb
           ),
           updated_at = NOW(),
           completed_at = CASE WHEN $1::text = 'completed' THEN NOW() ELSE completed_at END,
           failed_at = CASE WHEN $1::text = 'failed' THEN NOW() ELSE failed_at END
       WHERE id = $4::int`, [
            paymentStatus,
            requestRef || merchantRef,
            JSON.stringify({ status: statusCode, timestamp: new Date().toISOString() }),
            paymentId,
        ]);
        // Update transaction audit log with return callback
        try {
            const transaction = await paymentAsiaTransactionRepository_1.default
                .getTransactionByMerchantReference(merchantRef);
            if (transaction) {
                const transactionStatus = paymentStatusMapper.getTransactionStatus(String(statusCode));
                const updateData = {
                    status: transactionStatus,
                    responseData: {
                        return_callback: { statusCode, timestamp: new Date().toISOString(), merchantRef },
                    },
                    ...(transactionStatus === 'failed' ? { errorMessage: `Return status code: ${statusCode}` } : {}),
                };
                if (requestRef)
                    updateData.transactionId = requestRef;
                if (transactionStatus === 'approved')
                    updateData.approvedAt = new Date();
                if (transactionStatus === 'failed')
                    updateData.failedAt = new Date();
                await paymentAsiaTransactionRepository_1.default.updateTransactionStatus(transaction.id, updateData);
            }
        }
        catch (auditError) {
            console.warn('[PaymentReturn] Failed to update transaction audit:', auditError instanceof Error ? auditError.message : auditError);
        }
        // If payment successful, update order (not table_sessions — those columns were dropped)
        if (paymentStatus === 'completed') {
            await db_1.default.query(`UPDATE orders
         SET status = 'completed', payment_method = 'payment-asia', chuio_order_reference = $1
         WHERE id = $2::int AND restaurant_id = $3::int`, [merchantRef, orderId, restaurantId]);
            console.log('[PaymentReturn] Order marked as paid:', orderId);
        }
        else if (paymentStatus === 'failed') {
            // Reset payment_method so the customer can retry with any payment method
            await db_1.default.query(`UPDATE orders
         SET payment_method = NULL, chuio_order_reference = NULL
         WHERE id = $1::int AND restaurant_id = $2::int`, [orderId, restaurantId]);
            console.log('[PaymentReturn] PA payment failed — order payment_method reset for retry:', orderId);
        }
        else if (paymentStatus === 'processing') {
            // PA returned the customer without a definitive result (status=4).
            // Reset payment_method so the customer can retry; the webhook will confirm if payment later succeeds.
            await db_1.default.query(`UPDATE orders
         SET payment_method = NULL, chuio_order_reference = NULL
         WHERE id = $1::int AND restaurant_id = $2::int`, [orderId, restaurantId]);
            console.log('[PaymentReturn] PA payment still processing — order payment_method reset for retry:', orderId);
        }
        // Write to unified chuio_payments ledger
        try {
            const paNetworkRes2 = await db_1.default.query(`SELECT network, amount_cents, session_id, payment_gateway_env FROM payment_asia_transactions
           WHERE merchant_reference = $1 LIMIT 1`, [merchantRef]);
            const paRec2 = paNetworkRes2.rows[0];
            const _paNetLabels2 = { Alipay: 'Alipay', Wechat: 'WeChat Pay', CreditCard: 'Credit Card', Octopus: 'Octopus', Fps: 'FPS', CUP: 'UnionPay' };
            const paMeth2 = paRec2?.network ? (_paNetLabels2[paRec2.network] || paRec2.network) : 'Online';
            const paAmt2 = paRec2?.amount_cents || 0;
            const paEnv2 = paRec2?.payment_gateway_env || 'sandbox';
            const paSess2 = paRec2?.session_id || null;
            await db_1.default.query(`INSERT INTO chuio_payments
             (restaurant_id, order_id, session_id, payment_vendor, payment_method,
              payment_gateway_env, order_reference, vendor_reference,
              amount_cents, currency_code, total_cents, status, completed_at, extra_data)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'HKD',$9,'completed',NOW(),$10)
           ON CONFLICT DO NOTHING`, [
                restaurantId, orderId, paSess2,
                'payment-asia', paMeth2, paEnv2,
                merchantRef, requestRef || null,
                paAmt2,
                JSON.stringify({ request_reference: requestRef }),
            ]);
        }
        catch (ledgerErr2) {
            console.warn('[PaymentReturn] chuio_payments write failed:', ledgerErr2 instanceof Error ? ledgerErr2.message : ledgerErr2);
        }
        // Redirect customer back to their menu session with payment result, or fallback to callback page
        const menuReturnUrl = String(req.query.menu_return_url || '');
        if (menuReturnUrl) {
            const sep = menuReturnUrl.includes('?') ? '&' : '?';
            const label = paymentStatus === 'completed' ? 'success' : paymentStatus === 'failed' ? 'failed' : 'pending';
            return res.redirect(`${menuReturnUrl}${sep}payment_status=${label}&ref=${encodeURIComponent(merchantRef)}`);
        }
        // Fallback: callback page (no menu URL provided)
        const baseUrl2 = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const redirectUrl = `${baseUrl2}/payment-callback?status=${statusCode}&merchant_reference=${encodeURIComponent(merchantRef)}`;
        return res.redirect(redirectUrl);
    }
    catch (error) {
        console.error('[PaymentReturn] Error processing return:', error);
        return res.status(500).json({ error: error.message });
    }
}
router.get('/restaurants/:restaurantId/payment/return', handlePaymentReturn);
router.post('/restaurants/:restaurantId/payment/return', handlePaymentReturn);
/**
 * GET /api/restaurants/:restaurantId/orders/:orderId/payment-status
 * Check the payment status of an order.
 * When our DB is still 'pending', queries Payment Asia directly for the authoritative status
 * and updates the DB + resets the order if PA says failed/succeeded.
 */
router.get('/restaurants/:restaurantId/orders/:orderId/payment-status', async (req, res) => {
    try {
        const { restaurantId, orderId } = req.params;
        const result = await db_1.default.query(`SELECT op.id, op.payment_status, op.transaction_id, op.error_message,
              op.completed_at, op.created_at, op.chuio_order_reference,
              pt.merchant_token, pt.secret_code, pt.payment_gateway_env
       FROM order_payments op
       JOIN restaurants r ON r.id = op.restaurant_id
       LEFT JOIN payment_terminals pt
         ON pt.id = r.active_payment_terminal_id AND pt.vendor_name = 'payment-asia'
       WHERE op.order_id = $1 AND op.restaurant_id = $2
       ORDER BY op.created_at DESC
       LIMIT 1`, [orderId, restaurantId]);
        if (result.rowCount === 0) {
            return res.json({ payment_status: 'not_initiated' });
        }
        const payment = result.rows[0];
        // If our DB says pending, go ask PA directly
        if (payment.payment_status === 'pending' && payment.chuio_order_reference && payment.merchant_token) {
            try {
                console.log('[PaymentStatus] DB pending — querying PA directly for:', payment.chuio_order_reference);
                paymentAsiaService_1.paymentAsiaService.initialize({
                    merchantToken: payment.merchant_token,
                    secretCode: payment.secret_code,
                    environment: payment.payment_gateway_env || 'sandbox',
                });
                const records = await paymentAsiaService_1.paymentAsiaService.queryPayment(payment.chuio_order_reference);
                // Find the sale record (type=1); ignore refund records
                const saleRecord = records.find((r) => String(r.type) === '1') || records[0];
                if (saleRecord) {
                    const paStatusCode = parseInt(String(saleRecord.status));
                    const resolvedStatus = paymentStatusMapper.getPaymentAsiaStatus(paStatusCode);
                    console.log('[PaymentStatus] PA query result: status code', paStatusCode, '→', resolvedStatus);
                    // Update our DB with the real status
                    await db_1.default.query(`UPDATE order_payments SET payment_status = $1,
               transaction_id = COALESCE($2, transaction_id),
               completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
               failed_at    = CASE WHEN $1 = 'failed'    THEN NOW() ELSE failed_at END,
               updated_at = NOW()
             WHERE id = $3`, [resolvedStatus, saleRecord.request_reference || null, payment.id]);
                    if (resolvedStatus === 'completed') {
                        await db_1.default.query(`UPDATE orders SET status = 'completed', payment_method = 'payment-asia'
               WHERE id = $1 AND restaurant_id = $2`, [orderId, restaurantId]);
                    }
                    else if (resolvedStatus === 'failed') {
                        await db_1.default.query(`UPDATE orders SET payment_method = NULL, chuio_order_reference = NULL
               WHERE id = $1 AND restaurant_id = $2 AND status != 'completed'`, [orderId, restaurantId]);
                    }
                    return res.json({
                        payment_status: resolvedStatus,
                        transaction_id: saleRecord.request_reference || null,
                        initiated_at: payment.created_at,
                        pa_status_code: paStatusCode,
                    });
                }
                else {
                    // PA has no record yet — still genuinely pending (very fresh payment)
                    console.log('[PaymentStatus] PA query returned no records for:', payment.chuio_order_reference);
                }
            }
            catch (paErr) {
                // PA query failed — fall through and return our DB status, don't crash
                console.warn('[PaymentStatus] PA direct query failed:', paErr.message);
            }
        }
        res.json({
            payment_status: payment.payment_status,
            transaction_id: payment.transaction_id,
            error_message: payment.error_message,
            completed_at: payment.completed_at,
            initiated_at: payment.created_at,
        });
    }
    catch (error) {
        console.error('[PaymentTransaction] Error getting payment status:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * POST /api/restaurants/:restaurantId/orders/:orderId/cancel-payment
 * Allow the customer to cancel a stuck pending PA payment and retry.
 * Only allowed if the order is not yet completed.
 */
router.post('/restaurants/:restaurantId/orders/:orderId/cancel-payment', async (req, res) => {
    try {
        const { restaurantId, orderId } = req.params;
        const orderRes = await db_1.default.query(`SELECT id, status, payment_method FROM orders WHERE id = $1 AND restaurant_id = $2`, [orderId, restaurantId]);
        if (orderRes.rowCount === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const order = orderRes.rows[0];
        if (order.status === 'completed') {
            return res.status(400).json({ error: 'Order is already completed and paid' });
        }
        if (order.payment_method !== 'payment-asia') {
            return res.status(400).json({ error: 'No pending Payment Asia transaction to cancel' });
        }
        // Reset order so customer can initiate a new payment
        await db_1.default.query(`UPDATE orders SET payment_method = NULL, chuio_order_reference = NULL WHERE id = $1 AND restaurant_id = $2`, [orderId, restaurantId]);
        // Mark any pending payment records as cancelled
        await db_1.default.query(`UPDATE order_payments SET payment_status = 'cancelled', error_message = 'Cancelled by customer',
       updated_at = NOW()
       WHERE order_id = $1 AND restaurant_id = $2 AND payment_status = 'pending'`, [orderId, restaurantId]);
        console.log('[CancelPayment] Customer cancelled pending PA payment for order:', orderId);
        res.json({ success: true });
    }
    catch (error) {
        console.error('[CancelPayment] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /payment-callback
 * Payment Asia return_url callback handler
 * Called when customer returns from Payment Asia hosted payment page
 * Payment Asia redirects here AFTER user chooses success/fail
 * Also stores payment result in webhook Map for test page polling to find
 */
/**
 * Map Payment Asia numeric status codes to human-readable strings
 * Payment Asia status codes: 1=success, 0=cancelled/failed, others=pending
 */
function normalizePaymentAsiaStatus(status) {
    const statusStr = String(status).toLowerCase().trim();
    // Map numeric codes
    if (statusStr === '1' || statusStr === 'success' || statusStr === 'approved')
        return 'success';
    if (statusStr === '0' || statusStr === 'failed' || statusStr === 'cancelled' || statusStr === 'rejected')
        return 'failed';
    if (statusStr === 'pending')
        return 'pending';
    // Default to failed for unknown codes
    return 'failed';
}
function closeTabHtml(status) {
    const icon = status === 'success' ? '✅' : status === 'pending' ? '⏳' : '❌';
    const label = status === 'success' ? 'Payment complete' : status === 'pending' ? 'Payment pending' : 'Payment failed';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payment</title><style>body{margin:0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0f4ff;text-align:center;}</style></head><body><div style="padding:40px;"><div style="font-size:56px;margin-bottom:16px;">${icon}</div><p style="font-size:16px;color:#444;">${label}</p><p style="font-size:12px;color:#888;margin-top:8px;">This tab will close automatically.</p></div><script>window.close();<\/script></body></html>`;
}
router.get('/payment-callback', (req, res) => {
    try {
        const rawStatus = req.query.status || 'unknown';
        const status = normalizePaymentAsiaStatus(rawStatus);
        const message = req.query.message || 'Transaction processed';
        const reference = req.query.reference || 'N/A';
        const returnTo = req.query.return_to;
        // Payment Asia may send these fields in the callback:
        // - merchant_reference: The order ID we submitted
        // - request_reference: Payment Asia's transaction ID
        // - amount, currency, etc.
        // Log all parameters to debug what Payment Asia actually sends
        console.log('[PaymentCallback] 🔄 Received from Payment Asia:');
        console.log('[PaymentCallback] Query params:', req.query);
        console.log('[PaymentCallback] Body params:', req.body);
        console.log('  Raw Status:', rawStatus, '→ Normalized:', status);
        console.log('  Message:', message);
        console.log('  Reference:', reference);
        console.log('  Return To:', returnTo || '(none)');
        // Try to extract merchant reference from parameters
        // Payment Asia might send it as: merchant_reference, merchantReference, or in other formats
        const merchantReference = (req.query.merchant_reference ||
            req.query.merchantReference ||
            req.query.order_id ||
            req.query.orderId ||
            req.query.reference);
        // If we have a merchant reference, store the payment result as webhook data
        // This way the test page's polling will find it
        if (merchantReference) {
            console.log('[PaymentCallback] 💾 Storing payment result for polling - Merchant Ref:', merchantReference);
            // Extract signature from Payment Asia query params (could be 'sign' or 'Sign')
            const signature = req.query.sign || req.query.Sign || '';
            testPaymentWebhooks.set(merchantReference, {
                merchant_reference: merchantReference,
                request_reference: reference || req.query.request_reference,
                currency: req.query.currency || 'HKD',
                amount: req.query.amount || 'unknown',
                status: status,
                sign: signature,
                received_at: new Date().toISOString(),
            });
            console.log('[PaymentCallback] ✅ Payment result stored - test page polling will pick it up');
        }
        else {
            console.log('[PaymentCallback] ⚠️  Could not extract merchant reference from Payment Asia response');
        }
        // Payment result already stored for webhook polling — close the tab.
        // The original test-page tab will receive the result via its polling loop.
        if (returnTo) {
            console.log('[PaymentCallback] 🔒 Serving close-tab page (return_to present, webhook data stored)');
            return res.send(closeTabHtml(status));
        }
        // No return_to — serve the result HTML (standalone use)
        return res.send(closeTabHtml(status));
    }
    catch (error) {
        console.error('[PaymentCallback] Error handling callback:', error);
        res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>❌ Error Processing Callback</h1>
          <p>${error.message || 'An unexpected error occurred'}</p>
          <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px;">Close</button>
        </body>
      </html>
    `);
    }
});
/**
 * POST /payment-callback
 * Same as GET but handles Payment Asia POST requests
 * Payment Asia may send callback data as POST instead of GET redirect
 * Also stores payment result for test page polling
 */
router.post('/payment-callback', (req, res) => {
    try {
        // Log everything Payment Asia sends
        console.log('[PaymentCallback POST] 🔄 Raw request received');
        console.log('  Query params:', JSON.stringify(req.query));
        console.log('  Body:', JSON.stringify(req.body));
        // Extract status from various possible sources
        let rawStatus;
        let message;
        let reference;
        let returnTo;
        // Try body first (form-encoded or JSON) - Payment Asia typically sends via POST body
        if (req.body && typeof req.body === 'object') {
            rawStatus = req.body?.status || req.body?.Status;
            message = req.body?.message || req.body?.Message;
            reference = req.body?.reference || req.body?.Reference || req.body?.request_reference;
            returnTo = req.body?.return_to || req.body?.return_url;
        }
        // Fall back to query string if body doesn't have data
        if (!rawStatus && req.query && typeof req.query.status === 'string') {
            rawStatus = req.query.status;
            message = req.query.message;
            reference = req.query.reference;
            returnTo = req.query.return_to;
        }
        // Default values and normalize status
        rawStatus = rawStatus || 'unknown';
        const status = normalizePaymentAsiaStatus(rawStatus);
        message = message || 'Transaction processed';
        reference = reference || 'N/A';
        console.log('[PaymentCallback POST] ✅ Extracted values:');
        console.log('  Raw Status:', rawStatus, '→ Normalized:', status);
        console.log('  Message:', message);
        console.log('  Reference:', reference);
        console.log('  Return To:', returnTo || '(none)');
        // Try to extract merchant reference from POST parameters
        const merchantReference = (req.body?.merchant_reference ||
            req.body?.merchantReference ||
            req.query?.merchant_reference ||
            req.query?.merchantReference ||
            req.body?.order_id ||
            req.query?.order_id ||
            reference);
        // If we have a merchant reference, store the payment result as webhook data
        if (merchantReference) {
            console.log('[PaymentCallback POST] 💾 Storing payment result for polling - Merchant Ref:', merchantReference);
            // Extract signature from Payment Asia (could be 'sign' or 'Sign')
            const signature = req.body?.sign || req.body?.Sign || req.query?.sign || req.query?.Sign || '';
            testPaymentWebhooks.set(merchantReference, {
                merchant_reference: merchantReference,
                request_reference: reference || (req.body?.request_reference || req.query?.request_reference),
                currency: (req.body?.currency || req.query?.currency) || 'HKD',
                amount: (req.body?.amount || req.query?.amount) || 'unknown',
                status: status,
                sign: signature,
                received_at: new Date().toISOString(),
            });
            console.log('[PaymentCallback POST] ✅ Payment result stored - test page polling will pick it up');
        }
        // return_to is always set as a query param in the URL (our service appends it); check query string too
        if (!returnTo)
            returnTo = req.query.return_to;
        // Serve close-tab page — webhook data already stored, original tab will poll for it
        console.log('[PaymentCallback POST] 🔒 Serving close-tab page, status:', status);
        return res.send(closeTabHtml(status));
    }
    catch (error) {
        console.error('[PaymentCallback POST] ❌ Error handling callback:', error);
        console.error('  Stack:', error.stack);
        return res.status(500).json({
            error: error.message || 'An unexpected error occurred',
            success: false
        });
    }
});
/**
 * POST /webhook/payment-asia-test
 * Webhook endpoint for test payment notifications from Payment Asia
 * Payment Asia sends POST data here (notify_url) with payment results
 *
 * Receives: merchant_reference, request_reference, currency, amount, status, sign
 * Note: Payment Asia sends this as form-encoded POST data, not JSON
 */
router.post('/webhook/payment-asia-test', (req, res) => {
    try {
        // Log ALL received data (both body and query)
        console.log('[PaymentWebhookTest] 🔔 Received webhook notification from Payment Asia');
        console.log('[PaymentWebhookTest] 📮 Full Request Body:', JSON.stringify(req.body));
        console.log('[PaymentWebhookTest] 📮 Query Parameters:', JSON.stringify(req.query));
        console.log('[PaymentWebhookTest] 📮 Content-Type:', req.get('content-type'));
        // Extract from body first (preferred), fallback to query
        const merchantReference = req.body?.merchant_reference || req.query?.merchant_reference || 'unknown';
        const status = req.body?.status || req.query?.status || 'unknown';
        const requestReference = req.body?.request_reference || req.query?.request_reference;
        const currency = req.body?.currency || req.query?.currency;
        const amount = req.body?.amount || req.query?.amount;
        const sign = req.body?.sign || req.query?.sign;
        console.log('[PaymentWebhookTest] ✅ Extracted webhook fields:');
        console.log('  Merchant Reference:', merchantReference);
        console.log('  Status:', status);
        console.log('  Request Reference:', requestReference);
        console.log('  Currency:', currency);
        console.log('  Amount:', amount);
        console.log('  Signature:', sign ? sign.substring(0, 30) + '...' : '(none)');
        // Store webhook data for test page to retrieve
        testPaymentWebhooks.set(String(merchantReference), {
            merchant_reference: String(merchantReference),
            request_reference: requestReference ? String(requestReference) : undefined,
            currency: currency ? String(currency) : undefined,
            amount: amount ? String(amount) : undefined,
            status: String(status),
            sign: sign ? String(sign) : undefined,
            received_at: new Date().toISOString(),
        });
        console.log('[PaymentWebhookTest] ✅ Webhook data stored and ready for polling');
        // Return success to Payment Asia (required for webhook acknowledgment)
        res.json({
            success: true,
            message: 'Test payment notification received successfully',
            merchant_reference: merchantReference
        });
    }
    catch (error) {
        console.error('[PaymentWebhookTest] ❌ Error processing webhook:', error);
        console.error('[PaymentWebhookTest] Stack trace:', error.stack);
        res.status(500).json({
            error: error.message || 'Webhook processing failed',
            success: false
        });
    }
});
/**
 * GET /api/webhook/payment-test-status/:merchantReference
 * Endpoint for test page to poll and get payment status
 * Test page calls this repeatedly until it gets a status
 */
router.get('/webhook/payment-test-status/:merchantReference', (req, res) => {
    try {
        const merchantReference = req.params.merchantReference;
        console.log('[PaymentTestStatus] 📍 Status check for:', merchantReference);
        // Check if we have webhook data for this merchant reference
        const webhookData = testPaymentWebhooks.get(merchantReference);
        if (webhookData) {
            console.log('[PaymentTestStatus] ✅ Found webhook data:', webhookData.status);
            // Return the data and optionally remove it (or keep for a few minutes)
            return res.json({
                found: true,
                status: webhookData.status,
                data: webhookData,
            });
        }
        // Still waiting for webhook
        console.log('[PaymentTestStatus] ⏳ No webhook data yet');
        res.json({
            found: false,
            status: 'pending',
            message: 'Waiting for Payment Asia notification...',
        });
    }
    catch (error) {
        console.error('[PaymentTestStatus] Error:', error);
        res.status(500).json({
            error: error.message || 'Status check failed',
            found: false
        });
    }
});
/**
 * POST /webhook/payment-test-trigger/:merchantReference
 * DEVELOPMENT ONLY: Manually trigger a test webhook for testing purposes
 * In production, Payment Asia would POST to /webhook/payment-asia-test
 * This endpoint simulates that webhook for testing when Payment Asia sandbox doesn't send real webhooks
 *
 * Body (optional):
 * {
 *   "status": "success" | "pending" | "failed",
 *   "request_reference": "PA123456789"
 * }
 */
router.post('/webhook/payment-test-trigger/:merchantReference', (req, res) => {
    try {
        const merchantReference = req.params.merchantReference;
        const { status = 'success', request_reference = `PA-${Date.now()}` } = req.body;
        console.log('[PaymentWebhookTrigger] 🧪 Manual webhook trigger for:', merchantReference);
        console.log('[PaymentWebhookTrigger] Status:', status);
        // Store webhook data for test page to retrieve
        testPaymentWebhooks.set(merchantReference, {
            merchant_reference: merchantReference,
            request_reference: request_reference,
            currency: 'HKD',
            amount: '504.00',
            status: status,
            sign: 'test-trigger-signature',
            received_at: new Date().toISOString(),
        });
        console.log('[PaymentWebhookTrigger] ✅ Test webhook stored - test page will receive it on next poll');
        res.json({
            success: true,
            message: 'Test webhook triggered successfully',
            merchant_reference: merchantReference,
            status: status,
            note: 'This is a development endpoint for testing. In production, Payment Asia sends webhooks to /webhook/payment-asia-test'
        });
    }
    catch (error) {
        console.error('[PaymentWebhookTrigger] Error:', error);
        res.status(500).json({
            error: error.message || 'Webhook trigger failed',
            success: false
        });
    }
});
// ─── Payment Asia Management APIs ─────────────────────────────────────────────
// These require an active/initialized terminal config, resolved by restaurantId.
async function initPaymentAsiaForRestaurant(restaurantId, terminalId) {
    let resolvedTerminalId = terminalId;
    if (!resolvedTerminalId) {
        // Fall back to the restaurant's active terminal
        const restaurantRes = await db_1.default.query(`SELECT active_payment_terminal_id FROM restaurants WHERE id = $1`, [restaurantId]);
        if (restaurantRes.rowCount === 0) {
            throw Object.assign(new Error('Restaurant not found'), { status: 404 });
        }
        resolvedTerminalId = restaurantRes.rows[0].active_payment_terminal_id;
        if (!resolvedTerminalId) {
            throw Object.assign(new Error('Payment Asia terminal not configured for this restaurant'), { status: 400 });
        }
    }
    const terminalRes = await db_1.default.query(`SELECT merchant_token, secret_code, payment_gateway_env FROM payment_terminals
     WHERE id = $1 AND restaurant_id = $2 AND vendor_name = 'payment-asia'`, [resolvedTerminalId, restaurantId]);
    if (terminalRes.rowCount === 0) {
        throw Object.assign(new Error('Payment Asia terminal not configured for this restaurant'), { status: 400 });
    }
    const { merchant_token, secret_code, payment_gateway_env } = terminalRes.rows[0];
    paymentAsiaService_1.paymentAsiaService.initialize({
        merchantToken: merchant_token,
        secretCode: secret_code,
        environment: payment_gateway_env || 'sandbox',
    });
}
/**
 * POST /api/restaurants/:restaurantId/payment-asia/query
 * Query transaction records for a given merchant_reference.
 * Body: { merchant_reference: string }
 */
router.post('/restaurants/:restaurantId/payment-asia/query', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { merchant_reference, terminal_id } = req.body;
        if (!merchant_reference)
            return res.status(400).json({ error: 'merchant_reference is required' });
        await initPaymentAsiaForRestaurant(restaurantId, terminal_id);
        const records = await paymentAsiaService_1.paymentAsiaService.queryPayment(merchant_reference);
        return res.json({ success: true, records });
    }
    catch (err) {
        console.error('[PaymentQuery] Error:', err);
        // Management API errors (e.g. sandbox token not recognised by gateway) are not fatal —
        // return empty records with an explanation so the frontend can degrade gracefully.
        return res.json({ success: true, records: [], apiError: err.message });
    }
});
/**
 * POST /api/restaurants/:restaurantId/payment-asia/refund
 * Initiate a refund for a completed sale.
 * Body: { merchant_reference: string, amount: number (dollars, e.g. 100.00) }
 * Returns refund_reference — poll /refund-query to confirm.
 */
router.post('/restaurants/:restaurantId/payment-asia/refund', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { merchant_reference, amount, terminal_id } = req.body;
        if (!merchant_reference || amount == null) {
            return res.status(400).json({ error: 'merchant_reference and amount are required' });
        }
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            return res.status(400).json({ error: 'amount must be a positive number' });
        }
        await initPaymentAsiaForRestaurant(restaurantId, terminal_id);
        const result = await paymentAsiaService_1.paymentAsiaService.requestRefund(merchant_reference, amountNum);
        // PA success codes: '200' (production JSON) or '20000' (sandbox/form-encoded)
        const paCode = String(result?.response?.code ?? '');
        const paSuccess = !paCode || paCode === '200' || paCode === '20000';
        if (!paSuccess) {
            let errMsg = `Payment Asia error ${paCode}: ${result?.response?.message || 'Unknown error'}`;
            if (paCode === '40010') {
                errMsg += ' (Sandbox limitation: test payments are not settled to merchant balance \u2014 refunds require a live PA account.)';
            }
            return res.status(200).json({ success: false, error: errMsg, raw: result });
        }
        return res.json({ success: true, ...result });
    }
    catch (err) {
        console.error('[PaymentRefund] Error:', err);
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
});
/**
 * POST /api/restaurants/:restaurantId/payment-asia/refund-query
 * Check status of a previously initiated refund.
 * Body: { refund_reference: string }
 */
router.post('/restaurants/:restaurantId/payment-asia/refund-query', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { refund_reference, terminal_id } = req.body;
        if (!refund_reference)
            return res.status(400).json({ error: 'refund_reference is required' });
        await initPaymentAsiaForRestaurant(restaurantId, terminal_id);
        const result = await paymentAsiaService_1.paymentAsiaService.queryRefund(refund_reference);
        // PA success codes: '200' (production JSON) or '20000' (sandbox/form-encoded)
        const paCode = String(result?.response?.code ?? '');
        const paSuccess = !paCode || paCode === '200' || paCode === '20000';
        if (!paSuccess) {
            return res.status(200).json({ success: false, error: `Payment Asia error ${paCode}: ${result?.response?.message || 'Unknown error'}`, raw: result });
        }
        return res.json({ success: true, ...result });
    }
    catch (err) {
        console.error('[RefundQuery] Error:', err);
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=payment-transactions.routes.js.map