/**
 * KPay Direct Terminal Service
 *
 * Communicates with the KPay terminal DIRECTLY from the mobile device using
 * React Native's fetch(). This is required because the backend server (Render)
 * runs in the cloud and cannot reach private LAN IPs (e.g. 192.168.x.x).
 * The mobile device IS on the restaurant LAN and can reach the terminal.
 *
 * Signing uses the Web Crypto API (crypto.subtle) available in Hermes / RN 0.73+.
 * Algorithm: RSASSA-PKCS1-v1_5 with SHA-256.
 * The appPrivateKey returned by the Sign endpoint is PKCS#8 DER base64-encoded.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateNonce(): string {
  return Math.random().toString(36).substring(2, 34).padEnd(32, '0');
}

function base64ToUint8Array(b64: string): Uint8Array {
  const cleaned = b64.replace(/\s+/g, '');
  const decoded = atob(cleaned);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
 * RSA-SHA256 sign (RSASSA-PKCS1-v1_5) using the Web Crypto API.
 * appPrivateKeyB64 is PKCS#8 DER base64, as returned by the KPay Sign endpoint.
 */
async function rsaSign(appPrivateKeyB64: string, canonical: string): Promise<string> {
  // crypto.subtle is available in React Native 0.73+ (Hermes)
  const subtle: SubtleCrypto = (globalThis.crypto as Crypto).subtle;
  const keyBytes = base64ToUint8Array(appPrivateKeyB64);

  const cryptoKey = await subtle.importKey(
    'pkcs8',
    keyBytes.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    false,
    ['sign'],
  );

  const dataBytes = new TextEncoder().encode(canonical);
  const sigBuf = await subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, cryptoKey, dataBytes);
  return arrayBufferToBase64(sigBuf);
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
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        timestamp,
        nonceStr,
      },
      body: JSON.stringify({ appId, appSecret }),
    });

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
    return {
      success: false,
      message: 'Cannot reach terminal',
      error: err.message,
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
    signature = await rsaSign(appPrivateKey, canonical);
  } catch (signErr: any) {
    return {
      success: false,
      message: 'RSA signature failed',
      outTradeNo,
      error: signErr.message,
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        appId,
        timestamp,
        nonceStr,
        signature,
      },
      body: bodyJson,
    });

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
    return {
      success: false,
      message: 'Cannot reach terminal',
      outTradeNo,
      error: err.message,
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
    signature = await rsaSign(appPrivateKey, canonical);
  } catch (signErr: any) {
    return {
      success: false,
      status: 'unknown',
      message: 'RSA signature failed',
      error: signErr.message,
    };
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        appId,
        timestamp,
        nonceStr,
        signature,
      },
    });

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
    return {
      success: false,
      status: 'unknown',
      message: 'Query request failed',
      error: err.message,
    };
  }
}
