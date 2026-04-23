import { Router } from "express";
import pool from "../config/db";
import { requireFeature } from "../middleware/featureFlags";
import { webSocketServer } from "../services/websocket";
import jwt from "jsonwebtoken";

const router = Router();

// Auth helper for admin operations
const verifyAdmin = async (req: any): Promise<{ id: number; role: string; restaurant_id: number | null } | null> => {
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
 * POST /api/restaurants/:restaurantId/service-requests
 * Customer creates a service request (tea refill, towel, etc.)
 * No auth required — customers don't have tokens, identified by session.
 */
router.post("/restaurants/:restaurantId/service-requests", requireFeature("service_requests"), async (req, res) => {
  const { restaurantId } = req.params;
  const { table_session_id, table_unit_id, request_type, label } = req.body;

  if (!table_session_id || !request_type || !label) {
    return res.status(400).json({ error: "table_session_id, request_type, and label are required" });
  }

  try {
    // Verify session exists and belongs to this restaurant
    const sessionCheck = await pool.query(
      "SELECT id FROM table_sessions WHERE id = $1 AND restaurant_id = $2 AND ended_at IS NULL",
      [table_session_id, restaurantId]
    );
    if (sessionCheck.rowCount === 0) {
      return res.status(404).json({ error: "Active session not found" });
    }

    const result = await pool.query(
      `INSERT INTO service_requests (restaurant_id, table_session_id, table_unit_id, request_type, label)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [restaurantId, table_session_id, table_unit_id || null, request_type, label]
    );

    const request = result.rows[0];

    // Broadcast to staff via WebSocket
    const io = webSocketServer.getIO();
    if (io) {
      const roomName = `restaurant-${restaurantId}-service-requests`;
      io.to(roomName).emit("new-service-request", {
        ...request,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(201).json(request);
  } catch (err: any) {
    console.error("Failed to create service request:", err);
    res.status(500).json({ error: "Failed to create service request" });
  }
});

/**
 * GET /api/restaurants/:restaurantId/service-requests
 * Staff fetches pending/recent service requests.
 */
router.get("/restaurants/:restaurantId/service-requests", requireFeature("service_requests"), async (req, res) => {
  const { restaurantId } = req.params;
  const { status } = req.query;

  try {
    let query = `
      SELECT sr.*, ts.id as session_id,
             COALESCE(tu.display_name, 'Table') as table_name
      FROM service_requests sr
      JOIN table_sessions ts ON sr.table_session_id = ts.id
      LEFT JOIN table_units tu ON sr.table_unit_id = tu.id
      WHERE sr.restaurant_id = $1
    `;
    const params: any[] = [restaurantId];

    if (status) {
      query += ` AND sr.status = $2`;
      params.push(status);
    } else {
      // Default: show requests from last 8 hours
      query += ` AND sr.created_at > NOW() - INTERVAL '8 hours'`;
    }

    query += ` ORDER BY sr.created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error("Failed to fetch service requests:", err);
    res.status(500).json({ error: "Failed to fetch service requests" });
  }
});

/**
 * PATCH /api/restaurants/:restaurantId/service-requests/:requestId
 * Staff acknowledges or fulfills a service request.
 */
router.patch("/restaurants/:restaurantId/service-requests/:requestId", requireFeature("service_requests"), async (req, res) => {
  const { restaurantId, requestId } = req.params;
  const { status, fulfilled_by } = req.body;

  if (!status || !["acknowledged", "fulfilled"].includes(status)) {
    return res.status(400).json({ error: "status must be 'acknowledged' or 'fulfilled'" });
  }

  try {
    const updates = status === "fulfilled"
      ? "status = $1, fulfilled_at = NOW(), fulfilled_by = $2"
      : "status = $1";
    const params = status === "fulfilled"
      ? [status, fulfilled_by || null, requestId, restaurantId]
      : [status, requestId, restaurantId];
    const whereIdx = status === "fulfilled" ? 3 : 2;

    const result = await pool.query(
      `UPDATE service_requests SET ${updates}
       WHERE id = $${whereIdx} AND restaurant_id = $${whereIdx + 1}
       RETURNING *`,
      params
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Service request not found" });
    }

    // Broadcast update to staff
    const io = webSocketServer.getIO();
    if (io) {
      const roomName = `restaurant-${restaurantId}-service-requests`;
      io.to(roomName).emit("service-request-updated", result.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error("Failed to update service request:", err);
    res.status(500).json({ error: "Failed to update service request" });
  }
});

// ============================================================
// SERVICE REQUEST ITEMS — configurable list per restaurant
// ============================================================

/**
 * GET /api/restaurants/:restaurantId/service-request-items
 * Public — fetches active items for the customer-facing menu.
 */
router.get("/restaurants/:restaurantId/service-request-items", requireFeature("service_requests"), async (req, res) => {
  const { restaurantId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, request_type, label_en, label_zh, sort_order, color
       FROM service_request_items
       WHERE restaurant_id = $1 AND is_active = TRUE
       ORDER BY sort_order ASC, id ASC`,
      [restaurantId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch service request items" });
  }
});

/**
 * GET /api/restaurants/:restaurantId/service-request-items/all
 * Admin — fetches all items (including inactive) for management UI.
 */
router.get("/restaurants/:restaurantId/service-request-items/all", async (req, res) => {
  const { restaurantId } = req.params;
  const user = await verifyAdmin(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role !== "superadmin" && user.restaurant_id !== parseInt(restaurantId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const result = await pool.query(
      `SELECT id, request_type, label_en, label_zh, is_active, sort_order, color
       FROM service_request_items
       WHERE restaurant_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [restaurantId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch service request items" });
  }
});

/**
 * POST /api/restaurants/:restaurantId/service-request-items
 * Admin — creates a new service request item.
 */
router.post("/restaurants/:restaurantId/service-request-items", async (req, res) => {
  const { restaurantId } = req.params;
  const user = await verifyAdmin(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role !== "superadmin" && user.restaurant_id !== parseInt(restaurantId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { request_type, label_en, label_zh, sort_order, color } = req.body;
  if (!request_type || !label_en) {
    return res.status(400).json({ error: "request_type and label_en are required" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO service_request_items (restaurant_id, request_type, label_en, label_zh, sort_order, color)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [restaurantId, request_type.trim(), label_en.trim(), label_zh?.trim() || null, sort_order ?? 0, color || '#4f46e5']
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create service request item" });
  }
});

/**
 * PATCH /api/restaurants/:restaurantId/service-request-items/:itemId
 * Admin — updates an existing item (label, active state, sort order).
 */
router.patch("/restaurants/:restaurantId/service-request-items/:itemId", async (req, res) => {
  const { restaurantId, itemId } = req.params;
  const user = await verifyAdmin(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role !== "superadmin" && user.restaurant_id !== parseInt(restaurantId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { label_en, label_zh, is_active, sort_order, color } = req.body;
  const setClauses: string[] = [];
  const params: any[] = [];

  if (label_en !== undefined) { params.push(label_en.trim()); setClauses.push(`label_en = $${params.length}`); }
  if (label_zh !== undefined) { params.push(label_zh?.trim() || null); setClauses.push(`label_zh = $${params.length}`); }
  if (is_active !== undefined) { params.push(is_active); setClauses.push(`is_active = $${params.length}`); }
  if (sort_order !== undefined) { params.push(sort_order); setClauses.push(`sort_order = $${params.length}`); }
  if (color !== undefined) { params.push(color); setClauses.push(`color = $${params.length}`); }

  if (setClauses.length === 0) return res.status(400).json({ error: "No fields to update" });

  params.push(itemId, restaurantId);
  try {
    const result = await pool.query(
      `UPDATE service_request_items SET ${setClauses.join(", ")}
       WHERE id = $${params.length - 1} AND restaurant_id = $${params.length}
       RETURNING *`,
      params
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Item not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update service request item" });
  }
});

/**
 * DELETE /api/restaurants/:restaurantId/service-request-items/:itemId
 * Admin — deletes a service request item.
 */
router.delete("/restaurants/:restaurantId/service-request-items/:itemId", async (req, res) => {
  const { restaurantId, itemId } = req.params;
  const user = await verifyAdmin(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role !== "superadmin" && user.restaurant_id !== parseInt(restaurantId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const result = await pool.query(
      "DELETE FROM service_request_items WHERE id = $1 AND restaurant_id = $2 RETURNING id",
      [itemId, restaurantId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Item not found" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete service request item" });
  }
});

export default router;
