/**
 * Payment Asia POS Terminal Direct Service
 *
 * Communicates with the Payment Asia physical terminal DIRECTLY from the
 * mobile device over LAN. The backend (Render) cannot reach private LAN IPs.
 *
 * PA Terminal API:
 *  - Enable API mode on terminal: Settings → API → Enable
 *  - Terminal shows: IP address, Port, API Key
 *  - Base URL: http://{ip}:{port}
 *  - Auth: API Key sent as X-Api-Key header (or as `api_key` in body — TBD per terminal firmware)
 *  - Sign step: POST /api/sign    → exchanges credentials, returns session token
 *  - Sale step: POST /api/sale    → initiates payment
 *  - Query step: GET /api/query   → polls payment status
 *
 * NOTE: The exact endpoint paths and payload format depend on the terminal's
 * firmware version. These are sensible defaults; update if your terminal uses
 * different paths (configurable via `endpointPath` in terminal settings).
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PATerminalConfig {
  terminalIp: string;
  terminalPort: number;
  apiKey: string;
}

export interface PATerminalSignResult {
  success: boolean;
  message: string;
  sessionToken?: string;
  error?: string;
}

export interface PATerminalSaleResult {
  success: boolean;
  message: string;
  tradeNo?: string;
  error?: string;
}

export interface PATerminalActionResult {
  success: boolean;
  message: string;
  tradeNo?: string;
  error?: string;
  raw?: Record<string, any>;
}

export type PATerminalStatus = 'pending' | 'success' | 'failed' | 'cancelled' | 'unknown';

export interface PATerminalQueryResult {
  success: boolean;
  status: PATerminalStatus;
  message: string;
  terminalMessage?: string;
  tradeNo?: string;
  amount?: string;
  raw?: Record<string, any>;
  error?: string;
}

// ─── Fetch with timeout ────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function baseUrl(config: PATerminalConfig): string {
  return `http://${config.terminalIp}:${config.terminalPort}`;
}

function terminalHeaders(config: PATerminalConfig, sessionToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Api-Key': config.apiKey,
    'X-Merchant-Token': config.apiKey,
  };
  if (sessionToken) headers['X-Session-Token'] = sessionToken;
  return headers;
}

// ─── Ping ──────────────────────────────────────────────────────────────────

export async function paTerminalPing(config: PATerminalConfig): Promise<PATerminalActionResult> {
  const endpoints = ['/api/ping', '/ping'];
  let lastError = 'ping_failed';

  for (const endpoint of endpoints) {
    try {
      const res = await fetchWithTimeout(`${baseUrl(config)}${endpoint}`, {
        method: 'GET',
        headers: terminalHeaders(config),
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { /* non-JSON */ }

      if (!res.ok) {
        lastError = text || `HTTP ${res.status}`;
        continue;
      }

      return {
        success: true,
        message: data.message || `Ping successful (${endpoint})`,
        raw: data,
      };
    } catch (err: any) {
      lastError = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'ping_failed');
    }
  }

  return { success: false, message: 'Ping failed', error: lastError };
}

// ─── Sign (session key exchange / auth) ────────────────────────────────────

/**
 * Perform key exchange / authentication with the PA terminal.
 * Returns a session token if the terminal uses one; otherwise confirms connectivity.
 */
export async function paTerminalSign(config: PATerminalConfig): Promise<PATerminalSignResult> {
  try {
    const url = `${baseUrl(config)}/api/sign`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: terminalHeaders(config),
      body: JSON.stringify({ api_key: config.apiKey, merchant_token: config.apiKey }),
    });

    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* non-JSON response */ }

    if (!res.ok) {
      return { success: false, message: `HTTP ${res.status}`, error: text };
    }

    // Terminal may return a session_token, token, or just 200 OK
    const token = data.session_token || data.token || data.sessionToken || null;
    return {
      success: true,
      message: data.message || 'Sign successful',
      sessionToken: token || undefined,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, message: 'Connection timed out', error: 'timeout' };
    }
    return { success: false, message: err.message, error: err.message };
  }
}

// ─── Sale ──────────────────────────────────────────────────────────────────

/**
 * Initiate a sale on the PA terminal.
 * @param tradeNo  Unique merchant reference (e.g. "ORD-1-2-1234567890")
 * @param amountCents  Amount in cents / smallest currency unit (e.g. "000000010000" = HKD 100.00)
 * @param sessionToken  Optional session token from sign step
 */
export async function paTerminalSale(
  config: PATerminalConfig,
  tradeNo: string,
  amountCents: string,
  sessionToken?: string,
): Promise<PATerminalSaleResult> {
  try {
    const url = `${baseUrl(config)}/api/sale`;
    const headers = terminalHeaders(config, sessionToken);

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        api_key: config.apiKey,
        merchant_token: config.apiKey,
        trade_no: tradeNo,
        out_trade_no: tradeNo,
        amount: amountCents,
        currency: '344', // HKD
      }),
    });

    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* non-JSON */ }

    if (!res.ok) {
      return { success: false, message: `HTTP ${res.status}`, tradeNo, error: text };
    }

    // Expect status 0 = success / initiated, or similar
    const code = data.code ?? data.status ?? 0;
    if (code !== 0 && code !== '0' && code !== 'success') {
      return { success: false, message: data.message || `Error code ${code}`, tradeNo, error: String(code) };
    }

    return { success: true, message: data.message || 'Sale initiated', tradeNo };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, message: 'Connection timed out', tradeNo, error: 'timeout' };
    }
    return { success: false, message: err.message, tradeNo, error: err.message };
  }
}

