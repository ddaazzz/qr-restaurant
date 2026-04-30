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
export interface PaymentAsiaConfig {
    merchantToken: string;
    secretCode: string;
    environment: 'sandbox' | 'production';
}
export interface PaymentAsiaFormData {
    merchant_reference: string;
    currency: string;
    amount: string;
    customer_ip: string;
    customer_first_name: string;
    customer_last_name: string;
    customer_address: string;
    customer_postal_code: string;
    customer_phone: string;
    customer_email: string;
    customer_state: string;
    customer_country: string;
    return_url: string;
    notify_url?: string;
    network?: string;
    subject: string;
    sign?: string;
}
export interface PaymentAsiaTestResponse {
    success: boolean;
    message: string;
    error?: string;
    paymentUrl?: string;
    formData?: PaymentAsiaFormData;
}
/**
 * PaymentAsiaService
 * Handles form-based payment requests and webhook verification for Payment Asia
 */
declare class PaymentAsiaService {
    private config;
    /**
     * Initialize the service with Payment Asia configuration
     */
    initialize(config: PaymentAsiaConfig): void;
    /**
     * Get the payment form submission URL based on environment
     */
    getPaymentFormUrl(network?: string): string;
    /**
     * Create SHA512 signature using Payment Asia format
     * Signature = SHA512(http_build_query($fields) . $secret)
     * Format matches PHP: alphabetical order, + for spaces, standard URL encoding
     * @param fields - Form fields object
     * @param secretCode - Secret Code
     * @returns SHA512 hex signature
     */
    private createSignature;
    /**
     * Encode value for signature calculation (RFC 3986 matching PHP http_build_query)
     * Spaces become +, other characters are percent-encoded
     */
    private encodeForSignature;
    /**
     * Build payment form data with signature
     * @param orderData - Order information
     * @returns Form data object ready for submission
     */
    buildPaymentForm(orderData: {
        orderId: string;
        amount: number;
        currency: string;
        customerName: string;
        customerEmail: string;
        customerPhone: string;
        customerCountry: string;
        customerState: string;
        customerAddress: string;
        customerPostalCode?: string;
        customerIp: string;
        subject: string;
        network?: string;
        returnUrl: string;
        notifyUrl?: string;
    }): PaymentAsiaFormData;
    /**
     * Test connection by generating a test payment form
     * Returns form data that can be submitted to Payment Asia for testing
     *
     * @param network - Optional payment network (e.g., 'CreditCard')
     * @param returnTo - Optional return URL for redirect after payment
     * @param baseUrl - Base URL for constructing callbacks
     * @param notifyUrl - Optional webhook URL for Payment Asia to POST transaction data
     */
    testConnection(network?: string, returnTo?: string, baseUrl?: string, notifyUrl?: string): PaymentAsiaTestResponse;
    /**
     * Verify webhook signature from Payment Asia callback
     * @param data - POST data from Payment Asia
     * @param receivedSignature - Sign field from Payment Asia
     * @param secretCode - Secret Code for verification
     * @returns true if signature is valid
     */
    verifyWebhookSignature(data: Record<string, string>, receivedSignature: string, secretCode?: string): boolean;
    /**
     * Get current configuration
     */
    getConfig(): PaymentAsiaConfig | null;
    /**
     * Get gateway environment
     */
    getEnvironment(): string;
    private getGatewayBaseUrl;
    /**
     * Create a signature for management API requests.
     * Management APIs only sign the fields they require (not the full form field set).
     */
    private createManagementSignature;
    /**
     * Build a URL-encoded string for management API requests (form-encoded, not JSON).
     */
    private toFormEncoded;
    /**
     * Payment Query API
     * POST https://gateway[-sandbox].pa-sys.com/[Merchant Token]/payment/query
     * Returns all Sale + Refund records for a given merchant_reference.
     */
    queryPayment(merchantReference: string): Promise<any[]>;
    /**
     * Refund API
     * POST https://gateway[-sandbox].pa-sys.com/[Merchant Token]/transactions/refund
     * Returns refund_reference (UUID); status will be 4 (Processing) — must poll refund-query.
     */
    requestRefund(merchantReference: string, amount: number): Promise<any>;
    /**
     * Refund Query API
     * POST https://gateway[-sandbox].pa-sys.com/v1.1/online/[Merchant Token]/transactions/refund-query
     * Checks the status of a refund by its refund_reference.
     */
    queryRefund(refundReference: string): Promise<any>;
}
export declare const paymentAsiaService: PaymentAsiaService;
export {};
//# sourceMappingURL=paymentAsiaService.d.ts.map