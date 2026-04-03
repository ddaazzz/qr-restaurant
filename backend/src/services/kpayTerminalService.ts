/**
 * KPAY Terminal Service
 * Handles communication with KPAY payment terminals
 * Manages key exchange, transaction signing, and API calls
 */

import http from 'http';
import crypto from 'crypto';

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

class KPayTerminalService {
  private config: KPayConfig | null = null;
  private appPrivateKey: string | null = null;
  private platformPublicKey: string | null = null;
  private _logs: string[] = [];

  /** Dual-write: VS Code terminal + in-memory buffer returned to caller */
  private log(message: string): void {
    console.log(message);
    this._logs.push(message);
  }

  /** Return accumulated logs and reset the buffer */
  flushLogs(): string[] {
    const logs = [...this._logs];
    this._logs = [];
    return logs;
  }

  /**
   * Initialize service with terminal configuration
   * @param config - Terminal connection details
   */
  initialize(config: KPayConfig): void {
    this.config = {
      ...config,
      endpointPath: config.endpointPath || '/v2/pos/sign',
    };
    this.log(`[KPayTerminalService] Initialized with terminal at ${config.terminalIp}:${config.terminalPort}`);
  }

  /**
   * Generate timestamp for KPAY request (milliseconds)
   */
  private getTimestamp(): string {
    return Date.now().toString();
  }

