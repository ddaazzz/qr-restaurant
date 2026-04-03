/**
 * Payment Asia Service
 * Handles integration with Payment Asia payment gateway (Form-based)
 * 
 * Payment Asia API Integration:
 * - Base URL (Sandbox): https://payment-sandbox.pa-sys.com/app/page/[Merchant Token]
 * - Base URL (Production): https://payment.pa-sys.com/app/page/[Merchant Token]
 * - Authentication: Merchant Token (ID) + Secret Code
 * - Signature: SHA512 (http_build_query + secret)
 * - Submit: HTML Form POST (not REST API)
 * 
 * This service manages:
 * 1. Payment form data generation with proper fields
 * 2. Request signing with SHA512 (form-style, not JSON)
 * 3. Webhook callback signature verification
 * 4. Payment status updates from redirects
 */

import * as crypto from 'crypto';
import { URLSearchParams } from 'url';
import axios from 'axios';

export interface PaymentAsiaConfig {
  merchantToken: string;
  secretCode: string;
  environment: 'sandbox' | 'production';
}

export interface PaymentAsiaFormData {
  merchant_reference: string;        // Order ID
  currency: string;                   // e.g., 'SGD', 'USD', 'HKD'
  amount: string;                     // e.g., '100.00' (format: xx.xx)
  customer_ip: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_address: string;
  customer_postal_code: string;       // ZIP/Postal code (REQUIRED by Payment Asia)
  customer_phone: string;
  customer_email: string;
  customer_state: string;             // State/Province
  customer_country: string;           // 2-letter country code
  return_url: string;                 // Where to redirect after payment
  notify_url?: string;                // Webhook URL for Payment Asia to POST transaction data
  network?: string;                   // Payment network (e.g., 'Alipay', 'CreditCard')
  subject: string;                    // Order description/subject
  sign?: string;                      // SHA512 signature
}

// Webhook data types moved to paymentAsiaTransactionTypes.ts for unified transaction tracking

export interface PaymentAsiaTestResponse {
  success: boolean;
  message: string;
  error?: string;
  paymentUrl?: string;
  formData?: PaymentAsiaFormData;  // Form fields for actual payment submission
}

/**
 * PaymentAsiaService
 * Handles form-based payment requests and webhook verification for Payment Asia
 */
class PaymentAsiaService {
  private config: PaymentAsiaConfig | null = null;

  /**
   * Initialize the service with Payment Asia configuration
   */
  initialize(config: PaymentAsiaConfig): void {
    this.config = config;
    console.log('[PaymentAsia] Service initialized for:', {
      environment: config.environment,
      merchantToken: config.merchantToken?.substring(0, 8) + '...',
    });
  }

  /**
   * Get the payment form submission URL based on environment
   */
  getPaymentFormUrl(network?: string): string {
    if (!this.config) {
      throw new Error('Payment Asia service not initialized');
    }

    const baseHost = this.config.environment === 'sandbox'
      ? 'https://payment-sandbox.pa-sys.com'
      : 'https://payment.pa-sys.com';

    const path = network === 'UserDefine'
      ? `/app/page/generic/${this.config.merchantToken}`
      : `/app/page/${this.config.merchantToken}`;

    return `${baseHost}${path}`;
  }

