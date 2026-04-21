/**
 * KPay Direct Terminal Service
 *
 * Communicates with the KPay terminal DIRECTLY from the mobile device using
 * React Native's fetch(). This is required because the backend server (Render)
 * runs in the cloud and cannot reach private LAN IPs (e.g. 192.168.x.x).
 * The mobile device IS on the restaurant LAN and can reach the terminal.
 *
 * Signing uses node-forge (pure JS RSA) because crypto.subtle is not available
 * in Hermes (React Native's JS engine).
 * Algorithm: RSASSA-PKCS1-v1_5 with SHA-256.
 * The appPrivateKey returned by the Sign endpoint is PKCS#8 DER base64-encoded.
 */

import forge from 'node-forge';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateNonce(): string {
  return Math.random().toString(36).substring(2, 34).padEnd(32, '0');
}

/**
 * Build the KPay canonical signing string.
 * POST/PUT: METHOD\nURL_PATH\nTIMESTAMP\nNONCE_STR\nBODY_JSON\n
 * GET:      METHOD\nURL_PATH_WITH_QUERY\nTIMESTAMP\nNONCE_STR\n
 */
function buildCanonical(
  method: string,
  urlPath: string,
  timestamp: string,
  nonceStr: string,
  body?: string,
): string {
  let s = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n`;
  if (body !== undefined) s += `${body}\n`;
  return s;
}

/**
 * RSA-SHA256 sign (RSASSA-PKCS1-v1_5) using node-forge (pure JS).
 * appPrivateKeyB64 is PKCS#8 DER base64, as returned by the KPay Sign endpoint.
 * node-forge handles both PKCS#8 (BEGIN PRIVATE KEY) and PKCS#1 formats.
 */
function rsaSign(appPrivateKeyB64: string, canonical: string): string {
  const b64 = appPrivateKeyB64.replace(/\s+/g, '');
  const lines = b64.match(/.{1,64}/g)!.join('\r\n');
  const pem = `-----BEGIN PRIVATE KEY-----\r\n${lines}\r\n-----END PRIVATE KEY-----`;

  const privateKey = forge.pki.privateKeyFromPem(pem) as forge.pki.rsa.PrivateKey;
  const md = forge.md.sha256.create();
  md.update(canonical, 'utf8');
  const signature = (privateKey as any).sign(md);
  return forge.util.encode64(signature);
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface KPayTerminalConfig {
  terminalIp: string;
  terminalPort: number;
  appId: string;
  appSecret: string;
  endpointPath?: string; // defaults to /v2/pos/sign
}

export interface KPaySignResult {
  success: boolean;
  message: string;
  appPrivateKey?: string;
  platformPublicKey?: string;
  error?: string;
}

export interface KPaySaleResult {
  success: boolean;
  message: string;
  outTradeNo: string;
  error?: string;
}

export type KPayTransactionStatus = 'pending' | 'success' | 'failed' | 'cancelled' | 'unknown';

export interface KPayStatusResult {
  success: boolean;
  status: KPayTransactionStatus;
  message: string;
  transactionNo?: string;
  refNo?: string;
  amount?: string;
  error?: string;
}

// ─── Internal fetch with timeout ─────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ─── Step 1: Sign (key exchange) — no RSA needed ─────────────────────────────

export async function kpaySign(config: KPayTerminalConfig): Promise<KPaySignResult> {
  const {
    terminalIp,
    terminalPort,
    appId,
    appSecret,
    endpointPath = '/v2/pos/sign',
  } = config;

  const url = `http://${terminalIp}:${terminalPort}${endpointPath}`;
  const timestamp = Date.now().toString();
  const nonceStr = generateNonce();

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        timestamp,
        nonceStr,
      },
      body: JSON.stringify({ appId, appSecret }),
    }, 10000);

    const data = await response.json();

    if (
      data.code === 10000 &&
      data.data?.appPrivateKey &&
      data.data?.platformPublicKey
    ) {
      return {
        success: true,
        message: 'Key exchange successful',
        appPrivateKey: data.data.appPrivateKey,
        platformPublicKey: data.data.platformPublicKey,
      };
    }

    return {
      success: false,
      message: data.message || 'Key exchange failed',
      error: `code=${data.code}`,
    };
  } catch (err: any) {
    const msg = err.name === 'AbortError' ? 'Timed out (10s) — terminal unreachable or wrong IP/port' : err.message;
    return {
      success: false,
      message: 'Cannot reach terminal',
      error: msg,
    };
  }
}

// ─── Step 2: Sale — signed POST ───────────────────────────────────────────────

