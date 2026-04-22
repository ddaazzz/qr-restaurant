"use strict";
/**
 * Payment Gateway Routes
 * Consolidated payment processing for KPay and Payment Asia
 * Runs on backend Express server (port 10000) - no separate payment-test-server needed
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
// ════════════════════════════════════════════════════════════════
// CONSTANTS & TEST CREDENTIALS
// ════════════════════════════════════════════════════════════════
const PAYMENT_ASIA_MERCHANT_TOKEN = 'ae476881-7bfc-4da8-bc7d-8203ad0fb28c';
const PAYMENT_ASIA_SECRET = '127f7830-b856-4ddf-92b4-a6478e38547b';
// KPay test RSA keys (for signing)
const KPAY_APP_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA2a2rwplBCXizlHV5JCrrAknstR5Ow0+BqZpDtKJGLTiJj7o7
6qMyPr3wF3JNFmJVKW/cGbCCcQFNZ1R8PB2dN5DZL4J7pxKnQ9V9qX1B+CQvF9HJ
... [truncated for brevity - use real keys in production]
-----END RSA PRIVATE KEY-----`;
const KPAY_PLATFORM_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA6a+fJKJl8q/wFCgjb1MV
... [truncated for brevity]
-----END PUBLIC KEY-----`;
// ════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════
/**
 * Encode value for signature calculation (RFC 3986, matching PHP http_build_query)
 */
function encodeForSignature(value) {
    return encodeURIComponent(value)
        .replace(/!/g, '%21')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/\*/g, '%2A')
        .replace(/%20/g, '+');
}
/**
 * Generate Payment Asia SHA512 signature
 */
function createPaymentAsiaSignature(fields, secretCode) {
    try {
        if (!secretCode) {
            console.warn('⚠️ No secret code provided');
            return '[signature-no-secret]';
        }
        const sortedKeys = [
            'amount',
            'currency',
            'customer_address',
            'customer_country',
            'customer_email',
            'customer_first_name',
            'customer_ip',
            'customer_last_name',
            'customer_phone',
            'customer_state',
            'merchant_reference',
            'network',
            'notify_url',
            'return_url',
            'subject'
        ];
        const fieldStrings = {};
        for (const key of sortedKeys) {
            if (fields[key] !== undefined && fields[key] !== null) {
                fieldStrings[key] = String(fields[key]);
            }
        }
        const pairs = [];
        for (const key of sortedKeys) {
            if (fieldStrings[key] !== undefined) {
                const value = fieldStrings[key];
                const encodedKey = encodeForSignature(key);
                const encodedValue = encodeForSignature(value);
                pairs.push(encodedKey + '=' + encodedValue);
            }
        }
        const queryString = pairs.join('&');
        const signatureInput = queryString + secretCode;
        const signature = crypto_1.default
            .createHash('sha512')
            .update(signatureInput)
            .digest('hex');
        return signature;
    }
    catch (error) {
        console.error('❌ Signature generation error:', error);
        return '[signature-error]';
    }
}
/**
 * Generate timestamp for KPay request
 */
function getTimestamp() {
    return Date.now().toString();
}
/**
 * Generate nonce for KPay request
 */
function generateNonce() {
    return Math.random().toString(36).substring(2, 34).padEnd(32, '0');
}
// ════════════════════════════════════════════════════════════════
// PAYMENT ASIA ROUTES
// ════════════════════════════════════════════════════════════════
/**
 * GET /payment
 * Serves Payment Asia hosted payment page with injected form data
 */
