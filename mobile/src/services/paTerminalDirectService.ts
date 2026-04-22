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
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.apiKey,
      },
      body: JSON.stringify({ api_key: config.apiKey }),
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': config.apiKey,
    };
    if (sessionToken) headers['X-Session-Token'] = sessionToken;

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        api_key: config.apiKey,
        trade_no: tradeNo,
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': config.apiKey,
    };
    if (sessionToken) headers['X-Session-Token'] = sessionToken;

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
