import { Router } from "express";
import pool from "../config/db";
import { requireFeature } from "../middleware/featureFlags";

const router = Router();

// GET /restaurants/:restaurantId/crm/count
// Quick customer count for settings card preview
router.get("/restaurants/:restaurantId/crm/count", requireFeature("crm"), async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total FROM crm_customers WHERE restaurant_id = $1`,
      [restaurantId]
    );
    res.json({ total: result.rows[0]?.total ?? 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /restaurants/:restaurantId/crm/import-from-bookings
// Import historical booking guests as CRM customers (upsert by phone, fallback name+restaurantId)
router.post("/restaurants/:restaurantId/crm/import-from-bookings", requireFeature("crm"), async (req, res) => {
  const client = await pool.connect();
  try {
    const { restaurantId } = req.params;
    await client.query("BEGIN");

    // Pull all distinct booking guests with name/phone/email
    const bookingsRes = await client.query(
      `SELECT
         TRIM(guest_name) AS name,
         TRIM(phone)      AS phone,
         TRIM(email)      AS email,
         MAX(created_at)  AS last_booking_at,
         COUNT(*)::int    AS booking_count
       FROM bookings
       WHERE restaurant_id = $1
         AND guest_name IS NOT NULL AND TRIM(guest_name) <> ''
       GROUP BY TRIM(guest_name), TRIM(phone), TRIM(email)
       ORDER BY last_booking_at DESC`,
      [restaurantId]
    );

    let inserted = 0;
    let updated  = 0;

    for (const row of bookingsRes.rows) {
      // Determine if a customer already exists (match by phone first, then by name)
      let existing: any = null;
      if (row.phone) {
        const r = await client.query(
          `SELECT id FROM crm_customers WHERE restaurant_id = $1 AND phone = $2 LIMIT 1`,
          [restaurantId, row.phone]
        );
        if (r.rowCount && r.rowCount > 0) existing = r.rows[0];
      }
      if (!existing) {
        const r = await client.query(
          `SELECT id FROM crm_customers WHERE restaurant_id = $1 AND name = $2 AND (phone IS NULL OR phone = '') LIMIT 1`,
          [restaurantId, row.name]
        );
        if (r.rowCount && r.rowCount > 0) existing = r.rows[0];
      }

      if (existing) {
        // Update missing fields only (don't overwrite data already there)
        await client.query(
          `UPDATE crm_customers
           SET phone = COALESCE(NULLIF(phone, ''), $2),
               email = COALESCE(NULLIF(email, ''), $3),
               updated_at = NOW()
           WHERE id = $1`,
          [existing.id, row.phone || null, row.email || null]
        );
        updated++;
      } else {
        await client.query(
          `INSERT INTO crm_customers (restaurant_id, name, phone, email, total_visits, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [restaurantId, row.name, row.phone || null, row.email || null, row.booking_count]
        );
        inserted++;
      }
    }

    // Refresh total_visits and total_spent_cents from orders linked by phone or name
    await client.query(
      `UPDATE crm_customers c
       SET
         total_visits = sub.visit_count,
         total_spent_cents = sub.spent_cents,
         last_visit_at = sub.last_visit
       FROM (
         SELECT
           cc.id AS customer_id,
           COUNT(DISTINCT o.id)::int AS visit_count,
           COALESCE(SUM(oi.price_cents * oi.quantity) FILTER (WHERE oi.removed = false), 0) AS spent_cents,
           MAX(o.created_at) AS last_visit
         FROM crm_customers cc
         JOIN table_sessions ts ON ts.restaurant_id = cc.restaurant_id
           AND (
             (ts.customer_phone IS NOT NULL AND ts.customer_phone <> '' AND ts.customer_phone = cc.phone)
             OR (ts.customer_name  IS NOT NULL AND ts.customer_name  = cc.name)
           )
         JOIN orders o ON o.session_id = ts.id AND o.restaurant_id = cc.restaurant_id
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE cc.restaurant_id = $1
         GROUP BY cc.id
       ) sub
       WHERE c.id = sub.customer_id`,
      [restaurantId]
    );

    await client.query("COMMIT");

    res.json({ inserted, updated, total: inserted + updated });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[crm import-from-bookings]", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// GET /restaurants/:restaurantId/crm/customers