router.get('/payment', (req, res) => {
    try {
        const queryParams = req.query;
        const htmlPath = path_1.default.join(__dirname, '../../public/paymentasia.html');
        let html = fs_1.default.readFileSync(htmlPath, 'utf8');
        const merchantToken = queryParams.merchant_token?.toString() || PAYMENT_ASIA_MERCHANT_TOKEN;
        const secretCode = queryParams.secret_code?.toString() || PAYMENT_ASIA_SECRET;
        // Build form data with all fields for signature (per official Payment Asia spec)
        const formData = {
            merchant_reference: queryParams.merchant_reference?.toString() || 'ORD-TEST-001',
            currency: queryParams.currency?.toString() || 'HKD',
            amount: queryParams.amount?.toString() || '100.00',
            customer_first_name: queryParams.customer_first_name?.toString() || 'Test',
            customer_last_name: queryParams.customer_last_name?.toString() || 'User',
            customer_email: queryParams.customer_email?.toString() || 'test@example.com',
            customer_phone: queryParams.customer_phone?.toString() || '+1234567890',
            customer_address: queryParams.customer_address?.toString() || '123 Test Street',
            customer_state: queryParams.customer_state?.toString() || 'HK',
            customer_country: queryParams.customer_country?.toString() || 'HK',
            customer_ip: queryParams.customer_ip?.toString() || '127.0.0.1',
            return_url: queryParams.return_url?.toString() || 'http://localhost:10000/payment-callback',
            subject: queryParams.subject?.toString() || 'Order Payment',
            network: queryParams.network?.toString() || 'CreditCard',
            notify_url: queryParams.notify_url?.toString() || 'http://localhost:10000/webhook/payment-asia',
        };
        // Generate signature
        formData.sign = createPaymentAsiaSignature(formData, secretCode);
        formData.merchant_token = merchantToken;
        // Inject form data into HTML
        const injectionLine = `window.formDataFromServer = ${JSON.stringify(formData)};`;
        html = html.replace('window.formDataFromServer = {};', injectionLine);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }
    catch (err) {
        console.error('❌ Error serving payment page:', err);
        res.status(500).json({ error: err.message });
    }
});
/**
 * POST /webhook/payment-asia
 * Receive payment result from Payment Asia gateway
 */
router.post('/webhook/payment-asia', (req, res) => {
    try {
        const paymentResult = req.body;
        console.log('\n' + '═'.repeat(80));
        console.log('📥 PAYMENT ASIA WEBHOOK - Server-to-Server Response');
        console.log('═'.repeat(80));
        console.log('📋 Full Response:');
        console.log(JSON.stringify(paymentResult, null, 2));
        console.log('═'.repeat(80) + '\n');
        res.json({ status: 'received' });
    }
    catch (err) {
        console.error('❌ Error parsing webhook:', err);
        res.status(400).json({ error: err.message });
    }
});
/**
 * GET /payment-callback
 * Log Payment Asia browser redirect response
 * Payment Asia redirects browser here after payment
 */