  /**
   * Create SHA512 signature using Payment Asia format
   * Signature = SHA512(http_build_query($fields) . $secret)
   * Format matches PHP: alphabetical order, + for spaces, standard URL encoding
   * @param fields - Form fields object
   * @param secretCode - Secret Code
   * @returns SHA512 hex signature
   */
  private createSignature(fields: Record<string, string>, secretCode: string): string {
    try {
      // Use EXACT same field order as Payment Asia expects
      // CRITICAL: Field order must match Payment Asia's requirements for signature validation
      // Currency MUST come immediately after amount (not at the end!)
      const sortedKeys = [
        'amount',
        'currency',  // FIXED: Moved to position 2 (right after amount)
        'customer_address',
        'customer_country',
        'customer_email',
        'customer_first_name',
        'customer_ip',
        'customer_last_name',
        'customer_phone',
        'customer_postal_code',
        'customer_state',
        'merchant_reference',
        'network',
        'notify_url',
        'return_url', 
        'subject'
      ];

      // Build field strings in exact order
      const fieldStrings: Record<string, string> = {};
      for (const key of sortedKeys) {
        if (fields[key] !== undefined && fields[key] !== null) {
          fieldStrings[key] = String(fields[key]);
        }
      }

      // Create query string with fields in proper order
      const pairs: string[] = [];
      for (const key of sortedKeys) {
        if (fieldStrings[key] !== undefined) {
          const encodedKey = this.encodeForSignature(key);
          const encodedValue = this.encodeForSignature(fieldStrings[key]);
          pairs.push(`${encodedKey}=${encodedValue}`);
        }
      }
      const queryString = pairs.join('&');
      
      // Append secret code directly (no = or separator)
      const signatureInput: string = queryString + secretCode;

      console.log('[PaymentAsia🔐] Signature Calculation:');
      console.log('[PaymentAsia🔐] Query string (first 150 chars):', queryString.substring(0, 150) + (queryString.length > 150 ? '...' : ''));
      console.log('[PaymentAsia🔐] Secret code:', secretCode.substring(0, 8) + '...');

      // Hash with SHA512
      const signature = crypto
        .createHash('sha512')
        .update(signatureInput)
        .digest('hex');

      console.log('[PaymentAsia🔐] Generated signature:', signature.substring(0, 20) + '...');

      return signature;
    } catch (error: any) {
      console.error('[PaymentAsia] Signature creation error:', error);
      throw new Error(`Failed to create signature: ${error.message}`);
    }
  }

