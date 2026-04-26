"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const featureFlags_1 = require("../middleware/featureFlags");
const router = (0, express_1.Router)();
// GET /restaurants/:restaurantId/crm/count
// Quick customer count for settings card preview
router.get("/restaurants/:restaurantId/crm/count", (0, featureFlags_1.requireFeature)("crm"), async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const result = await db_1.default.query(`SELECT COUNT(*)::int AS total FROM crm_customers WHERE restaurant_id = $1`, [restaurantId]);
        res.json({ total: result.rows[0]?.total ?? 0 });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});
// GET /restaurants/:restaurantId/crm/customers
// List / search CRM customers with optional sort
// Query params: search, sort_by (total_orders|total_spent|created_at|last_visit), limit, offset
router.get("/restaurants/:restaurantId/crm/customers", (0, featureFlags_1.requireFeature)("crm"), async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { search, sort_by, limit = '50', offset = '0' } = req.query;
        const validSorts = {
            total_orders: 'total_visits DESC NULLS LAST',
            total_spent: 'total_spent_cents DESC NULLS LAST',
            created_at: 'created_at DESC',
            last_visit: 'last_visit_at DESC NULLS LAST',
        };
        const sortClause = validSorts[sort_by || ''] || 'last_visit_at DESC NULLS LAST';
        const params = [restaurantId];
        let whereExtra = '';
        if (search && typeof search === 'string' && search.trim()) {
            whereExtra = ` AND (name ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)`;
            params.push(`%${search.trim()}%`);
        }
        const limitVal = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
        const offsetVal = Math.max(parseInt(offset, 10) || 0, 0);
        params.push(limitVal, offsetVal);
        const pLimit = params.length - 1;
        const pOffset = params.length;
        const query = `
      SELECT id, name, phone, email, total_visits, total_spent_cents,
             last_visit_at, created_at
      FROM crm_customers
      WHERE restaurant_id = $1${whereExtra}
      ORDER BY ${sortClause}
      LIMIT $${pLimit} OFFSET $${pOffset}`;
        const result = await db_1.default.query(query, params);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});
// GET /restaurants/:restaurantId/crm/customers/:customerId
// Full customer profile: info + orders + bookings + eligible coupons
router.get("/restaurants/:restaurantId/crm/customers/:customerId", (0, featureFlags_1.requireFeature)("crm"), async (req, res) => {
    try {
        const { restaurantId, customerId } = req.params;
        // 1. Customer row
        const custRes = await db_1.default.query(`SELECT id, name, phone, email, notes, total_visits, total_spent_cents, last_visit_at, created_at
       FROM crm_customers WHERE id = $1 AND restaurant_id = $2`, [customerId, restaurantId]);
        if (custRes.rowCount === 0) {
            return res.status(404).json({ error: "Customer not found" });
        }
        const customer = custRes.rows[0];
        // 2. Orders – prefer crm_customer_orders link; also match sessions by phone/name
        const ordersRes = await db_1.default.query(`SELECT DISTINCT ON (o.id)
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
       ORDER BY o.id DESC, o.created_at DESC`, [restaurantId, customerId, customer.phone || '', customer.name]);
        // 3. Bookings matched by phone or name
        const bookingsRes = await db_1.default.query(`SELECT b.id, b.guest_name, b.phone, b.pax, b.booking_date, b.booking_time,
              b.status, b.notes, b.created_at,
              COALESCE(t.name, '') AS table_label
       FROM bookings b
       LEFT JOIN tables t ON t.id = b.table_id
       WHERE b.restaurant_id = $1
         AND (
           (b.phone IS NOT NULL AND b.phone = $2 AND $2 <> '')
           OR (b.guest_name = $3)
         )
       ORDER BY b.booking_date DESC, b.booking_time DESC`, [restaurantId, customer.phone || '', customer.name]);
        const now = new Date().toISOString().split('T')[0];
        const pastBookings = bookingsRes.rows.filter(b => b.booking_date < now || b.status === 'completed' || b.status === 'cancelled' || b.status === 'no-show');
        const futureBookings = bookingsRes.rows.filter(b => b.booking_date >= now && b.status === 'confirmed');
        // 4. Eligible coupons (active, not expired, not exhausted)
        const couponsRes = await db_1.default.query(`SELECT id, code, discount_type, discount_value, min_order_cents,
              max_uses, current_uses, valid_from, valid_until, is_active
       FROM coupons
       WHERE restaurant_id = $1
         AND is_active = true
         AND (valid_until IS NULL OR valid_until >= NOW())
         AND (max_uses IS NULL OR current_uses < max_uses)
       ORDER BY created_at DESC`, [restaurantId]);
        res.json({
            customer,
            orders: ordersRes.rows,
            total_transacted_cents: ordersRes.rows.reduce((sum, r) => sum + Number(r.total_cents), 0),
            past_bookings: pastBookings,
            future_bookings: futureBookings,
            eligible_coupons: couponsRes.rows,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});
// POST /restaurants/:restaurantId/crm/customers
// Create a new CRM customer
router.post("/restaurants/:restaurantId/crm/customers", (0, featureFlags_1.requireFeature)("crm"), async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { name, phone, email, notes } = req.body;
        if (!name) {
            return res.status(400).json({ error: "Name is required" });
        }
        const result = await db_1.default.query(`INSERT INTO crm_customers (restaurant_id, name, phone, email, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`, [restaurantId, name, phone || null, email || null, notes || null]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});
// PATCH /sessions/:sessionId/customer
// Update customer_name and customer_phone on a table session
router.patch("/sessions/:sessionId/customer", async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { customer_name, customer_phone } = req.body;
        const result = await db_1.default.query(`UPDATE table_sessions
       SET customer_name = $1, customer_phone = $2
       WHERE id = $3
       RETURNING id, customer_name, customer_phone`, [customer_name || null, customer_phone || null, sessionId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Session not found" });
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
//# sourceMappingURL=crm.routes.js.map