// List / search CRM customers with optional sort
// Query params: search, sort_by (total_orders|total_spent|created_at|last_visit), limit, offset
router.get("/restaurants/:restaurantId/crm/customers", requireFeature("crm"), async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { search, sort_by, limit = '50', offset = '0' } = req.query;

    const validSorts: Record<string, string> = {
      total_orders: 'total_visits DESC NULLS LAST',
      total_spent:  'total_spent_cents DESC NULLS LAST',
      created_at:   'created_at DESC',
      last_visit:   'last_visit_at DESC NULLS LAST',
    };
    const sortClause = validSorts[(sort_by as string) || ''] || 'last_visit_at DESC NULLS LAST';

    const params: any[] = [restaurantId];
    let whereExtra = '';

    if (search && typeof search === 'string' && search.trim()) {
      whereExtra = ` AND (name ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)`;
      params.push(`%${search.trim()}%`);
    }

    const limitVal  = Math.min(Math.max(parseInt(limit  as string, 10) || 50, 1), 200);
    const offsetVal = Math.max(parseInt(offset as string, 10) || 0, 0);
    params.push(limitVal, offsetVal);
    const pLimit  = params.length - 1;
    const pOffset = params.length;

    const query = `
      SELECT id, name, phone, email, total_visits, total_spent_cents,
             last_visit_at, created_at
      FROM crm_customers
      WHERE restaurant_id = $1${whereExtra}
      ORDER BY ${sortClause}
      LIMIT $${pLimit} OFFSET $${pOffset}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /restaurants/:restaurantId/crm/customers/:customerId
// Full customer profile: info + orders + bookings + eligible coupons
router.get("/restaurants/:restaurantId/crm/customers/:customerId", requireFeature("crm"), async (req, res) => {
  try {
    const { restaurantId, customerId } = req.params;

    // 1. Customer row
    const custRes = await pool.query(
      `SELECT id, name, phone, email, notes, total_visits, total_spent_cents, last_visit_at, created_at
       FROM crm_customers WHERE id = $1 AND restaurant_id = $2`,
      [customerId, restaurantId]
    );
    if (custRes.rowCount === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const customer = custRes.rows[0];

    // 2. Orders – prefer crm_customer_orders link; also match sessions by phone/name
    const ordersRes = await pool.query(
      `SELECT DISTINCT ON (o.id)
         o.id AS order_id,
         o.restaurant_order_number,
         o.status,
         o.payment_method,
         o.created_at,
         ts.order_type,
         COALESCE(t.name, ts.table_name, 'Counter') AS table_label,
         ts.pax,
         (
           SELECT COALESCE(SUM(oi2.price_cents * oi2.quantity), 0)
           FROM order_items oi2
           WHERE oi2.order_id = o.id AND oi2.removed = false
         ) AS total_cents
       FROM orders o
       JOIN table_sessions ts ON ts.id = o.session_id
       LEFT JOIN tables t ON t.id = ts.table_id
       LEFT JOIN crm_customer_orders cco ON cco.order_id = o.id
       WHERE o.restaurant_id = $1
         AND (
           cco.customer_id = $2
           OR (ts.customer_phone IS NOT NULL AND ts.customer_phone = $3 AND $3 <> '')
           OR (ts.customer_name  IS NOT NULL AND ts.customer_name  = $4 AND $4 <> '')
         )
       ORDER BY o.id DESC, o.created_at DESC`,
      [restaurantId, customerId, customer.phone || '', customer.name]
    );

    // 3. Bookings matched by phone or name
    const bookingsRes = await pool.query(
      `SELECT b.id, b.guest_name, b.phone, b.pax, b.booking_date, b.booking_time,
              b.status, b.notes, b.created_at,
              COALESCE(t.name, '') AS table_label
       FROM bookings b
       LEFT JOIN tables t ON t.id = b.table_id
       WHERE b.restaurant_id = $1
         AND (
           (b.phone IS NOT NULL AND b.phone = $2 AND $2 <> '')
           OR (b.guest_name = $3)
         )
       ORDER BY b.booking_date DESC, b.booking_time DESC`,
      [restaurantId, customer.phone || '', customer.name]
    );

    const now: string = new Date().toISOString().split('T')[0]!;
    const pastBookings   = bookingsRes.rows.filter(b => (b.booking_date as string) < now || b.status === 'completed' || b.status === 'cancelled' || b.status === 'no-show');
    const futureBookings = bookingsRes.rows.filter(b => (b.booking_date as string) >= now && b.status === 'confirmed');

    // 4. Eligible coupons (active, not expired, not exhausted)
    const couponsRes = await pool.query(
      `SELECT id, code, discount_type, discount_value, min_order_cents,
              max_uses, current_uses, valid_from, valid_until, is_active
       FROM coupons
       WHERE restaurant_id = $1
         AND is_active = true
         AND (valid_until IS NULL OR valid_until >= NOW())
         AND (max_uses IS NULL OR current_uses < max_uses)
       ORDER BY created_at DESC`,
      [restaurantId]
    );

    res.json({
      customer,
      orders: ordersRes.rows,
      total_transacted_cents: ordersRes.rows.reduce((sum: number, r: any) => sum + Number(r.total_cents), 0),
      past_bookings:   pastBookings,
      future_bookings: futureBookings,
      eligible_coupons: couponsRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /restaurants/:restaurantId/crm/customers/:customerId
// Update a CRM customer's name, phone, and/or email
router.patch("/restaurants/:restaurantId/crm/customers/:customerId", requireFeature("crm"), async (req, res) => {
  try {
    const { restaurantId, customerId } = req.params;
    const { name, phone, email } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    const result = await pool.query(
      `UPDATE crm_customers
       SET name = $1,
           phone = $2,
           email = $3,
           updated_at = NOW()
       WHERE id = $4 AND restaurant_id = $5
       RETURNING id, name, phone, email, notes, total_visits, total_spent_cents, last_visit_at, created_at`,
      [name.trim(), phone?.trim() || null, email?.trim() || null, customerId, restaurantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /restaurants/:restaurantId/crm/customers
// Create a new CRM customer
router.post("/restaurants/:restaurantId/crm/customers", requireFeature("crm"), async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, phone, email, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const result = await pool.query(
      `INSERT INTO crm_customers (restaurant_id, name, phone, email, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [restaurantId, name, phone || null, email || null, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /sessions/:sessionId/customer
// Update customer_name, customer_phone, and customer_email on a table session
// Also upserts customer to CRM when a name is provided
router.patch("/sessions/:sessionId/customer", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { customer_name, customer_phone, customer_email } = req.body;

    const result = await pool.query(
      `UPDATE table_sessions
       SET customer_name = $1, customer_phone = $2, customer_email = $3
       WHERE id = $4
       RETURNING id, customer_name, customer_phone, customer_email, restaurant_id`,
      [customer_name || null, customer_phone || null, customer_email || null, sessionId]
    ).catch(async (err: any) => {
      // Fallback if customer_email column doesn't exist yet (migration pending)
      if (err.message?.includes('customer_email')) {
        return pool.query(
          `UPDATE table_sessions
           SET customer_name = $1, customer_phone = $2
           WHERE id = $3
           RETURNING id, customer_name, customer_phone, restaurant_id`,
          [customer_name || null, customer_phone || null, sessionId]
        );
      }
      throw err;
    });

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    const session = result.rows[0];

    // Upsert to CRM if a name is provided
    if (customer_name && session.restaurant_id) {
      try {
        let crmId: number | null = null;

        // Try to find existing customer by phone, then email
        if (customer_phone) {
          const existing = await pool.query(
            `SELECT id FROM crm_customers WHERE restaurant_id = $1 AND phone = $2 LIMIT 1`,
            [session.restaurant_id, customer_phone]
          );
          if (existing.rows.length > 0) crmId = existing.rows[0].id;
        }
        if (!crmId && customer_email) {
          const existing = await pool.query(
            `SELECT id FROM crm_customers WHERE restaurant_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
            [session.restaurant_id, customer_email]
          );
          if (existing.rows.length > 0) crmId = existing.rows[0].id;
        }

        if (crmId) {
          await pool.query(
            `UPDATE crm_customers
             SET name = $2,
                 phone = COALESCE(NULLIF($3, ''), phone),
                 email = COALESCE(NULLIF($4, ''), email),
                 updated_at = NOW()
             WHERE id = $1`,
            [crmId, customer_name, customer_phone || null, customer_email || null]
          );
        } else {
          await pool.query(
            `INSERT INTO crm_customers (restaurant_id, name, phone, email, total_visits, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 1, NOW(), NOW())
             ON CONFLICT DO NOTHING`,
            [session.restaurant_id, customer_name, customer_phone || null, customer_email || null]
          );
        }
      } catch (crmErr) {
        console.warn("[CRM] Non-fatal: failed to upsert customer:", crmErr);
      }
    }

    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