// ─── Query ─────────────────────────────────────────────────────────────────

/**
 * Query the status of a pending PA terminal payment.
 * PA terminals typically return:
 *   status: 0=pending, 1=success, 2=failed, 3=cancelled
 */
export async function paTerminalQuery(
  config: PATerminalConfig,
  tradeNo: string,
  sessionToken?: string,
): Promise<PATerminalQueryResult> {
  try {
    const url = `${baseUrl(config)}/api/query?trade_no=${encodeURIComponent(tradeNo)}`;
    const headers = terminalHeaders(config, sessionToken);

    const res = await fetchWithTimeout(url, { method: 'GET', headers });
    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* non-JSON */ }

    if (!res.ok) {
      return { success: false, status: 'unknown', message: `HTTP ${res.status}`, error: text };
    }

    const code = Number(data.status ?? data.code ?? data.pay_status ?? -1);
    let status: PATerminalStatus = 'pending';
    if (code === 1 || data.status === 'success') status = 'success';
    else if (code === 2 || data.status === 'failed') status = 'failed';
    else if (code === 3 || data.status === 'cancelled') status = 'cancelled';

    return {
      success: true,
      status,
      message: data.message || `Status: ${status}`,
      terminalMessage: data.reason || data.description || undefined,
      tradeNo: data.trade_no || tradeNo,
      amount: data.amount ? String(data.amount) : undefined,
      raw: data,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, status: 'unknown', message: 'Query timed out', error: 'timeout' };
    }
    return { success: false, status: 'unknown', message: err.message, error: err.message };
  }
}

// ─── Cancel / Void / Refund ────────────────────────────────────────────────

export async function paTerminalCancel(
  config: PATerminalConfig,
  tradeNo: string,
  sessionToken?: string,
): Promise<PATerminalActionResult> {
  try {
    const res = await fetchWithTimeout(`${baseUrl(config)}/api/cancel`, {
      method: 'POST',
      headers: terminalHeaders(config, sessionToken),
      body: JSON.stringify({
        api_key: config.apiKey,
        merchant_token: config.apiKey,
        trade_no: tradeNo,
        out_trade_no: tradeNo,
      }),
    });

    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* non-JSON */ }

    if (!res.ok) {
      return { success: false, message: `HTTP ${res.status}`, tradeNo, error: text };
    }

    return {
      success: true,
      message: data.message || 'Cancel submitted',
      tradeNo,
      raw: data,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, message: 'Cancel timed out', tradeNo, error: 'timeout' };
    }
    return { success: false, message: err.message, tradeNo, error: err.message };
  }
}

export async function paTerminalVoid(
  config: PATerminalConfig,
  tradeNo: string,
  sessionToken?: string,
): Promise<PATerminalActionResult> {
  try {
    const res = await fetchWithTimeout(`${baseUrl(config)}/api/void`, {
      method: 'POST',
      headers: terminalHeaders(config, sessionToken),
      body: JSON.stringify({
        api_key: config.apiKey,
        merchant_token: config.apiKey,
        trade_no: tradeNo,
        out_trade_no: tradeNo,
      }),
    });

    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* non-JSON */ }

    if (!res.ok) {
      return { success: false, message: `HTTP ${res.status}`, tradeNo, error: text };
    }

    return {
      success: true,
      message: data.message || 'Void submitted',
      tradeNo,
      raw: data,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, message: 'Void timed out', tradeNo, error: 'timeout' };
    }
    return { success: false, message: err.message, tradeNo, error: err.message };
  }
}

export async function paTerminalRefund(
  config: PATerminalConfig,
  tradeNo: string,
  amount: string,
  sessionToken?: string,
): Promise<PATerminalActionResult> {
  try {
    const res = await fetchWithTimeout(`${baseUrl(config)}/api/refund`, {
      method: 'POST',
      headers: terminalHeaders(config, sessionToken),
      body: JSON.stringify({
        api_key: config.apiKey,
        merchant_token: config.apiKey,
        trade_no: tradeNo,
        out_trade_no: tradeNo,
        amount,
        currency: '344',
      }),
    });

    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* non-JSON */ }

    if (!res.ok) {
      return { success: false, message: `HTTP ${res.status}`, tradeNo, error: text };
    }

    return {
      success: true,
      message: data.message || 'Refund submitted',
      tradeNo,
      raw: data,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, message: 'Refund timed out', tradeNo, error: 'timeout' };
    }
    return { success: false, message: err.message, tradeNo, error: err.message };
  }
}

// ─── PA Offline Physical Terminal API (correct endpoints) ──────────────────
//
// The PA Offline physical POS terminal uses a REST API authenticated via
// `x-api-key` header. Endpoints match the backend implementation.
// Note: Some terminal firmware uses HTTPS with a self-signed cert; we attempt
// HTTP here since the device calls from within the restaurant LAN.

