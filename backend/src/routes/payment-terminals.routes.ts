/**
 * Payment Terminal Routes
 * Manages CRUD operations and connectivity tests for payment terminals
 * Supports KPay and other payment vendors
 */

import { Router } from 'express';
import pool from '../config/db';
import { kpayTerminalService } from '../services/kpayTerminalService';

const router = Router();

/**
 * GET /api/restaurants/:restaurantId/payment-terminals
 * Fetch all payment terminals for a restaurant
 */
router.get('/restaurants/:restaurantId/payment-terminals', async (req, res) => {
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

    res.json(result.rows[0]);
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
      updates.push(`metadata = $${paramCount++}`);
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
       WHERE id = $${paramCount + 1} AND restaurant_id = $${paramCount + 2}
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
 * Test connection to a payment terminal
 * For KPay: Sends a sign request to verify credentials and connectivity
 */
router.post('/restaurants/:restaurantId/payment-terminals/:terminalId/test', async (req, res) => {
  try {
    const { restaurantId, terminalId } = req.params;

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

    // Test based on vendor
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

        // Test the connection
        const testResult = await kpayTerminalService.testConnection();

        // Update last tested timestamp
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
      } catch (err: any) {
        console.error('[KPay] Test connection error:', err);
        return res.status(500).json({
          success: false,
          message: 'KPay terminal test failed',
          error: err.message,
        });
      }
    }

    // For other vendors
    res.status(400).json({
      error: `Test connection not yet implemented for vendor: ${terminal.vendor_name}`,
    });
  } catch (err: any) {
    console.error('[PaymentTerminal] Error testing terminal:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/restaurants/:restaurantId/payment-terminals/:terminalId/activate
 * Activate a payment terminal as the primary payment method
 */
router.post('/restaurants/:restaurantId/payment-terminals/:terminalId/activate', async (req, res) => {
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

export default router;