/**
 * Initiate a sale transaction on the terminal.
 * payAmount must be a 12-digit zero-padded string in smallest currency unit (cents).
 */
export async function kpaySale(
  config: KPayTerminalConfig,
  appPrivateKey: string,
  outTradeNo: string,
  payAmount: string,
): Promise<KPaySaleResult> {
  const { terminalIp, terminalPort, appId } = config;
  const url = `http://${terminalIp}:${terminalPort}/v2/pos/sales`;
  const timestamp = Date.now().toString();
  const nonceStr = generateNonce();

  const bodyFields = {
    outTradeNo,
    payAmount,
    tipsAmount: '000000000000',
    payCurrency: '344', // HKD
  };
  const bodyJson = JSON.stringify(bodyFields);
  const canonical = buildCanonical('POST', '/v2/pos/sales', timestamp, nonceStr, bodyJson);

  let signature: string;
  try {
    signature = rsaSign(appPrivateKey, canonical);
  } catch (signErr: any) {
    return {
      success: false,
      message: 'RSA signature failed',
      outTradeNo,
      error: signErr.message,
    };
  }

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        appId,
        timestamp,
        nonceStr,
        signature,
      },
      body: bodyJson,
    }, 70000);  // KPay sale can take up to 65s (customer payment)

    const data = await response.json();

    if (data.code === 10000) {
      return { success: true, message: 'Sale initiated', outTradeNo };
    }
    return {
      success: false,
      message: data.message || 'Sale failed',
      outTradeNo,
      error: `code=${data.code}`,
    };
  } catch (err: any) {
    const msg = err.name === 'AbortError' ? 'Timed out (70s)' : err.message;
    return {
      success: false,
      message: 'Cannot reach terminal',
      outTradeNo,
      error: msg,
    };
  }
}

// ─── Step 3: Query status — signed GET ───────────────────────────────────────

/**
 * Query the current transaction status from the terminal.
 * The same appPrivateKey from Step 1 is reused (valid until terminal settlement).
 * Each call uses a fresh timestamp and nonce.
 */
export async function kpayQuery(
  config: KPayTerminalConfig,
  appPrivateKey: string,
  outTradeNo: string,
): Promise<KPayStatusResult> {
  const { terminalIp, terminalPort, appId } = config;
  const queryPath = `/v2/pos/query?outTradeNo=${encodeURIComponent(outTradeNo)}`;
  const url = `http://${terminalIp}:${terminalPort}${queryPath}`;
  const timestamp = Date.now().toString();
  const nonceStr = generateNonce();
  const canonical = buildCanonical('GET', queryPath, timestamp, nonceStr);

  let signature: string;
  try {
    signature = rsaSign(appPrivateKey, canonical);
  } catch (signErr: any) {
    return {
      success: false,
      status: 'unknown',
      message: 'RSA signature failed',
      error: signErr.message,
    };
  }

  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        appId,
        timestamp,
        nonceStr,
        signature,
      },
    }, 10000);

    const data = await response.json();

    if (data.code === 10000 && data.data) {
      const payResult: number = data.data.payResult;
      // payResult: 1=pending, 2=success, 3=failed, 4=cancelled
      const status: KPayTransactionStatus =
        payResult === 2 ? 'success' :
        payResult === 3 ? 'failed' :
        payResult === 4 ? 'cancelled' :
        'pending';

      return {
        success: true,
        status,
        message: `Transaction: ${status}`,
        transactionNo: data.data.transactionNo,
        refNo: data.data.refNo,
        amount: data.data.payAmount,
      };
    }

    // Non-10000 code on query usually means still pending (terminal busy)
    return {
      success: false,
      status: 'pending',
      message: data.message || 'Query returned non-success code',
      error: `code=${data.code}`,
    };
  } catch (err: any) {
    const msg = err.name === 'AbortError' ? 'Timed out (10s) — terminal unreachable' : err.message;
    return {
      success: false,
      status: 'pending',  // treat timeout as pending — retry on next poll
      message: 'Query request failed',
      error: msg,
    };
  }
}

// ─── Step 4: Close (abort in-progress sale) ───────────────────────────────────

export interface KPaySimpleResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Close (abort) an in-progress sale on the terminal.
 * Use this when the customer doesn't pay and you want to free the terminal.
 * POST /v2/pos/sales/close  —  signed with appPrivateKey.
 */