function paOfflineBaseUrl(config: PATerminalConfig): string {
  return `http://${config.terminalIp}:${config.terminalPort}`;
}

function paOfflineHeaders(config: PATerminalConfig): Record<string, string> {
  return {
    'x-api-key': config.apiKey,
    'Content-Type': 'application/json',
  };
}

/**
 * Create a payment order on the PA Offline terminal.
 * @param amountDollars  Decimal dollar amount, e.g. "10.50" for HKD 10.50
 */
export async function paOfflineCreateOrder(
  config: PATerminalConfig,
  orderId: string,
  amountDollars: string,
): Promise<PATerminalActionResult> {
  try {
    const res = await fetchWithTimeout(`${paOfflineBaseUrl(config)}/order/create`, {
      method: 'POST',
      headers: paOfflineHeaders(config),
      body: JSON.stringify({ order_id: orderId, amount: amountDollars, payment_method: 'QR_CODE' }),
    });
    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* non-JSON */ }

    if (!res.ok || data?.code !== '1000') {
      return { success: false, message: data?.message || `HTTP ${res.status}`, tradeNo: orderId, error: text };
    }
    return { success: true, message: data.message || 'Order created', tradeNo: orderId, raw: data };
  } catch (err: any) {
    const msg = err.name === 'AbortError' ? 'Timed out — terminal unreachable or wrong IP/port' : err.message;
    return { success: false, message: msg, tradeNo: orderId, error: msg };
  }
}

/**
 * Query a PA Offline terminal payment status.
 * Mapped status: payload.status === '1' → success, '2' → failed, '-1'/'4' → cancelled, else pending.
 */
export async function paOfflineQueryOrder(
  config: PATerminalConfig,
  orderId: string,
): Promise<PATerminalQueryResult> {
  try {
    const res = await fetchWithTimeout(`${paOfflineBaseUrl(config)}/order/query`, {
      method: 'POST',
      headers: paOfflineHeaders(config),
      body: JSON.stringify({ order_id: orderId }),
    });
    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* non-JSON */ }

    if (!res.ok || data?.code !== '1000') {
      return { success: false, status: 'pending', message: data?.message || `HTTP ${res.status}`, error: text };
    }
    const payload = data.payload || {};
    const paStatus = String(payload.status ?? '0');
    let status: PATerminalStatus = 'pending';
    if (paStatus === '1') status = 'success';
    else if (paStatus === '2') status = 'failed';
    else if (paStatus === '-1' || paStatus === '3') status = 'cancelled';
    // NOTE: status '4' is intentionally NOT mapped to cancelled — its meaning is
    // ambiguous (some firmware uses it for "settled/completed"). Keep polling.

    return {
      success: true,
      status,
      message: payload.message || `Status: ${status} (raw=${paStatus})`,
      tradeNo: orderId,
      raw: { ...payload, _paStatus: paStatus, _code: data.code },
    };
  } catch (err: any) {
    const msg = err.name === 'AbortError' ? 'Query timed out' : err.message;
    return { success: false, status: 'pending', message: msg, error: msg };
  }
}

/**
 * Void (cancel) an in-progress PA Offline terminal order.
 */
export async function paOfflineVoidOrder(
  config: PATerminalConfig,
  orderId: string,
): Promise<PATerminalActionResult> {
  try {
    const res = await fetchWithTimeout(`${paOfflineBaseUrl(config)}/order/void`, {
      method: 'POST',
      headers: paOfflineHeaders(config),
      body: JSON.stringify({ order_id: orderId }),
    });
    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* non-JSON */ }

    const success = res.ok && data?.code === '1000';
    return {
      success,
      message: data?.message || (success ? 'Order voided' : 'Void failed'),
      tradeNo: orderId,
      raw: data,
    };
  } catch (err: any) {
    const msg = err.name === 'AbortError' ? 'Void timed out' : err.message;
    return { success: false, message: msg, tradeNo: orderId, error: msg };
  }
}

/**
 * Refund a settled PA Offline terminal payment.
 * Calls POST /order/refund — terminal processes the refund interactively.
 * @param amountDollars  Optional decimal dollar amount for partial refund; omit for full refund.
 */
export async function paOfflineRefundOrder(
  config: PATerminalConfig,
  orderId: string,
  amountDollars?: string,
): Promise<PATerminalActionResult> {
  try {
    const body: Record<string, any> = { order_id: orderId };
    if (amountDollars) body.amount = amountDollars;
    const res = await fetchWithTimeout(`${paOfflineBaseUrl(config)}/order/refund`, {
      method: 'POST',
      headers: paOfflineHeaders(config),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* non-JSON */ }

    const success = res.ok && data?.code === '1000';
    return {
      success,
      message: data?.message || (success ? 'Refund successful' : 'Refund failed'),
      tradeNo: orderId,
      raw: data,
    };
  } catch (err: any) {
    const msg = err.name === 'AbortError' ? 'Refund timed out' : err.message;
    return { success: false, message: msg, tradeNo: orderId, error: msg };
  }
}