  /**
   * Encode value for signature calculation (RFC 3986 matching PHP http_build_query)
   * Spaces become +, other characters are percent-encoded
   */
  private encodeForSignature(value: string): string {
    return encodeURIComponent(value)
      .replace(/!/g, '%21')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\*/g, '%2A')
      .replace(/%20/g, '+');  // Replace %20 with + for spaces (PHP style)
  }

  /**
   * Build payment form data with signature
   * @param orderData - Order information
   * @returns Form data object ready for submission
   */
  buildPaymentForm(orderData: {
    orderId: string;
    amount: number;        // Amount in cents (e.g., 1000 = $10.00)
    currency: string;      // e.g., 'SGD', 'HKD', 'USD'
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerCountry: string; // 2-letter code
    customerState: string;   // State/Province
    customerAddress: string;
    customerPostalCode?: string;  // ZIP/Postal code (optional, will default if not provided)
    customerIp: string;
    subject: string;       // Order description
    network?: string;      // Payment network (e.g., CreditCard, Alipay, Wechat)
    returnUrl: string;     // URL to redirect customer after payment
    notifyUrl?: string;    // Webhook URL for Payment Asia to POST transaction data
  }): PaymentAsiaFormData {
    if (!this.config) {
      throw new Error('Payment Asia service not initialized');
    }

    // Validate payment network - CASE SENSITIVE (must match Payment Asia exactly)
    // Supported networks: Alipay, Wechat, CUP, CreditCard, Fps, Octopus
    // NOTE: If network is provided, validate it. Otherwise, leave it undefined for later selection.
    let network: string | undefined = orderData.network;
    const currency: string = orderData.currency.toUpperCase();

    // Only validate network if explicitly provided
    if (network) {
      // Networks that support multiple currencies (HKD and USD)
      // Only CreditCard supports USD, others are HKD only
      const multiCurrencyNetworks = ['CreditCard', 'Fps', 'UserDefine'];
      // Networks that only support HKD
      const hkdOnlyNetworks = ['Alipay', 'Wechat', 'CUP', 'Octopus'];

      // Validate network exists
      const allValidNetworks = [...multiCurrencyNetworks, ...hkdOnlyNetworks];
      if (!allValidNetworks.includes(network)) {
        throw new Error(
          `Invalid payment network: ${network}. Supported networks (case-sensitive): ${allValidNetworks.join(', ')}`
        );
      }

      if (multiCurrencyNetworks.includes(network)) {
        // CreditCard, Fps, UserDefine support HKD and USD
        if (!['HKD', 'USD'].includes(currency)) {
          throw new Error(
            `${network} payment only supports HKD and USD currencies. Received: ${currency}`
          );
        }
      } else if (hkdOnlyNetworks.includes(network)) {
        // Alipay, Wechat, CUP, Octopus only support HKD
        if (currency !== 'HKD') {
          throw new Error(
            `${network} payment channel only supports HKD currency. Received: ${currency}`
          );
        }
      }
    }

    // Split customer name into first and last
    const nameParts: string[] = orderData.customerName.split(' ');
    const firstName: string = nameParts[0] || '';
    const lastName: string = (nameParts.slice(1).join(' ') || nameParts[0]) || '';

    // Format amount as xx.xx (remove cents, convert to decimal)
    const amountInDollars: string = (orderData.amount / 100).toFixed(2);

    // Build form fields - only include network and notify_url if explicitly provided
    const formData: PaymentAsiaFormData = {
      merchant_reference: orderData.orderId,
      currency: currency,
      amount: amountInDollars,
      customer_ip: orderData.customerIp,
      customer_first_name: firstName,
      customer_last_name: lastName,
      customer_address: orderData.customerAddress,
      customer_postal_code: orderData.customerPostalCode || 'HK',
      customer_phone: orderData.customerPhone,
      customer_email: orderData.customerEmail,
      customer_state: orderData.customerState || 'HK',
      customer_country: orderData.customerCountry,
      return_url: orderData.returnUrl,
      ...(orderData.notifyUrl ? { notify_url: orderData.notifyUrl } : {}),  // Include notify_url if provided
      ...(network ? { network: network } : {}),  // Only include network if provided
      subject: orderData.subject,
    };

    // Create signature - include all form fields that Payment Asia expects
    // Network is just for customer payment method selection on the hosted page
    // NotifyUrl is the webhook endpoint for Payment Asia to send transaction data
    const fieldStrings: Record<string, string> = {
      merchant_reference: formData.merchant_reference,
      currency: formData.currency,
      amount: formData.amount,
      customer_ip: formData.customer_ip,
      customer_first_name: formData.customer_first_name,
      customer_last_name: formData.customer_last_name,
      customer_address: formData.customer_address,
      customer_postal_code: formData.customer_postal_code,
      customer_phone: formData.customer_phone,
      customer_email: formData.customer_email,
      customer_state: formData.customer_state,
      customer_country: formData.customer_country,
      return_url: formData.return_url,
      ...(formData.notify_url ? { notify_url: formData.notify_url } : {}),
      ...(formData.network ? { network: formData.network } : {}),
      subject: formData.subject,
    };

    const signature: string = this.createSignature(fieldStrings, this.config.secretCode);

    // Log all form data being sent to Payment Asia
    console.log('\n' + '='.repeat(80));
    console.log('[PaymentAsia] FORM DATA BEING SENT');
    console.log('='.repeat(80));
    console.log('[PaymentAsia] Network:', formData.network ? formData.network : '(will be selected by user)');
    console.log('[PaymentAsia] Webhook (notify_url):', formData.notify_url ? '✅ ' + formData.notify_url : '(not configured)');
    console.log('[PaymentAsia] Merchant Reference:', formData.merchant_reference);
    console.log('[PaymentAsia] Amount:', formData.amount, formData.currency);
    console.log('[PaymentAsia] Customer:', formData.customer_first_name, formData.customer_last_name);
    console.log('[PaymentAsia] Email:', formData.customer_email);
    console.log('[PaymentAsia] Phone:', formData.customer_phone);
    console.log('[PaymentAsia] Address:', formData.customer_address, formData.customer_postal_code);
    console.log('[PaymentAsia] Country/State:', formData.customer_country, formData.customer_state);
    console.log('[PaymentAsia] Subject:', formData.subject);
    console.log('[PaymentAsia] Signature:', signature.substring(0, 20) + '...');
    console.log('='.repeat(80) + '\n');

    return {
      ...formData,
      sign: signature,
    };
  }

  /**
   * Test connection by generating a test payment form
   * Returns form data that can be submitted to Payment Asia for testing
   * 
   * @param network - Optional payment network (e.g., 'CreditCard')
   * @param returnTo - Optional return URL for redirect after payment
   * @param baseUrl - Base URL for constructing callbacks
   * @param notifyUrl - Optional webhook URL for Payment Asia to POST transaction data
   */
  testConnection(network?: string, returnTo?: string, baseUrl?: string, notifyUrl?: string): PaymentAsiaTestResponse {
    try {
      if (!this.config) {
        return {
          success: false,
          message: 'Payment Asia service not initialized',
          error: 'Configuration missing',
        };
      }

      console.log('\n' + '━'.repeat(80));
      console.log('🧪 PAYMENT ASIA TEST CONNECTION');
      console.log('━'.repeat(80));
      console.log('📡 Payment Network:', network || 'CreditCard (default)');
      console.log('🌍 Environment: Sandbox');
      console.log('💱 Currency: HKD');
      console.log('━'.repeat(80) + '\n');

      // Generate merchant reference FIRST so we can include it in the return_url
      const merchantRef = `TEST-${Date.now()}`;
      const baseUrlValue = baseUrl || 'http://localhost:10000';

      // Build test form data with HKD for multi-currency support
      // If user selected a network, include it in the form (will be part of signature calculation)
      const testForm = this.buildPaymentForm({
        orderId: merchantRef,  // Use pre-generated merchant reference
        amount: 50400,  // HKD 504.00 (matches test order items: Pad Thai 288 + Spring Roll 72 + Tea 120 + 5% service 24)
        currency: 'HKD',
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        customerPhone: '+85298765432',
        customerCountry: 'HK',
        customerState: 'HK',
        customerAddress: '123 Test Street',
        customerIp: '127.0.0.1',
        subject: 'Test Payment Form',
        // Include network if provided (user selected payment method from dropdown)
        // Network will NOT be included in signature calculation - only for display
        ...(network ? { network } : {}),
        // Return URL: Payment Asia redirects here to log response, then redirects to frontend
        // Include merchant reference as parameter so callback can extract it
        returnUrl: returnTo 
          ? `${baseUrlValue}/payment-callback?merchant_reference=${encodeURIComponent(merchantRef)}&return_to=${encodeURIComponent(returnTo)}`
          : `${baseUrlValue}/payment-callback?merchant_reference=${encodeURIComponent(merchantRef)}`,
        // Notify URL: Payment Asia POSTs transaction data here (webhook)
        notifyUrl: notifyUrl 
          ? notifyUrl
          : `${baseUrlValue}/webhook/payment-asia-test`,
      });

      // Network will be added later when user selects payment method on test page
      // No need to delete it - it was never included in the first place

      const paymentUrl = this.getPaymentFormUrl(network);

      // Log what we're returning to the frontend
      console.log('\n' + '━'.repeat(80));
      console.log('📤 SENDING TO FRONTEND - Test Payment Form Data:');
      console.log('━'.repeat(80));
      console.log('🌐 Payment URL:', paymentUrl);
      console.log('📋 Form Fields:');
      Object.entries(testForm).forEach(([key, value]) => {
        const displayValue = key === 'sign' ? value.substring(0, 30) + '...' : value;
        console.log(`  [${key}] = ${displayValue}`);
      });
      console.log('━'.repeat(80) + '\n');

      return {
        success: true,
        message: 'Test payment form generated successfully - ready to submit to Payment Asia',
        paymentUrl,
        formData: testForm,  // Include form data for frontend to submit
      };
    } catch (error: any) {
      console.error('[PaymentAsia] Test connection error:', error);
      return {
        success: false,
        message: `Connection test failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Verify webhook signature from Payment Asia callback
   * @param data - POST data from Payment Asia
   * @param receivedSignature - Sign field from Payment Asia
   * @param secretCode - Secret Code for verification
   * @returns true if signature is valid
   */
  verifyWebhookSignature(data: Record<string, string>, receivedSignature: string, secretCode?: string): boolean {
    try {
      const secret = secretCode || this.config?.secretCode;
      
      if (!secret) {
        console.error('[PaymentAsia] Secret code not available for webhook verification');
        return false;
      }

      // Create a copy without the signature field
      const fieldsToVerify: Record<string, string> = {};
      const requiredFields = ['amount', 'currency', 'request_reference', 'merchant_reference', 'status'];
      
      requiredFields.forEach(field => {
        if (data[field]) {
          fieldsToVerify[field] = data[field];
        }
      });

      // Calculate expected signature
      const expectedSignature = this.createSignature(fieldsToVerify, secret);

      const isValid = expectedSignature === receivedSignature;
      
      if (!isValid) {
        console.warn('[PaymentAsia] Webhook signature validation failed');
        console.warn('[PaymentAsia] Expected:', expectedSignature.substring(0, 16) + '...');
        console.warn('[PaymentAsia] Received:', receivedSignature.substring(0, 16) + '...');
      } else {
        console.log('[PaymentAsia] Webhook signature verified successfully');
      }

      return isValid;
    } catch (error: any) {
      console.error('[PaymentAsia] Webhook signature verification error:', error);
      return false;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PaymentAsiaConfig | null {
    return this.config;
  }

  /**
   * Get gateway environment
   */
  getEnvironment(): string {
    return this.config?.environment || 'unknown';
  }

  // ─── Management APIs (gateway.pa-sys.com) ────────────────────────
  // These use a different base host from the payment form endpoints.

  private getGatewayBaseUrl(): string {
    return this.config?.environment === 'sandbox'
      ? 'https://gateway-sandbox.pa-sys.com'
      : 'https://gateway.pa-sys.com';
  }

  /**
   * Create a signature for management API requests.
   * Management APIs only sign the fields they require (not the full form field set).
   */
  private createManagementSignature(fields: Record<string, string>): string {
    if (!this.config) throw new Error('Payment Asia service not initialized');
    // Sort alphabetically then encode exactly like form signatures
    const sorted = Object.keys(fields).sort();
    const pairs = sorted.map(k => `${this.encodeForSignature(k)}=${this.encodeForSignature(fields[k]!)}`);
    const queryString = pairs.join('&');
    return crypto.createHash('sha512').update(queryString + this.config.secretCode).digest('hex');
  }

  /**
   * Build a URL-encoded string for management API requests (form-encoded, not JSON).
   */
  private toFormEncoded(payload: Record<string, string>): string {
    return Object.entries(payload)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&');
  }

  /**
   * Payment Query API
   * POST https://gateway[-sandbox].pa-sys.com/[Merchant Token]/payment/query
   * Returns all Sale + Refund records for a given merchant_reference.
   */
  async queryPayment(merchantReference: string): Promise<any[]> {
    if (!this.config) throw new Error('Payment Asia service not initialized');

    const fields: Record<string, string> = { merchant_reference: merchantReference };
    const sign = this.createManagementSignature(fields);

    const url = `${this.getGatewayBaseUrl()}/${this.config.merchantToken}/payment/query`;
    const body = this.toFormEncoded({ ...fields, sign });

    console.log('[PaymentAsia] queryPayment →', url, '| ref:', merchantReference);
    const res = await axios.post(url, body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    console.log('[PaymentAsia] queryPayment ←', JSON.stringify(res.data));
    // Sandbox returns bare [] on success; production returns { request, response, payload }
    if (Array.isArray(res.data)) return res.data;
    const responseCode = String(res.data?.response?.code ?? '');
    const isSuccess = !responseCode || responseCode === '200' || responseCode === '20000' || responseCode === '0';
    if (!isSuccess) {
      throw new Error(res.data?.response?.message || `Management API error (code ${responseCode})`);
    }
    return Array.isArray(res.data?.payload) ? res.data.payload : [];
  }

  /**
   * Refund API
   * POST https://gateway[-sandbox].pa-sys.com/[Merchant Token]/transactions/refund
   * Returns refund_reference (UUID); status will be 4 (Processing) — must poll refund-query.
   */
  async requestRefund(merchantReference: string, amount: number): Promise<any> {
    if (!this.config) throw new Error('Payment Asia service not initialized');

    const amountStr = amount.toFixed(2);
    const signedFields: Record<string, string> = {
      merchant_reference: merchantReference,
      amount: amountStr,
    };
    const sign = this.createManagementSignature(signedFields);

    const url = `${this.getGatewayBaseUrl()}/v1.1/online/${this.config.merchantToken}/transactions/refund`;
    const body = this.toFormEncoded({ ...signedFields, currency: 'HKD', sign });

    console.log('[PaymentAsia] requestRefund →', url, '| ref:', merchantReference, '| amount:', amountStr);
    const res = await axios.post(url, body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    console.log('[PaymentAsia] requestRefund ←', JSON.stringify(res.data));
    return res.data;
  }

  /**
   * Refund Query API
   * POST https://gateway[-sandbox].pa-sys.com/v1.1/online/[Merchant Token]/transactions/refund-query
   * Checks the status of a refund by its refund_reference.
   */
  async queryRefund(refundReference: string): Promise<any> {
    if (!this.config) throw new Error('Payment Asia service not initialized');

    const fields: Record<string, string> = { refund_reference: refundReference };
    const sign = this.createManagementSignature(fields);

    const url = `${this.getGatewayBaseUrl()}/v1.1/online/${this.config.merchantToken}/transactions/refund-query`;
    const body = this.toFormEncoded({ ...fields, sign });

    console.log('[PaymentAsia] queryRefund →', url, '| refundRef:', refundReference);
    const res = await axios.post(url, body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    console.log('[PaymentAsia] queryRefund ←', JSON.stringify(res.data));
    return res.data;
  }

}

export const paymentAsiaService = new PaymentAsiaService();