  /**
   * Generate 32-character random nonce string
   */
  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 34).padEnd(32, '0');
  }

  /**
   * Test connection to KPAY terminal by performing sign request (key exchange)
   * This validates credentials and connectivity without actual payment
   */
  async testConnection(): Promise<TestResult> {
    if (!this.config) {
      return {
        success: false,
        message: 'Service not initialized',
        error: 'Configuration missing',
      };
    }

    return new Promise((resolve) => {
      const payload = JSON.stringify({
        appId: this.config!.appId,
        appSecret: this.config!.appSecret,
      });

      const timestamp = this.getTimestamp();
      const nonceStr = this.generateNonce();

      const options = {
        hostname: this.config!.terminalIp,
        port: this.config!.terminalPort,
        path: this.config!.endpointPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'timestamp': timestamp,
          'nonceStr': nonceStr,
        },
        timeout: 10000, // 10 second timeout
      };

      console.log(`[KPayTerminalService] Testing connection to ${this.config!.terminalIp}:${this.config!.terminalPort}${this.config!.endpointPath}`);
      this.log(`[KPayTerminalService] → POST ${this.config!.terminalIp}:${this.config!.terminalPort}${this.config!.endpointPath}`);

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);

            // Check for successful key exchange response
            if (response.code === 10000 && response.data) {
              const hasPublicKey = !!response.data.platformPublicKey;
              const hasPrivateKey = !!response.data.appPrivateKey;

              if (hasPublicKey && hasPrivateKey) {
                this.log('[KPayTerminalService] ✅ Key exchange successful');
                // Store keys for use in subsequent signed requests
                this.appPrivateKey = response.data.appPrivateKey;
                this.platformPublicKey = response.data.platformPublicKey;
                resolve({
                  success: true,
                  message: 'Key exchange successful. Platform public key and app private key received.',
                  response: response,
                });
              } else {
                this.log('[KPayTerminalService] ❌ Keys missing in response');
                resolve({
                  success: false,
                  message: 'Key exchange incomplete',
                  error: 'Platform public key or app private key missing from response',
                  response: response,
                });
              }
            } else {
              const errorMsg = response.message || 'Unknown error';
              this.log(`[KPayTerminalService] ❌ Authentication failed: ${errorMsg}`);
              resolve({
                success: false,
                message: `Authentication failed: ${errorMsg}`,
                error: errorMsg,
                response: response,
              });
            }
          } catch (parseError: any) {
            this.log(`[KPayTerminalService] ❌ Failed to parse response: ${parseError.message}`);
            resolve({
              success: false,
              message: 'Invalid response format',
              error: `Failed to parse JSON: ${parseError.message}`,
            });
          }
        });
      });

      req.on('error', (err: any) => {
        this.log(`[KPayTerminalService] ❌ Connection error: ${err.message}`);
        resolve({
          success: false,
          message: 'Failed to connect to terminal',
          error: err.message,
        });
      });

      req.on('timeout', () => {
        this.log('[KPayTerminalService] ❌ Connection timeout (10s)');
        req.destroy();
        resolve({
          success: false,
          message: 'Connection timeout',
          error: 'Terminal did not respond within 10 seconds',
        });
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Build canonical signing string per KPay spec:
   *   POST/PUT (5 lines):  METHOD\nURL_PATH\nTIMESTAMP\nNONCE_STR\nBODY_JSON\n
   *   GET      (4 lines):  METHOD\nURL_PATH_WITH_QUERY\nTIMESTAMP\nNONCE_STR\n
   * Then RSA-SHA256 sign with appPrivateKey (PKCS#8 DER base64), Base64-encode result.
   */
  private buildSignature(method: string, urlPath: string, timestamp: string, nonceStr: string, body?: string): string {
    if (!this.appPrivateKey) {
      throw new Error('No app private key available - perform key exchange first');
    }

    // Each component ends with \n, body line only present for POST/PUT
    let canonical = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n`;
    if (body !== undefined) {
      canonical += `${body}\n`;
    }

    console.log(`[KPayTerminalService] Canonical string:\n${canonical}`);
    this.log(`[KPayTerminalService] Canonical string:\n${canonical}`);

    const raw = this.appPrivateKey.replace(/\s+/g, '');
    const lines = raw.match(/.{1,64}/g)!.join('\n');
    const pem = `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----`;
    const privateKey = crypto.createPrivateKey(pem);

    const signer = crypto.createSign('SHA256');
    signer.update(canonical, 'utf8');
    const sig = signer.sign(privateKey, 'base64');
    console.log(`[KPayTerminalService] Signature (first 40): ${sig.substring(0, 40)}`);
    this.log(`[KPayTerminalService] Signature (first 40): ${sig.substring(0, 40)}`);
    return sig;
  }

  /**
   * Perform a sale transaction (Step 2 of payment flow)
   * Sends POST to /v2/pos/sales with payment details and signature
   * @param paymentDetails - Payment transaction details
   */
  async performSale(paymentDetails: {
    outTradeNo: string;
    payAmount: string;
    tipsAmount: string;
    payCurrency: string;
    description?: string;
    customerName?: string;
  }): Promise<TestResult> {
    if (!this.config) {
      return {
        success: false,
        message: 'Service not initialized',
        error: 'Configuration missing',
      };
    }

    return new Promise((resolve) => {
      const timestamp = this.getTimestamp();
      const nonceStr = this.generateNonce();

      // Build body with only required (non-empty) fields, in the exact order they'll be sent
      const bodyFields: Record<string, string> = {
        outTradeNo: paymentDetails.outTradeNo,
        payAmount: paymentDetails.payAmount,
        tipsAmount: paymentDetails.tipsAmount,
        payCurrency: paymentDetails.payCurrency,
      };
      if (paymentDetails.description) bodyFields.description = paymentDetails.description;

      const bodyJson = JSON.stringify(bodyFields);

      // Canonical: POST\n/v2/pos/sales\nTIMESTAMP\nNONCE\nBODY_JSON\n
      let signature: string;
      try {
        signature = this.buildSignature('POST', '/v2/pos/sales', timestamp, nonceStr, bodyJson);
      } catch (signErr: any) {
        console.error('[KPayTerminalService] ❌ Signature build failed:', signErr.message);
        resolve({ success: false, message: 'Signature error', error: signErr.message });
        return;
      }

      const saleEndpoint = '/v2/pos/sales';

      const options = {
        hostname: this.config!.terminalIp,
        port: this.config!.terminalPort,
        path: saleEndpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyJson),
          'appId': this.config!.appId,
          'timestamp': timestamp,
          'nonceStr': nonceStr,
          'signature': signature,
        },
        timeout: 70000,
      };

      console.log(`[KPayTerminalService] Initiating sale transaction for ${paymentDetails.outTradeNo}`);
      console.log(`  Amount: ${paymentDetails.payAmount} ${paymentDetails.payCurrency}`);
      this.log(`[KPayTerminalService] → POST /v2/pos/sales  outTradeNo=${paymentDetails.outTradeNo}  amount=${paymentDetails.payAmount} ${paymentDetails.payCurrency}`);

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.code === 10000) {
              this.log(`[KPayTerminalService] ✅ Sale transaction initiated`);
              resolve({
                success: true,
                message: 'Sale transaction initiated',
                response: {
                  transactionId: response.data?.transactionId,
                  outTradeNo: paymentDetails.outTradeNo,
                  status: 'pending',
                  code: response.code,
                },
              });
            } else {
              const errorMsg = response.message || 'Unknown error';
              this.log(`[KPayTerminalService] ❌ Sale failed: ${errorMsg}`);
              resolve({ success: false, message: `Sale failed: ${errorMsg}`, error: errorMsg, response });
            }
          } catch (parseError: any) {
            resolve({ success: false, message: 'Invalid response format', error: parseError.message });
          }
        });
      });

      req.on('error', (err: any) => {
        this.log(`[KPayTerminalService] ❌ Sale request error: ${err.message}`);
        resolve({ success: false, message: 'Failed to send sale request', error: err.message });
      });

      req.on('timeout', () => {
        this.log('[KPayTerminalService] ⚠️ Sale request timeout (65s) - payment may still be processing');
        req.destroy();
        resolve({ success: false, message: 'Sale request timeout - use query status to check final result', error: 'Timeout after 65 seconds' });
      });

      req.write(bodyJson);
      req.end();
    });
  }

  /**
   * Query transaction status (Step 3 of payment flow)
   * Sends GET to /v2/pos/query to check payment result
   * @param outTradeNo - Merchant order reference number
   */
  async queryTransactionStatus(outTradeNo: string): Promise<TestResult> {
    if (!this.config) {
      return {
        success: false,
        message: 'Service not initialized',
        error: 'Configuration missing',
      };
    }

    return new Promise((resolve) => {
      const timestamp = this.getTimestamp();
      const nonceStr = this.generateNonce();
      // GET canonical: GET\n/v2/pos/query?outTradeNo=...\nTIMESTAMP\nNONCE\n (no body)
      const urlPath = `/v2/pos/query?outTradeNo=${encodeURIComponent(outTradeNo)}`;
      let signature: string;
      try {
        signature = this.buildSignature('GET', urlPath, timestamp, nonceStr);
      } catch (signErr: any) {
        resolve({ success: false, message: 'Signature error', error: signErr.message });
        return;
      }

      const options = {
        hostname: this.config!.terminalIp,
        port: this.config!.terminalPort,
        path: urlPath,
        method: 'GET',
        headers: {
          'appId': this.config!.appId,
          'timestamp': timestamp,
          'nonceStr': nonceStr,
          'signature': signature,
        },
        timeout: 10000,
      };

      console.log(`[KPayTerminalService] Querying status for ${outTradeNo}`);
      this.log(`[KPayTerminalService] → GET /v2/pos/query  outTradeNo=${outTradeNo}`);

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);

            if (response.code === 10000 && response.data) {
              const payResult = response.data.payResult;
              let status = 'unknown';
              
              // payResult codes: 1=pending, 2=success, 3=failed, 4=cancelled
              if (payResult === 1) status = 'pending';
              else if (payResult === 2) status = 'success';
              else if (payResult === 3) status = 'failed';
              else if (payResult === 4) status = 'cancelled';

              this.log(`[KPayTerminalService] ✅ Status query result: ${status}`);
              resolve({
                success: true,
                message: `Transaction status: ${status}`,
                response: {
                  outTradeNo: response.data.outTradeNO || outTradeNo,
                  transactionNo: response.data.transactionNo,
                  refNo: response.data.refNo,
                  commitTime: response.data.commitTime,
                  batchNo: response.data.batchNo,
                  traceNo: response.data.traceNo,
                  status: status,
                  payResult: payResult,
                  amount: response.data.payAmount,
                  currency: response.data.payCurrency,
                  code: response.code,
                },
              });
            } else {
              this.log(`[KPayTerminalService] ❌ Query failed: ${response.message}`);
              resolve({
                success: false,
                message: `Query failed: ${response.message || 'Unknown error'}`,
                error: response.message,
                response: response,
              });
            }
          } catch (parseError: any) {
            this.log(`[KPayTerminalService] ❌ Failed to parse query response: ${parseError.message}`);
            resolve({
              success: false,
              message: 'Invalid response format',
              error: `Failed to parse JSON: ${parseError.message}`,
            });
          }
        });
      });

      req.on('error', (err: any) => {
        this.log(`[KPayTerminalService] ❌ Query request error: ${err.message}`);
        resolve({
          success: false,
          message: 'Failed to query status',
          error: err.message,
        });
      });

      req.on('timeout', () => {
        this.log('[KPayTerminalService] ❌ Query timeout (10s)');
        req.destroy();
        resolve({
          success: false,
          message: 'Query timeout',
          error: 'Terminal did not respond within 10 seconds',
        });
      });

      req.end();
    });
  }

  /**
   * Cancel (Void) a completed but unsettled same-day transaction
   * POST /v2/pos/sales/cancel
   */
  async cancelTransaction(details: {
    outTradeNo: string;
    originOutTradeNo: string;
    callbackUrl?: string;
  }): Promise<TestResult> {
    if (!this.config) return { success: false, message: 'Service not initialized', error: 'Configuration missing' };

    return new Promise((resolve) => {
      const timestamp = this.getTimestamp();
      const nonceStr = this.generateNonce();

      const bodyFields: Record<string, string> = {
        outTradeNo: details.outTradeNo,
        originOutTradeNo: details.originOutTradeNo,
      };
      if (details.callbackUrl) bodyFields.callbackUrl = details.callbackUrl;

      const bodyJson = JSON.stringify(bodyFields);
      let signature: string;
      try {
        signature = this.buildSignature('POST', '/v2/pos/sales/cancel', timestamp, nonceStr, bodyJson);
      } catch (e: any) {
        resolve({ success: false, message: 'Signature error', error: e.message });
        return;
      }

      const options = {
        hostname: this.config!.terminalIp,
        port: this.config!.terminalPort,
        path: '/v2/pos/sales/cancel',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyJson),
          'appId': this.config!.appId,
          'timestamp': timestamp,
          'nonceStr': nonceStr,
          'signature': signature,
        },
        timeout: 70000,
      };

      console.log(`[KPayTerminalService] Cancelling transaction ${details.originOutTradeNo}`);
      this.log(`[KPayTerminalService] → POST /v2/pos/sales/cancel  originOutTradeNo=${details.originOutTradeNo}`);

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.code === 10000) {
              this.log(`[KPayTerminalService] ✅ Cancel initiated`);
              resolve({ success: true, message: 'Cancel transaction initiated', response });
            } else {
              const msg = response.message || 'Unknown error';
              this.log(`[KPayTerminalService] ❌ Cancel failed: ${msg}`);
              resolve({ success: false, message: `Cancel failed: ${msg}`, error: msg, response });
            }
          } catch (e: any) {
            resolve({ success: false, message: 'Invalid response format', error: e.message });
          }
        });
      });
      req.on('error', (e: any) => resolve({ success: false, message: 'Request error', error: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Cancel timeout', error: 'No response within 65s' }); });
      req.write(bodyJson);
      req.end();
    });
  }

  /**
   * Refund a settled transaction (full or partial)
   * POST /v2/pos/sales/refund
   * managerPassword must be RSA-PKCS1v1.5 encrypted with platformPublicKey
   */
  async refundTransaction(details: {
    outTradeNo: string;
    refundType: 1 | 2;           // 1=Card, 2=QR
    managerPassword: string;     // already encrypted by caller
    transactionNo?: string;      // required for QR (refundType=2)
    refNo?: string;              // required for Card (refundType=1)
    commitTime?: string;         // UTC ms, required for Card (refundType=1)
    refundAmount?: string;       // omit for full refund
    callbackUrl?: string;
  }): Promise<TestResult> {
    if (!this.config) return { success: false, message: 'Service not initialized', error: 'Configuration missing' };

    return new Promise((resolve) => {
      const timestamp = this.getTimestamp();
      const nonceStr = this.generateNonce();

      const bodyFields: Record<string, any> = {
        outTradeNo: details.outTradeNo,
        refundType: details.refundType,
        managerPassword: details.managerPassword,
      };
      if (details.transactionNo !== undefined) bodyFields.transactionNo = details.transactionNo;
      if (details.refNo !== undefined) bodyFields.refNo = details.refNo;
      if (details.commitTime !== undefined) bodyFields.commitTime = details.commitTime;
      if (details.refundAmount) bodyFields.refundAmount = details.refundAmount;
      if (details.callbackUrl) bodyFields.callbackUrl = details.callbackUrl;

      const bodyJson = JSON.stringify(bodyFields);
      let signature: string;
      try {
        signature = this.buildSignature('POST', '/v2/pos/sales/refund', timestamp, nonceStr, bodyJson);
      } catch (e: any) {
        resolve({ success: false, message: 'Signature error', error: e.message });
        return;
      }

      const options = {
        hostname: this.config!.terminalIp,
        port: this.config!.terminalPort,
        path: '/v2/pos/sales/refund',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyJson),
          'appId': this.config!.appId,
          'timestamp': timestamp,
          'nonceStr': nonceStr,
          'signature': signature,
        },
        timeout: 70000,
      };

      console.log(`[KPayTerminalService] Refunding transaction ${details.outTradeNo}`);
      this.log(`[KPayTerminalService] → POST /v2/pos/sales/refund  outTradeNo=${details.outTradeNo}  type=${details.refundType === 1 ? 'Card' : 'QR'}${details.refundAmount ? '  amount=' + details.refundAmount : ' (full)'}`);

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.code === 10000) {
              this.log(`[KPayTerminalService] ✅ Refund initiated`);
              resolve({ success: true, message: 'Refund transaction initiated', response });
            } else {
              const msg = response.message || 'Unknown error';
              this.log(`[KPayTerminalService] ❌ Refund failed: ${msg}`);
              resolve({ success: false, message: `Refund failed: ${msg}`, error: msg, response });
            }
          } catch (e: any) {
            resolve({ success: false, message: 'Invalid response format', error: e.message });
          }
        });
      });
      req.on('error', (e: any) => resolve({ success: false, message: 'Request error', error: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Refund timeout', error: 'No response within 65s' }); });
      req.write(bodyJson);
      req.end();
    });
  }

  /**
   * Encrypt a plain-text admin password using the platform public key (RSA-PKCS1v1.5 + SHA1)
   * Returns base64-encoded ciphertext ready to send in managerPassword field.
   */
  encryptManagerPassword(plainPassword: string): string {
    if (!this.platformPublicKey) throw new Error('No platform public key — perform key exchange first');
    const raw = this.platformPublicKey.replace(/\s+/g, '');
    const lines = raw.match(/.{1,64}/g)!.join('\n');
    const pem = `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
    const encrypted = crypto.publicEncrypt(
      { key: pem, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(plainPassword, 'utf8'),
    );
    return encrypted.toString('base64');
  }

  /**
   * Close an in-progress (pending) transaction to free the terminal
   * POST /v2/pos/sales/close
   */
  async closeTransaction(outTradeNo: string): Promise<TestResult> {
    if (!this.config) return { success: false, message: 'Service not initialized', error: 'Configuration missing' };

    return new Promise((resolve) => {
      const timestamp = this.getTimestamp();
      const nonceStr = this.generateNonce();

      const bodyJson = JSON.stringify({ outTradeNo });
      let signature: string;
      try {
        signature = this.buildSignature('POST', '/v2/pos/sales/close', timestamp, nonceStr, bodyJson);
      } catch (e: any) {
        resolve({ success: false, message: 'Signature error', error: e.message });
        return;
      }

      const options = {
        hostname: this.config!.terminalIp,
        port: this.config!.terminalPort,
        path: '/v2/pos/sales/close',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyJson),
          'appId': this.config!.appId,
          'timestamp': timestamp,
          'nonceStr': nonceStr,
          'signature': signature,
        },
        timeout: 15000,
      };

      console.log(`[KPayTerminalService] Closing transaction ${outTradeNo}`);
      this.log(`[KPayTerminalService] → POST /v2/pos/sales/close  outTradeNo=${outTradeNo}`);

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.code === 10000) {
              this.log(`[KPayTerminalService] ✅ Transaction closed`);
              resolve({ success: true, message: 'Transaction closed successfully', response });
            } else {
              const msg = response.message || 'Unknown error';
              this.log(`[KPayTerminalService] ❌ Close failed: ${msg}`);
              resolve({ success: false, message: `Close failed: ${msg}`, error: msg, response });
            }
          } catch (e: any) {
            resolve({ success: false, message: 'Invalid response format', error: e.message });
          }
        });
      });
      req.on('error', (e: any) => resolve({ success: false, message: 'Request error', error: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Close timeout', error: 'No response within 15s' }); });
      req.write(bodyJson);
      req.end();
    });
  }

  /**
   * Build request signature for payment transactions
   * Signs the request body using RSA with app private key
   * Not yet implemented - placeholder for future transaction signing
   */
  buildSignRequest(payload: any): string {
    // TODO: Implement RSA signing using appPrivateKey from key exchange
    // This would sign the payload for Sale, Cancel, Refund operations
    console.log('[KPayTerminalService] buildSignRequest not yet implemented');
    return '';
  }
}

// Export singleton instance
export const kpayTerminalService = new KPayTerminalService();
