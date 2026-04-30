/**
 * KPAY Terminal Service
 * Handles communication with KPAY payment terminals
 * Manages key exchange, transaction signing, and API calls
 */
interface KPayConfig {
    appId: string;
    appSecret: string;
    terminalIp: string;
    terminalPort: number;
    endpointPath?: string;
}
interface TestResult {
    success: boolean;
    message: string;
    error?: string;
    response?: any;
}
declare class KPayTerminalService {
    private config;
    private appPrivateKey;
    private platformPublicKey;
    private _logs;
    /** Dual-write: VS Code terminal + in-memory buffer returned to caller */
    private log;
    /** Return accumulated logs and reset the buffer */
    flushLogs(): string[];
    /**
     * Initialize service with terminal configuration
     * @param config - Terminal connection details
     */
    initialize(config: KPayConfig): void;
    /**
     * Generate timestamp for KPAY request (milliseconds)
     */
    private getTimestamp;
    /**
     * Generate 32-character random nonce string
     */
    private generateNonce;
    /**
     * Test connection to KPAY terminal by performing sign request (key exchange)
     * This validates credentials and connectivity without actual payment
     */
    testConnection(): Promise<TestResult>;
    /**
     * Build canonical signing string per KPay spec:
     *   POST/PUT (5 lines):  METHOD\nURL_PATH\nTIMESTAMP\nNONCE_STR\nBODY_JSON\n
     *   GET      (4 lines):  METHOD\nURL_PATH_WITH_QUERY\nTIMESTAMP\nNONCE_STR\n
     * Then RSA-SHA256 sign with appPrivateKey (PKCS#8 DER base64), Base64-encode result.
     */
    private buildSignature;
    /**
     * Perform a sale transaction (Step 2 of payment flow)
     * Sends POST to /v2/pos/sales with payment details and signature
     * @param paymentDetails - Payment transaction details
     */
    performSale(paymentDetails: {
        outTradeNo: string;
        payAmount: string;
        tipsAmount: string;
        payCurrency: string;
        description?: string;
        customerName?: string;
    }): Promise<TestResult>;
    /**
     * Query transaction status (Step 3 of payment flow)
     * Sends GET to /v2/pos/query to check payment result
     * @param outTradeNo - Merchant order reference number
     */
    queryTransactionStatus(outTradeNo: string): Promise<TestResult>;
    /**
     * Cancel (Void) a completed but unsettled same-day transaction
     * POST /v2/pos/sales/cancel
     */
    cancelTransaction(details: {
        outTradeNo: string;
        originOutTradeNo: string;
        callbackUrl?: string;
    }): Promise<TestResult>;
    /**
     * Refund a settled transaction (full or partial)
     * POST /v2/pos/sales/refund
     * managerPassword must be RSA-PKCS1v1.5 encrypted with platformPublicKey
     */
    refundTransaction(details: {
        outTradeNo: string;
        refundType: 1 | 2;
        managerPassword: string;
        transactionNo?: string;
        refNo?: string;
        commitTime?: string;
        refundAmount?: string;
        callbackUrl?: string;
    }): Promise<TestResult>;
    /**
     * Encrypt a plain-text admin password using the platform public key (RSA-PKCS1v1.5 + SHA1)
     * Returns base64-encoded ciphertext ready to send in managerPassword field.
     */
    encryptManagerPassword(plainPassword: string): string;
    /**
     * Close an in-progress (pending) transaction to free the terminal
     * POST /v2/pos/sales/close
     */
    closeTransaction(outTradeNo: string): Promise<TestResult>;
    /**
     * Build request signature for payment transactions
     * Signs the request body using RSA with app private key
     * Not yet implemented - placeholder for future transaction signing
     */
    buildSignRequest(payload: any): string;
}
export declare const kpayTerminalService: KPayTerminalService;
export {};
//# sourceMappingURL=kpayTerminalService.d.ts.map