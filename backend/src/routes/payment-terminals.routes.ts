/**
 * Payment Terminal Routes
 * Manages CRUD operations and connectivity tests for payment terminals
 * Supports KPay and other payment vendors
 */

import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { kpayTerminalService } from '../services/kpayTerminalService';
import { paymentAsiaService } from '../services/paymentAsiaService';
import jwt from 'jsonwebtoken';

const router = Router();

// Auth helper: verifies JWT and returns user info
const verifyUser = async (req: Request): Promise<{ id: number; role: string; restaurant_id: number | null } | null> => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return null;
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
    const result = await pool.query("SELECT id, role, restaurant_id FROM users WHERE id = $1", [decoded.id]);
    if (!result.rows.length) return null;
    const user = result.rows[0];
    if (user.role !== "admin" && user.role !== "superadmin") return null;
    return user;
  } catch {
    return null;
  }
};

/**
 * GET /api/restaurants/:restaurantId/payment-terminals
 * Fetch all payment terminals for a restaurant
 */
router.get('/restaurants/:restaurantId/payment-terminals', async (req, res) => {
  const user = await verifyUser(req);
  if (!user) return res.status(403).json({ error: 'Admin access required' });
  try {
    const { restaurantId } = req.params;
    
    const result = await pool.query(
      `SELECT id, vendor_name, is_active, app_id, terminal_ip, terminal_port, 
              endpoint_path, metadata, last_tested_at, last_error_message,
              created_at, updated_at
       FROM payment_terminals
       WHERE restaurant_id = $1
       ORDER BY created_at DESC`,
      [restaurantId]
    );

    res.json(result.rows || []);
  } catch (err: any) {
    console.error('[PaymentTerminal] Error fetching terminals:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/restaurants/:restaurantId/payment-terminals/:terminalId
 * Fetch a specific payment terminal
 */
router.get('/restaurants/:restaurantId/payment-terminals/:terminalId', async (req, res) => {
  const user = await verifyUser(req);
  if (!user) return res.status(403).json({ error: 'Admin access required' });
  try {
    const { restaurantId, terminalId } = req.params;
    
    const result = await pool.query(
      `SELECT id, vendor_name, is_active, app_id, app_secret, terminal_ip, 
              terminal_port, endpoint_path, metadata, last_tested_at, 
              last_error_message, created_at, updated_at
       FROM payment_terminals
       WHERE id = $1 AND restaurant_id = $2`,
      [terminalId, restaurantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Payment terminal not found' });
    }

    const terminal = result.rows[0];
    // Non-superadmins should not see secrets
    if (user.role !== 'superadmin') {
      terminal.app_secret = terminal.app_secret ? '••••••••' : '';
    }

    res.json(terminal);
  } catch (err: any) {
    console.error('[PaymentTerminal] Error fetching terminal:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/restaurants/:restaurantId/payment-terminals
 * Create a new payment terminal configuration
 * Body: { vendor_name, app_id, app_secret, terminal_ip, terminal_port, endpoint_path?, metadata? }
 */
router.post('/restaurants/:restaurantId/payment-terminals', async (req, res) => {
  const user = await verifyUser(req);
  if (!user || user.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin access required' });
  try {
    const { restaurantId } = req.params;
    const { vendor_name, app_id, app_secret, terminal_ip, terminal_port, endpoint_path, metadata } = req.body;

    // Validate required fields
    if (!vendor_name || !app_id || !app_secret || !terminal_ip || !terminal_port) {
      return res.status(400).json({
        error: 'Missing required fields: vendor_name, app_id, app_secret, terminal_ip, terminal_port',
      });
    }

    // Validate vendor name
    const validVendors = ['kpay', 'other'];
    if (!validVendors.includes(vendor_name)) {
      return res.status(400).json({
        error: `Invalid vendor_name. Must be one of: ${validVendors.join(', ')}`,
      });
    }

    // Check for duplicate vendor configuration
    const existingResult = await pool.query(
      'SELECT id FROM payment_terminals WHERE restaurant_id = $1 AND vendor_name = $2',
      [restaurantId, vendor_name]
    );

    if (existingResult.rowCount && existingResult.rowCount > 0) {
      return res.status(409).json({
        error: `Payment terminal for vendor '${vendor_name}' already exists for this restaurant`,
      });
    }

    const result = await pool.query(
      `INSERT INTO payment_terminals 
       (restaurant_id, vendor_name, app_id, app_secret, terminal_ip, terminal_port, endpoint_path, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, vendor_name, is_active, app_id, terminal_ip, terminal_port, endpoint_path, 
                 metadata, created_at, updated_at`,
      [restaurantId, vendor_name, app_id, app_secret, terminal_ip, terminal_port, endpoint_path || '/v2/pos/sign', metadata || {}]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('[PaymentTerminal] Error creating terminal:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/restaurants/:restaurantId/payment-terminals/:terminalId
 * Update a payment terminal configuration
 */
router.patch('/restaurants/:restaurantId/payment-terminals/:terminalId', async (req, res) => {
  const user = await verifyUser(req);
  if (!user) return res.status(403).json({ error: 'Admin access required' });

  // Non-superadmins can only update connection details
  const adminAllowedFields = ['terminal_ip', 'terminal_port', 'endpoint_path'];
  if (user.role !== 'superadmin') {
    const requestedFields = Object.keys(req.body);
    const disallowed = requestedFields.filter(f => !adminAllowedFields.includes(f));
    if (disallowed.length > 0) {
      return res.status(403).json({ error: `Only superadmin can modify: ${disallowed.join(', ')}` });
    }
  }
  try {
    const { restaurantId, terminalId } = req.params;
    const { vendor_name, app_id, app_secret, terminal_ip, terminal_port, endpoint_path, metadata, is_active } = req.body;

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (app_id !== undefined) {
      updates.push(`app_id = $${paramCount++}`);
      values.push(app_id);
    }
    if (app_secret !== undefined) {
      updates.push(`app_secret = $${paramCount++}`);
      values.push(app_secret);
    }
    if (terminal_ip !== undefined) {
      updates.push(`terminal_ip = $${paramCount++}`);
      values.push(terminal_ip);
    }
    if (terminal_port !== undefined) {
      updates.push(`terminal_port = $${paramCount++}`);
      values.push(terminal_port);
    }
    if (endpoint_path !== undefined) {
      updates.push(`endpoint_path = $${paramCount++}`);
      values.push(endpoint_path);
    }
    if (metadata !== undefined) {
      updates.push(`metadata = $${paramCount++}::jsonb`);
      values.push(metadata);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(terminalId);
    values.push(restaurantId);

    const result = await pool.query(
      `UPDATE payment_terminals 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount} AND restaurant_id = $${paramCount + 1}
       RETURNING id, vendor_name, is_active, app_id, terminal_ip, terminal_port, 
                 endpoint_path, metadata, last_tested_at, last_error_message, created_at, updated_at`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Payment terminal not found' });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[PaymentTerminal] Error updating terminal:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/restaurants/:restaurantId/payment-terminals/:terminalId
 * Delete a payment terminal configuration
 */
router.delete('/restaurants/:restaurantId/payment-terminals/:terminalId', async (req, res) => {
  const user = await verifyUser(req);
  if (!user || user.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin access required' });
  try {
    const { restaurantId, terminalId } = req.params;

    const result = await pool.query(
      'DELETE FROM payment_terminals WHERE id = $1 AND restaurant_id = $2 RETURNING id',
      [terminalId, restaurantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Payment terminal not found' });
    }

    res.json({ success: true, message: 'Payment terminal deleted successfully' });
  } catch (err: any) {
    console.error('[PaymentTerminal] Error deleting terminal:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/restaurants/:restaurantId/payment-terminals/:terminalId/test
 * Test connection to a payment terminal OR process a payment transaction
 * 
 * Without body: Sends a sign request to verify credentials and connectivity (key exchange test)
 * With payAmount: Performs full transaction (Sign → Sale → returns reference for polling)
 * 
 * Body (optional):
 * {
 *   payAmount: "000000000130",     // 12-digit padded cents amount
 *   tipsAmount: "000000000000",    // Optional tip
 *   payCurrency: "344"             // Currency code (HKD=344)
 * }
 */
router.post('/restaurants/:restaurantId/payment-terminals/:terminalId/test', async (req, res) => {
  try {
    const { restaurantId, terminalId } = req.params;
    const { payAmount, tipsAmount, payCurrency, description, customerName } = req.body;

    // Fetch the terminal configuration
    const terminalResult = await pool.query(
      `SELECT id, vendor_name, app_id, app_secret, terminal_ip, terminal_port, endpoint_path
       FROM payment_terminals
       WHERE id = $1 AND restaurant_id = $2`,
      [terminalId, restaurantId]
    );

    if (terminalResult.rowCount === 0) {
      return res.status(404).json({ error: 'Payment terminal not found' });
    }

    const terminal = terminalResult.rows[0];

    // Handle based on vendor
    if (terminal.vendor_name === 'kpay') {
      try {
        // Initialize KPay service with terminal config
        kpayTerminalService.initialize({
          appId: terminal.app_id,
          appSecret: terminal.app_secret,
          terminalIp: terminal.terminal_ip,
          terminalPort: terminal.terminal_port,
          endpointPath: terminal.endpoint_path || '/v2/pos/sign',
        });

        // If no amount provided, just test connectivity (key exchange)
        if (!payAmount) {
          const testResult = await kpayTerminalService.testConnection();
          const now = new Date();

          const updateQuery = testResult.success
            ? `UPDATE payment_terminals SET last_tested_at = $1 WHERE id = $2`
            : `UPDATE payment_terminals SET last_error_message = $1, updated_at = $2 WHERE id = $3`;

          if (testResult.success) {
            await pool.query(updateQuery, [now, terminalId]);
          } else {
            await pool.query(updateQuery, [testResult.error || testResult.message, now, terminalId]);
          }

          return res.json({
            success: testResult.success,
            message: testResult.message,
            response: testResult.response,
            error: testResult.error,
            timestamp: now,
          });
        }

        // Full payment flow: Sign (already initialized) → Sale → Store transaction
        console.log(`[PaymentTerminal] Processing payment: ${payAmount} ${payCurrency}`);

        // Step 1: Sign (key exchange) - already done during initialize
        const signResult = await kpayTerminalService.testConnection();
        const signLogs = kpayTerminalService.flushLogs();
        if (!signResult.success) {
          return res.status(400).json({
            success: false,
            status: 'failed',
            code: 10001,
            message: 'Key exchange failed: ' + signResult.message,
            error: signResult.error,
            logs: signLogs,
          });
        }

        // Step 2: Initiate sale transaction
        const outTradeNo = `ORD-${restaurantId}-${terminalId}-${Date.now()}`;
        const saleResult = await kpayTerminalService.performSale({
          outTradeNo: outTradeNo,
          payAmount: payAmount,
          tipsAmount: tipsAmount || '000000000000',
          payCurrency: payCurrency || '344',
          description: description || 'Payment',
          customerName: customerName || 'Customer',
        });
        const saleLogs = kpayTerminalService.flushLogs();
        const allLogs = [...signLogs, ...saleLogs];

        if (!saleResult.success) {
          return res.status(400).json({
            success: false,
            status: 'failed',
            code: 10002,
            message: 'Sale initiation failed: ' + saleResult.message,
            error: saleResult.error,
            logs: allLogs,
          });
        }

        // Step 3: Store transaction in database for status polling
        const transactionId = saleResult.response?.transactionId || 'TXN-' + Date.now();
        
        const storeResult = await pool.query(
          `INSERT INTO kpay_transactions 
           (restaurant_id, kpay_reference_id, status, amount_cents, currency_code, kpay_response)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, kpay_reference_id, status`,
          [
            restaurantId,
            outTradeNo,
            'pending',
            parseInt(payAmount),
            payCurrency || '344',
            JSON.stringify(saleResult.response),
          ]
        );

        return res.json({
          success: true,
          initiated: true,
          status: 'pending',
          code: 10000,
          message: 'Payment initiated - please check terminal. Use status endpoint to poll result.',
          outTradeNo: outTradeNo,
          transactionId: transactionId,
          amount: payAmount,
          currency: payCurrency || '344',
          logs: allLogs,
        });
      } catch (err: any) {
        console.error('[KPay] Payment processing error:', err);
        return res.status(500).json({
          success: false,
          status: 'error',
          message: 'Payment processing failed',
          error: err.message,
        });
      }
    }

    // Payment Asia: generate test payment form
    if (terminal.vendor_name === 'payment-asia') {
      try {
        const paResult = await pool.query(
          `SELECT merchant_token, secret_code, payment_gateway_env
           FROM payment_terminals WHERE id = $1 AND restaurant_id = $2`,
          [terminalId, restaurantId]
        );
        const pa = paResult.rows[0];
        if (!pa?.merchant_token || !pa?.secret_code) {
          return res.status(400).json({
            success: false,
            error: 'Payment Asia terminal missing merchant_token or secret_code. Please save the terminal configuration first.',
          });
        }

        paymentAsiaService.initialize({
          merchantToken: pa.merchant_token,
          secretCode: pa.secret_code,
          environment: pa.payment_gateway_env || 'sandbox',
        });

        const network = req.body.network ? String(req.body.network) : undefined;
        const returnTo = req.body.return_to ? decodeURIComponent(String(req.body.return_to)) : undefined;
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        const result = paymentAsiaService.testConnection(network, returnTo, baseUrl);
        return res.json(result);
      } catch (paErr: any) {
        console.error('[PaymentTerminal] Payment Asia test error:', paErr);
        return res.status(500).json({ success: false, error: paErr.message || 'Payment Asia test failed' });
      }
    }

    // For other vendors
    res.status(400).json({
      error: `Payment not yet implemented for vendor: ${terminal.vendor_name}`,
    });
  } catch (err: any) {
    console.error('[PaymentTerminal] Error processing payment:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/restaurants/:restaurantId/payment-terminals/:terminalId/test-status
 * Query the status of a pending payment transaction
 * 
 * Query params:
 *   outTradeNo: The merchant order reference to query
 */
router.get('/restaurants/:restaurantId/payment-terminals/:terminalId/test-status', async (req, res) => {
  try {
    const { restaurantId, terminalId } = req.params;
    const { outTradeNo } = req.query;

    if (!outTradeNo) {
      return res.status(400).json({ error: 'outTradeNo query parameter required' });
    }

    // Fetch the terminal configuration
    const terminalResult = await pool.query(
      `SELECT id, vendor_name, app_id, app_secret, terminal_ip, terminal_port, endpoint_path
       FROM payment_terminals
       WHERE id = $1 AND restaurant_id = $2`,
      [terminalId, restaurantId]
    );

    if (terminalResult.rowCount === 0) {
      return res.status(404).json({ error: 'Payment terminal not found' });
    }

    const terminal = terminalResult.rows[0];

    if (terminal.vendor_name === 'kpay') {
      try {
        // Initialize KPay service
        kpayTerminalService.initialize({
          appId: terminal.app_id,
          appSecret: terminal.app_secret,
          terminalIp: terminal.terminal_ip,
          terminalPort: terminal.terminal_port,
          endpointPath: terminal.endpoint_path || '/v2/pos/sign',
        });

        // Query transaction status from terminal
        const queryResult = await kpayTerminalService.queryTransactionStatus(String(outTradeNo));
        const queryLogs = kpayTerminalService.flushLogs();

        const status = queryResult.response?.status || 'unknown';
        const code = queryResult.response?.code || 10002;

        // Update transaction status in database
        if (queryResult.success) {
          await pool.query(
            `UPDATE kpay_transactions 
             SET status = $1, kpay_response = $2, completed_at = NOW()
             WHERE kpay_reference_id = $3 AND restaurant_id = $4`,
            [status, JSON.stringify(queryResult.response), outTradeNo, restaurantId]
          );
        }

        return res.json({
          success: queryResult.success,
          code: code,
          status: status,
          message: queryResult.message,
          outTradeNo: outTradeNo,
          transactionNo: queryResult.response?.transactionNo,
          refNo: queryResult.response?.refNo,
          commitTime: queryResult.response?.commitTime,
          amount: queryResult.response?.amount,
          currency: queryResult.response?.currency,
          logs: queryLogs,
        });
      } catch (err: any) {
        console.error('[KPay] Status query error:', err);
        return res.status(500).json({
          success: false,
          code: 10002,
          status: 'error',
          message: 'Status query failed',
          error: err.message,
        });
      }
    }

    // For other vendors
    res.status(400).json({
      error: `Status query not yet implemented for vendor: ${terminal.vendor_name}`,
    });
  } catch (err: any) {
    console.error('[PaymentTerminal] Error querying status:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/restaurants/:restaurantId/payment-terminals/:terminalId/activate
 * Activate a payment terminal as the primary payment method
 */
router.post('/restaurants/:restaurantId/payment-terminals/:terminalId/activate', async (req, res) => {
  const user = await verifyUser(req);
  if (!user || user.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin access required' });
  try {
    const { restaurantId, terminalId } = req.params;

    // Get terminal vendor
    const terminalResult = await pool.query(
      'SELECT vendor_name FROM payment_terminals WHERE id = $1 AND restaurant_id = $2',
      [terminalId, restaurantId]
    );

    if (terminalResult.rowCount === 0) {
      return res.status(404).json({ error: 'Payment terminal not found' });
    }

    const vendorName = terminalResult.rows[0].vendor_name;

    // Deactivate all other terminals for this vendor
    await pool.query(
      'UPDATE payment_terminals SET is_active = false WHERE restaurant_id = $1 AND vendor_name = $2',
      [restaurantId, vendorName]
    );

    // Activate this terminal
    const result = await pool.query(
      `UPDATE payment_terminals 
       SET is_active = true, updated_at = NOW()
       WHERE id = $1 AND restaurant_id = $2
       RETURNING id, vendor_name, is_active, app_id, terminal_ip, terminal_port`,
      [terminalId, restaurantId]
    );

    // Update restaurant's active payment vendor
    await pool.query(
      'UPDATE restaurants SET active_payment_vendor = $1, active_payment_terminal_id = $2 WHERE id = $3',
      [vendorName, terminalId, restaurantId]
    );

    res.json({
      success: true,
      message: `${vendorName} terminal activated successfully`,
      terminal: result.rows[0],
    });
  } catch (err: any) {
    console.error('[PaymentTerminal] Error activating terminal:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Helper: load & init KPay terminal config ───────────────────────────────
async function initKPayTerminal(restaurantId: string, terminalId: string): Promise<{ terminal: any; error?: string }> {
  const result = await pool.query(
    `SELECT id, vendor_name, app_id, app_secret, terminal_ip, terminal_port, endpoint_path
     FROM payment_terminals WHERE id = $1 AND restaurant_id = $2`,
    [terminalId, restaurantId],
  );
  if (result.rowCount === 0) return { terminal: null, error: 'Payment terminal not found' };
  const terminal = result.rows[0];
  if (terminal.vendor_name !== 'kpay') return { terminal: null, error: `Vendor ${terminal.vendor_name} not supported` };
  kpayTerminalService.initialize({
    appId: terminal.app_id,
    appSecret: terminal.app_secret,
    terminalIp: terminal.terminal_ip,
    terminalPort: terminal.terminal_port,
    endpointPath: terminal.endpoint_path || '/v2/pos/sign',
  });
  // Perform key exchange so private key is available for signing
  const signResult = await kpayTerminalService.testConnection();
  if (!signResult.success) return { terminal: null, error: 'Key exchange failed: ' + signResult.message };
  return { terminal };
}

/**
 * POST /api/restaurants/:restaurantId/payment-terminals/:terminalId/cancel
 * Void (cancel) a completed but unsettled same-day transaction.
 * Body: { outTradeNo, originOutTradeNo, callbackUrl? }
 */
router.post('/restaurants/:restaurantId/payment-terminals/:terminalId/cancel', async (req, res) => {
  try {
    const { restaurantId, terminalId } = req.params;
    const { outTradeNo, originOutTradeNo, callbackUrl } = req.body;

    if (!outTradeNo || !originOutTradeNo) {
      return res.status(400).json({ error: 'outTradeNo and originOutTradeNo are required' });
    }

    const { terminal, error } = await initKPayTerminal(restaurantId, terminalId);
    if (error) return res.status(404).json({ success: false, error });

    const result = await kpayTerminalService.cancelTransaction({ outTradeNo, originOutTradeNo, callbackUrl });
    const logs = kpayTerminalService.flushLogs();

    if (result.success) {
      // Don't update DB here — cancel is only initiated, not yet confirmed by terminal operator.
      // The actual kpay_transactions / orders status update happens via the live query endpoint
      // (loadKPayOrderDetails) when the user next views the order, at which point payResult
      // will be 5/6 (Cancelled) if the void was confirmed on the terminal.
    }

    return res.json({
      success: result.success,
      message: result.message,
      outTradeNo,
      originOutTradeNo,
      error: result.error,
      logs,
    });
  } catch (err: any) {
    console.error('[KPay] Cancel error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/restaurants/:restaurantId/payment-terminals/:terminalId/refund
 * Refund a settled transaction (full or partial).
 * Body: { outTradeNo, refundType, refNo?, transactionNo?, commitTime?,
 *         refundAmount?, managerPassword (plaintext — encrypted here), callbackUrl? }
 */
router.post('/restaurants/:restaurantId/payment-terminals/:terminalId/refund', async (req, res) => {
  try {
    const { restaurantId, terminalId } = req.params;
    const { outTradeNo, refundType, refNo, transactionNo, commitTime, refundAmount, managerPassword, callbackUrl } = req.body;

    if (!outTradeNo || !refundType || !managerPassword) {
      return res.status(400).json({ error: 'outTradeNo, refundType, and managerPassword are required' });
    }

    const { terminal, error } = await initKPayTerminal(restaurantId, terminalId);
    if (error) return res.status(404).json({ success: false, error });

    // Encrypt the plain-text admin password with the platform public key
    let encryptedPassword: string;
    try {
      encryptedPassword = kpayTerminalService.encryptManagerPassword(managerPassword);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: 'Password encryption failed: ' + e.message });
    }

    const result = await kpayTerminalService.refundTransaction({
      outTradeNo,
      refundType,
      managerPassword: encryptedPassword,
      transactionNo,
      refNo,
      commitTime,
      refundAmount,
      callbackUrl,
    });
    const logs = kpayTerminalService.flushLogs();

    if (result.success) {
      const refundDbRes = await pool.query(
        `UPDATE kpay_transactions SET status = 'refunded', completed_at = NOW(), kpay_response = $1
               WHERE kpay_reference_id = $2 AND restaurant_id = $3
               RETURNING order_id, amount_cents, pay_method`,
        [JSON.stringify(result.response), outTradeNo, restaurantId],
      );
      // Use partial_refund when a specific amount was provided
      const refundStatus = refundAmount ? 'partial_refund' : 'refunded';
      await pool.query(
        `UPDATE orders SET payment_status = $1
         WHERE chuio_order_reference = $2 AND restaurant_id = $3`,
        [refundStatus, outTradeNo, restaurantId],
      );
      // Update unified ledger
      try {
        const refundAmtCents = refundAmount ? Math.round(parseFloat(String(refundAmount)) * 100) : (refundDbRes.rows[0]?.amount_cents || 0);
        await pool.query(
          `UPDATE chuio_payments SET status = $1, refund_amount_cents = $2, refunded_at = NOW()
           WHERE order_reference = $3`,
          [refundStatus, refundAmtCents, outTradeNo]
        );
      } catch (le) { console.warn('[KPay] chuio_payments refund update failed:', le instanceof Error ? le.message : le); }
    }

    return res.json({
      success: result.success,
      message: result.message,
      outTradeNo,
      error: result.error,
      logs,
    });
  } catch (err: any) {
    console.error('[KPay] Refund error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/restaurants/:restaurantId/payment-terminals/:terminalId/close-transaction
 * Close (abort) an in-progress pending transaction to free the terminal.
 * Body: { outTradeNo }
 */
router.post('/restaurants/:restaurantId/payment-terminals/:terminalId/close-transaction', async (req, res) => {
  try {
    const { restaurantId, terminalId } = req.params;
    const { outTradeNo } = req.body;

    if (!outTradeNo) {
      return res.status(400).json({ error: 'outTradeNo is required' });
    }

    const { terminal, error } = await initKPayTerminal(restaurantId, terminalId);
    if (error) return res.status(404).json({ success: false, error });

    const result = await kpayTerminalService.closeTransaction(outTradeNo);
    const logs = kpayTerminalService.flushLogs();

    if (result.success) {
      await pool.query(
        `UPDATE kpay_transactions SET status = 'closed', completed_at = NOW(), kpay_response = $1
               WHERE kpay_reference_id = $2 AND restaurant_id = $3
               RETURNING order_id, amount_cents, pay_method`,
        [JSON.stringify(result.response), outTradeNo, restaurantId],
      );
      // Update unified ledger (void = status 'voided')
      try {
        await pool.query(
          `UPDATE chuio_payments SET status = 'voided' WHERE order_reference = $1`,
          [outTradeNo]
        );
      } catch (le) { console.warn('[KPay] chuio_payments void update failed:', le instanceof Error ? le.message : le); }
    }

    return res.json({
      success: result.success,
      message: result.message,
      outTradeNo,
      error: result.error,
      logs,
    });
  } catch (err: any) {
    console.error('[KPay] Close transaction error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/restaurants/:restaurantId/kpay-transactions/:outTradeNo
 * Fetch a KPay transaction record and perform a live query to get the latest status.
 * Returns: db record + all live query fields (outTradeNo, transactionNo, refNo,
 *          payAmount, payCurrency, payMethod, transactionType, payResult, etc.)
 */
router.get('/restaurants/:restaurantId/kpay-transactions/:outTradeNo', async (req, res) => {
  try {
    const { restaurantId, outTradeNo } = req.params;

    // 1. Load DB record
    const dbResult = await pool.query(
      `SELECT id, kpay_reference_id, status, amount_cents, currency_code,
              transaction_type, created_at, completed_at, kpay_response,
              refund_reference_id, refund_amount_cents, refunded_at
       FROM kpay_transactions
       WHERE kpay_reference_id = $1 AND restaurant_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [outTradeNo, restaurantId]
    );
    if (dbResult.rowCount === 0) {
      return res.status(404).json({ error: 'KPay transaction not found' });
    }
    const txn = { ...dbResult.rows[0] };

    // 2. Extract cached fields from stored kpay_response
    let cachedResp: any = {};
    try {
      cachedResp = typeof txn.kpay_response === 'string'
        ? JSON.parse(txn.kpay_response)
        : (txn.kpay_response || {});
    } catch {}

    // 3. Attempt live query from terminal to get freshest data
    let liveData: any = null;
    try {
      const terminalResult = await pool.query(
        `SELECT id, app_id, app_secret, terminal_ip, terminal_port, endpoint_path
         FROM payment_terminals
         WHERE restaurant_id = $1 AND vendor_name = 'kpay' AND is_active = true
         LIMIT 1`,
        [restaurantId]
      );
      if ((terminalResult.rowCount ?? 0) > 0) {
        const terminal = terminalResult.rows[0];
        kpayTerminalService.initialize({
          appId: terminal.app_id,
          appSecret: terminal.app_secret,
          terminalIp: terminal.terminal_ip,
          terminalPort: terminal.terminal_port,
          endpointPath: terminal.endpoint_path || '/v2/pos/sign',
        });
        const queryResult = await kpayTerminalService.queryTransactionStatus(outTradeNo);
        if (queryResult.success && queryResult.response) {
          liveData = queryResult.response;
          // Update DB with latest response and derive status from payResult
          const payResult: number = liveData.payResult;
          // Don't overwrite intentional voided (from cancel endpoint) or refunded (from refund endpoint)
          if (txn.status !== 'voided' && txn.status !== 'refunded') {
            let derivedStatus = txn.status;
            if (payResult === 2) derivedStatus = 'completed';
            else if (payResult === 3) derivedStatus = 'failed';
            else if (payResult === 4) derivedStatus = 'refunded';
            else if (payResult === 5 || payResult === 6) derivedStatus = 'cancelled';
            const livePayMethod = liveData.payMethod || null;
            await pool.query(
              `UPDATE kpay_transactions SET status = $1, kpay_response = $2, pay_method = COALESCE($5, pay_method)
               WHERE kpay_reference_id = $3 AND restaurant_id = $4`,
              [derivedStatus, JSON.stringify(liveData), outTradeNo, restaurantId, livePayMethod]
            );
            // Sync orders.payment_status based on payResult (KPay orders only)
            if (payResult === 2) {
              await pool.query(
                `UPDATE orders SET payment_status = 'paid'
                 WHERE chuio_order_reference = $1 AND restaurant_id = $2
                 AND payment_status IS DISTINCT FROM 'voided'
                 AND payment_status IS DISTINCT FROM 'refunded'
                 AND payment_status IS DISTINCT FROM 'partial_refund'`,
                [outTradeNo, restaurantId]
              );
              // Write to unified chuio_payments ledger on first completion
              try {
                const _kpayMethods: Record<number,string> = {1:'Visa',2:'Mastercard',3:'Amex',4:'UnionPay',5:'Alipay',6:'WeChat Pay',7:'FPS',8:'Octopus',10:'JCB',11:'Octopus',12:'PayMe',14:'FPS'};
                const kMeth = liveData.payMethod ? (_kpayMethods[liveData.payMethod] || `Method ${liveData.payMethod}`) : 'Terminal';
                const kAmt = liveData.amount ? parseInt(liveData.amount) : (txn.amount_cents || 0);
                const kRef = liveData.transactionNo || liveData.refNo || null;
                const kOrderRes = await pool.query(
                  `SELECT id, session_id FROM orders WHERE chuio_order_reference = $1 AND restaurant_id = $2 LIMIT 1`,
                  [outTradeNo, restaurantId]
                );
                const kOrder = kOrderRes.rows[0];
                if (kOrder) {
                  await pool.query(
                    `INSERT INTO chuio_payments
                       (restaurant_id, order_id, session_id, payment_vendor, payment_method,
                        payment_gateway_env, order_reference, vendor_reference,
                        amount_cents, currency_code, total_cents, status, completed_at, extra_data)
                     VALUES ($1,$2,$3,'kpay',$4,'production',$5,$6,$7,'HKD',$7,'completed',NOW(),$8)
                     ON CONFLICT DO NOTHING`,
                    [
                      restaurantId, kOrder.id, kOrder.session_id,
                      kMeth, outTradeNo, kRef, kAmt,
                      JSON.stringify({ payMethod: liveData.payMethod, transactionNo: liveData.transactionNo, refNo: liveData.refNo, commitTime: liveData.commitTime }),
                    ]
                  );
                }
              } catch (ledgerErr) {
                console.warn('[KPay] chuio_payments write failed:', ledgerErr instanceof Error ? ledgerErr.message : ledgerErr);
              }
            } else if (payResult === 4) {
              await pool.query(
                `UPDATE orders SET payment_status = 'refunded'
                 WHERE chuio_order_reference = $1 AND restaurant_id = $2`,
                [outTradeNo, restaurantId]
              );
            } else if (payResult === 3 || payResult === 5 || payResult === 6) {
              await pool.query(
                `UPDATE orders SET payment_status = 'voided'
                 WHERE chuio_order_reference = $1 AND restaurant_id = $2
                 AND payment_status IS DISTINCT FROM 'refunded'
                 AND payment_status IS DISTINCT FROM 'partial_refund'`,
                [outTradeNo, restaurantId]
              );
            }
            txn.status = derivedStatus;
          }
        }
      }
    } catch (liveErr: any) {
      // Live query failure is non-fatal — fall back to cached data
      console.warn('[KPay] Live query failed, using cached data:', liveErr.message);
    }

    // 4. Merge: live data takes precedence over cached
    const merged = liveData || cachedResp;
    return res.json({
      ...txn,
      outTradeNo:      merged.outTradeNo      || outTradeNo,
      transactionNo:   merged.transactionNo   || null,
      refNo:           merged.refNo           || null,
      commitTime:      merged.commitTime      || null,
      payAmount:       merged.amount          || merged.payAmount || null,
      payCurrency:     merged.currency        || merged.payCurrency || null,
      payMethod:       merged.payMethod       || null,
      transactionType: merged.transactionType || null,
      payResult:       merged.payResult       ?? null,
    });
  } catch (err: any) {
    console.error('[KPay] Transaction lookup error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/restaurants/:restaurantId/kpay-terminal/active
 * Returns the active KPay terminal config (for frontend gating)
 */
router.get('/restaurants/:restaurantId/kpay-terminal/active', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const result = await pool.query(
      `SELECT id, app_id, terminal_ip, terminal_port, endpoint_path, is_active
       FROM payment_terminals
       WHERE restaurant_id = $1 AND vendor_name = 'kpay' AND is_active = true
       LIMIT 1`,
      [restaurantId]
    );
    if (result.rowCount === 0) {
      return res.json({ configured: false });
    }
    return res.json({ configured: true, terminal: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