router.get('/payment-callback', (req, res) => {
    try {
        const params = req.query;
        console.log('\n' + '═'.repeat(80));
        console.log('🌐 PAYMENT ASIA BROWSER REDIRECT - Payment Asia Response via return_url');
        console.log('═'.repeat(80));
        console.log('📍 Return URL Parameters from Payment Asia:');
        // Log all query parameters from Payment Asia
        Object.entries(params).forEach(([key, value]) => {
            console.log(`  [${key}] = ${value}`);
        });
        // Parse common Payment Asia response fields
        const paymentStatus = params.status;
        const errorCode = params.error_code;
        const errorMessage = params.error_message;
        const merchantRef = params.merchant_reference;
        const paymentRef = params.payment_reference;
        const amount = params.amount;
        const currency = params.currency;
        console.log('\n📊 Parsed Response:');
        console.log(`  Status: ${paymentStatus || 'N/A'}`);
        console.log(`  Error Code: ${errorCode || 'N/A'}`);
        console.log(`  Error Message: ${errorMessage || 'N/A'}`);
        console.log(`  Merchant Reference: ${merchantRef || 'N/A'}`);
        console.log(`  Payment Reference: ${paymentRef || 'N/A'}`);
        console.log(`  Amount: ${amount || 'N/A'}`);
        console.log(`  Currency: ${currency || 'N/A'}`);
        console.log('═'.repeat(80) + '\n');
        // Redirect to frontend payment-test page with parameters
        // Payment Asia already includes parameters in the redirect, pass them through
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (typeof value === 'string') {
                searchParams.append(key, value);
            }
            else if (Array.isArray(value)) {
                value.forEach(v => searchParams.append(key, String(v)));
            }
            else if (value !== undefined && value !== null) {
                searchParams.append(key, String(value));
            }
        });
        const redirectUrl = `http://localhost:10000/payment-test.html?${searchParams.toString()}`;
        res.redirect(redirectUrl);
    }
    catch (err) {
        console.error('❌ Error processing payment callback:', err);
        res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/log-payment
 * Log payment submission before sending to Payment Asia
 */
router.post('/api/log-payment', (req, res) => {
    try {
        const logData = req.body;
        console.log('\n\n');
        console.log('╔' + '═'.repeat(78) + '╗');
        console.log('║' + ' '.repeat(20) + '📤 PAYMENT SUBMISSION DETAILS' + ' '.repeat(30) + '║');
        console.log('╚' + '═'.repeat(78) + '╝');
        console.log('\n[FIELDS BEING SENT TO PAYMENT ASIA]\n');
        Object.entries(logData).forEach(([key, value]) => {
            const val = String(value || '');
            if (key === 'sign') {
                console.log(`  ✓ ${key.padEnd(22)} = ${val.substring(0, 60)}...`);
            }
            else {
                console.log(`  ✓ ${key.padEnd(22)} = "${val}"`);
            }
        });
        console.log('\n[SUMMARY]\n');
        console.log(`  Total Fields: ${Object.keys(logData).length}`);
        console.log(`  Has Signature: ${logData.sign ? 'YES ✓' : 'NO ✗'}`);
        const emptyFields = Object.entries(logData)
            .filter(([_, v]) => !v || v === '')
            .map(([k]) => k);
        if (emptyFields.length > 0) {
            console.log(`  ⚠️  Empty Fields: ${emptyFields.join(', ')}`);
        }
        else {
            console.log(`  All Fields: POPULATED ✓`);
        }
        console.log('\n' + '╔' + '═'.repeat(78) + '╗');
        console.log('║' + '  ✓ Ready to submit to Payment Asia Sandbox'.padEnd(79) + '║');
        console.log('╚' + '═'.repeat(78) + '╝\n');
        res.json({ status: 'logged', fields: Object.keys(logData).length });
    }
    catch (err) {
        console.error('❌ Error parsing payment log:', err.message);
        res.status(400).json({ error: err.message });
    }
});
// ════════════════════════════════════════════════════════════════
// KPAY ROUTES
// ════════════════════════════════════════════════════════════════
/**
 * POST /v2/pos/sign
 * KPay key exchange - returns platform public key for app to sign requests
 */
router.post('/v2/pos/sign', (req, res) => {
    try {
        const { appId, appSecret, timestamp, nonceStr } = req.body;
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║           KPAY SIGN REQUEST (Key Exchange)                   ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        console.log('📤 App ID:', appId);
        console.log('📤 Timestamp:', timestamp);
        console.log('📤 Nonce:', nonceStr);
        // In real scenario, validate appId and appSecret
        // For testing, just return the public key
        const response = {
            sign: KPAY_PLATFORM_PUBLIC_KEY.substring(0, 100) + '...',
            code: '0',
            msg: 'success'
        };
        console.log('📥 Returning platform public key for signing\n');
        res.json(response);
    }
    catch (err) {
        console.error('❌ Sign request failed:', err);
        res.status(400).json({ error: err.message });
    }
});
/**
 * POST /v2/pos/sales
 * KPay payment transaction
 */
router.post('/v2/pos/sales', (req, res) => {
    try {
        const { appId, merchantReference, amount, currency, sign } = req.body;
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║           KPAY SALE REQUEST (Process Payment)                ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        console.log('📤 Merchant Reference:', merchantReference);
        console.log('📤 Amount:', (amount / 100).toFixed(2), currency);
        console.log('📤 Signature (first 40 chars):', sign ? sign.substring(0, 40) + '...' : 'N/A');
        // Simulate processing
        const transactionId = 'TXN-' + Date.now();
        const response = {
            transactionId: transactionId,
            code: '0',
            msg: 'Transaction successful',
            status: '1'
        };
        console.log('📥 Transaction ID:', transactionId);
        console.log('✅ Payment processed\n');
        res.json(response);
    }
    catch (err) {
        console.error('❌ Sale request failed:', err);
        res.status(400).json({ error: err.message });
    }
});
/**
 * GET /v2/pos/query
 * Query KPay transaction status
 */
router.get('/v2/pos/query', (req, res) => {
    try {
        const { merchantReference } = req.query;
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║           KPAY QUERY REQUEST (Transaction Status)            ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        console.log('📤 Merchant Reference:', merchantReference);
        const response = {
            status: '1',
            code: '0',
            msg: 'Query successful',
            merchantReference: merchantReference,
            settled: true
        };
        console.log('✅ Query completed\n');
        res.json(response);
    }
    catch (err) {
        console.error('❌ Query failed:', err);
        res.status(400).json({ error: err.message });
    }
});
/**
 * POST /v2/pos/sales/cancel
 * KPay void/cancel unsettled transaction
 */
router.post('/v2/pos/sales/cancel', (req, res) => {
    try {
        const { transactionId } = req.body;
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║           KPAY CANCEL REQUEST (Void Transaction)             ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        console.log('📤 Transaction ID:', transactionId);
        const response = {
            code: '0',
            msg: 'Transaction cancelled',
            status: 'cancelled'
        };
        console.log('✅ Transaction cancelled\n');
        res.json(response);
    }
    catch (err) {
        console.error('❌ Cancel failed:', err);
        res.status(400).json({ error: err.message });
    }
});
/**
 * POST /v2/pos/sales/refund
 * KPay refund settled transaction
 */
router.post('/v2/pos/sales/refund', (req, res) => {
    try {
        const { transactionId, refundAmount } = req.body;
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║           KPAY REFUND REQUEST (Refund Payment)               ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        console.log('📤 Transaction ID:', transactionId);
        console.log('📤 Refund Amount:', (refundAmount / 100).toFixed(2));
        const response = {
            code: '0',
            msg: 'Refund processed',
            status: 'refunded',
            refundAmount: refundAmount
        };
        console.log('✅ Refund processed\n');
        res.json(response);
    }
    catch (err) {
        console.error('❌ Refund failed:', err);
        res.status(400).json({ error: err.message });
    }
});
/**
 * POST /v2/pos/sales/close
 * KPay close/abort in-progress transaction
 */
router.post('/v2/pos/sales/close', (req, res) => {
    try {
        const { transactionId } = req.body;
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║           KPAY CLOSE REQUEST (Abort Transaction)             ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        console.log('📤 Transaction ID:', transactionId);
        const response = {
            code: '0',
            msg: 'Transaction closed',
            status: 'closed'
        };
        console.log('✅ Transaction closed\n');
        res.json(response);
    }
    catch (err) {
        console.error('❌ Close failed:', err);
        res.status(400).json({ error: err.message });
    }
});
/**
 * GET /api/test-credentials
 * Return test credentials for both payment systems
 */
router.get('/api/test-credentials', (req, res) => {
    res.json({
        paymentAsia: {
            merchantToken: PAYMENT_ASIA_MERCHANT_TOKEN,
            secretCode: PAYMENT_ASIA_SECRET,
            paymentUrl: 'http://localhost:10000/payment',
            webhookUrl: 'http://localhost:10000/webhook/payment-asia'
        },
        kpay: {
            appId: '202603231204002',
            appSecret: 'kpay_test_secret_123',
            signUrl: 'http://localhost:10000/v2/pos/sign',
        }
    });
});
exports.default = router;
//# sourceMappingURL=payment-gateway.routes.js.map