export async function kpayClose(
  config: KPayTerminalConfig,
  appPrivateKey: string,
  outTradeNo: string,
): Promise<KPaySimpleResult> {
  const { terminalIp, terminalPort, appId } = config;
  const url = `http://${terminalIp}:${terminalPort}/v2/pos/sales/close`;
  const timestamp = Date.now().toString();
  const nonceStr = generateNonce();
  const bodyJson = JSON.stringify({ outTradeNo });
  const canonical = buildCanonical('POST', '/v2/pos/sales/close', timestamp, nonceStr, bodyJson);

  let signature: string;
  try {
    signature = rsaSign(appPrivateKey, canonical);
  } catch (e: any) {
    return { success: false, message: 'RSA signature failed', error: e.message };
  }

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', appId, timestamp, nonceStr, signature },
      body: bodyJson,
    }, 10000);
    const data = await response.json();
    if (data.code === 10000) return { success: true, message: 'Transaction closed' };
    return { success: false, message: data.message || 'Close failed', error: `code=${data.code}` };
  } catch (err: any) {
    const msg = err.name === 'AbortError' ? 'Timed out (10s)' : err.message;
    return { success: false, message: 'Close request failed', error: msg };
  }
}

// ─── Step 5: Void (cancel a completed same-day unsettled transaction) ─────────

/**
 * Encrypt the manager password using the platformPublicKey (RSA-PKCS1-v1.5, SHA-1).
 * Required for void and refund.
 */
export function encryptManagerPassword(platformPublicKeyB64: string, password: string): string {
  const b64 = platformPublicKeyB64.replace(/\s+/g, '');
  const lines = b64.match(/.{1,64}/g)!.join('\r\n');
  const pem = `-----BEGIN PUBLIC KEY-----\r\n${lines}\r\n-----END PUBLIC KEY-----`;
  const publicKey = forge.pki.publicKeyFromPem(pem) as forge.pki.rsa.PublicKey;
  const encrypted = publicKey.encrypt(password, 'RSAES-PKCS1-V1_5', {
    md: forge.md.sha1.create(),
    mgf: (forge.mgf as any).mgf1.create(forge.md.sha1.create()),
  });
  return forge.util.encode64(encrypted);
}

/**
 * Void (cancel) a completed but unsettled same-day transaction.
 * POST /v2/pos/sales/cancel  —  signed with appPrivateKey.
 * managerPassword should already be RSA-encrypted via encryptManagerPassword().
 */
export async function kpayVoid(
  config: KPayTerminalConfig,
  appPrivateKey: string,
  outTradeNo: string,           // new unique order number for this void
  originOutTradeNo: string,     // the original sale's outTradeNo
  encryptedManagerPassword: string,
): Promise<KPaySimpleResult> {
  const { terminalIp, terminalPort, appId } = config;
  const url = `http://${terminalIp}:${terminalPort}/v2/pos/sales/cancel`;
  const timestamp = Date.now().toString();
  const nonceStr = generateNonce();
  const bodyJson = JSON.stringify({ outTradeNo, originOutTradeNo, managerPassword: encryptedManagerPassword });
  const canonical = buildCanonical('POST', '/v2/pos/sales/cancel', timestamp, nonceStr, bodyJson);

  let signature: string;
  try {
    signature = rsaSign(appPrivateKey, canonical);
  } catch (e: any) {
    return { success: false, message: 'RSA signature failed', error: e.message };
  }

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', appId, timestamp, nonceStr, signature },
      body: bodyJson,
    }, 30000);
    const data = await response.json();
    if (data.code === 10000) return { success: true, message: 'Void successful' };
    return { success: false, message: data.message || 'Void failed', error: `code=${data.code}` };
  } catch (err: any) {
    const msg = err.name === 'AbortError' ? 'Timed out (30s)' : err.message;
    return { success: false, message: 'Void request failed', error: msg };
  }
}

// ─── Step 6: Refund (settled transaction) ────────────────────────────────────

export interface KPayRefundParams {
  outTradeNo: string;           // new unique order number for this refund
  refundType: 1 | 2;           // 1=Card, 2=QR
  encryptedManagerPassword: string;
  // QR refund (refundType=2):
  transactionNo?: string;
  // Card refund (refundType=1):
  refNo?: string;
  commitTime?: string;          // UTC ms timestamp string
  // Optional partial refund (12-digit padded cents); omit for full refund:
  refundAmount?: string;
}

/**
 * Refund a settled transaction.
 * POST /v2/pos/sales/refund  —  signed with appPrivateKey.
 */
export async function kpayRefund(
  config: KPayTerminalConfig,
  appPrivateKey: string,
  params: KPayRefundParams,
): Promise<KPaySimpleResult> {
  const { terminalIp, terminalPort, appId } = config;
  const url = `http://${terminalIp}:${terminalPort}/v2/pos/sales/refund`;
  const timestamp = Date.now().toString();
  const nonceStr = generateNonce();

  const body: Record<string, any> = {
    outTradeNo: params.outTradeNo,
    refundType: params.refundType,
    managerPassword: params.encryptedManagerPassword,
  };
  if (params.transactionNo) body.transactionNo = params.transactionNo;
  if (params.refNo) body.refNo = params.refNo;
  if (params.commitTime) body.commitTime = params.commitTime;
  if (params.refundAmount) body.refundAmount = params.refundAmount;

  const bodyJson = JSON.stringify(body);
  const canonical = buildCanonical('POST', '/v2/pos/sales/refund', timestamp, nonceStr, bodyJson);

  let signature: string;
  try {
    signature = rsaSign(appPrivateKey, canonical);
  } catch (e: any) {
    return { success: false, message: 'RSA signature failed', error: e.message };
  }

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', appId, timestamp, nonceStr, signature },
      body: bodyJson,
    }, 30000);
    const data = await response.json();
    if (data.code === 10000) return { success: true, message: 'Refund successful' };
    return { success: false, message: data.message || 'Refund failed', error: `code=${data.code}` };
  } catch (err: any) {
    const msg = err.name === 'AbortError' ? 'Timed out (30s)' : err.message;
    return { success: false, message: 'Refund request failed', error: msg };
  }
}

// ─── Direct history query: Sign + Query in one shot ──────────────────────────

/**
 * Normalized transaction details as returned by kpayQueryDirect.
 * Shape matches the kpayTxDetails state used in OrdersTab / TablesTab UI.
 */
export interface KPayTxDetails {
  success: boolean;
  outTradeNo: string;
  payResult: number | null;        // 1=pending 2=success 3=failed 4=refunded 5=cancelled
  payAmount: string | null;        // zero-padded cents string, e.g. "000000001000" = HKD 10.00
  payCurrency: string | null;
  transactionNo: string | null;
  refNo: string | null;
  commitTime: string | null;
  payMethod: number | null;
  status: string;                  // human-readable derived label
  error?: string;
}

const PAYRESULT_STATUS: Record<number, string> = {
  1: 'Pending', 2: 'Success', 3: 'Failed', 4: 'Refunded', 5: 'Cancelled', 6: 'Cancelled',
};

/**
 * Perform a Sign + Query against the terminal in one call.
 * Use this for order history views where no cached appPrivateKey is available.
 * Returns data in the kpayTxDetails shape.
 */
export async function kpayQueryDirect(
  config: KPayTerminalConfig,
  outTradeNo: string,
): Promise<KPayTxDetails> {
  const base: KPayTxDetails = {
    success: false,
    outTradeNo,
    payResult: null,
    payAmount: null,
    payCurrency: null,
    transactionNo: null,
    refNo: null,
    commitTime: null,
    payMethod: null,
    status: 'Unknown',
  };

  // Step 1: Key exchange
  const signResult = await kpaySign(config);
  if (!signResult.success || !signResult.appPrivateKey) {
    return { ...base, error: signResult.error || signResult.message };
  }

  // Step 2: Query
  const { terminalIp, terminalPort, appId } = config;
  const queryPath = `/v2/pos/query?outTradeNo=${encodeURIComponent(outTradeNo)}`;
  const url = `http://${terminalIp}:${terminalPort}${queryPath}`;
  const timestamp = Date.now().toString();
  const nonceStr = generateNonce();
  const canonical = buildCanonical('GET', queryPath, timestamp, nonceStr);
  const signature = rsaSign(signResult.appPrivateKey, canonical);

  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { appId, timestamp, nonceStr, signature },
    }, 10000);
    const data = await response.json();

    if (data.code === 10000 && data.data) {
      const d = data.data;
      const payResult: number = d.payResult ?? null;
      return {
        success: true,
        outTradeNo: d.outTradeNo || d.outTradeNO || outTradeNo,
        payResult,
        payAmount: d.payAmount || d.amount || null,
        payCurrency: d.payCurrency || d.currency || 'HKD',
        transactionNo: d.transactionNo || null,
        refNo: d.refNo || null,
        commitTime: d.commitTime || null,
        payMethod: d.payMethod ?? null,
        status: PAYRESULT_STATUS[payResult] || 'Unknown',
      };
    }

    return { ...base, error: `code=${data.code}: ${data.message || ''}` };
  } catch (err: any) {
    const msg = err.name === 'AbortError' ? 'Timed out (10s)' : err.message;
    return { ...base, error: msg };
  }
}
