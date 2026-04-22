"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const featureFlags_1 = require("../middleware/featureFlags");
const websocket_1 = require("../services/websocket");
const router = (0, express_1.Router)();
/**
 * POST /api/restaurants/:restaurantId/service-requests
 * Customer creates a service request (tea refill, towel, etc.)
 * No auth required — customers don't have tokens, identified by session.
 */
router.post("/restaurants/:restaurantId/service-requests", (0, featureFlags_1.requireFeature)("service_requests"), async (req, res) => {
    const { restaurantId } = req.params;
    const { table_session_id, table_unit_id, request_type, label } = req.body;
    if (!table_session_id || !request_type || !label) {
        return res.status(400).json({ error: "table_session_id, request_type, and label are required" });
    }
    try {
        // Verify session exists and belongs to this restaurant
        const sessionCheck = await db_1.default.query("SELECT id FROM table_sessions WHERE id = $1 AND restaurant_id = $2 AND ended_at IS NULL", [table_session_id, restaurantId]);
        if (sessionCheck.rowCount === 0) {
            return res.status(404).json({ error: "Active session not found" });
        }
        const result = await db_1.default.query(`INSERT INTO service_requests (restaurant_id, table_session_id, table_unit_id, request_type, label)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`, [restaurantId, table_session_id, table_unit_id || null, request_type, label]);
        const request = result.rows[0];
        // Broadcast to staff via WebSocket
        const io = websocket_1.webSocketServer.getIO();
        if (io) {
            const roomName = `restaurant-${restaurantId}-service-requests`;
            io.to(roomName).emit("new-service-request", {
                ...request,
                timestamp: new Date().toISOString(),
            });
        }
        res.status(201).json(request);
    }
    catch (err) {
        console.error("Failed to create service request:", err);
        res.status(500).json({ error: "Failed to create service request" });
    }
});
/**
 * GET /api/restaurants/:restaurantId/service-requests
 * Staff fetches pending/recent service requests.
 */
router.get("/restaurants/:restaurantId/service-requests", (0, featureFlags_1.requireFeature)("service_requests"), async (req, res) => {
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
        const params = [restaurantId];
        if (status) {
            query += ` AND sr.status = $2`;
            params.push(status);
        }
        else {
            // Default: show requests from last 8 hours
            query += ` AND sr.created_at > NOW() - INTERVAL '8 hours'`;
        }
        query += ` ORDER BY sr.created_at DESC LIMIT 100`;
        const result = await db_1.default.query(query, params);
        res.json(result.rows);
    }
    catch (err) {
        console.error("Failed to fetch service requests:", err);
        res.status(500).json({ error: "Failed to fetch service requests" });
    }
});
/**
 * PATCH /api/restaurants/:restaurantId/service-requests/:requestId
 * Staff acknowledges or fulfills a service request.
 */
router.patch("/restaurants/:restaurantId/service-requests/:requestId", (0, featureFlags_1.requireFeature)("service_requests"), async (req, res) => {
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
        const result = await db_1.default.query(`UPDATE service_requests SET ${updates}
       WHERE id = $${whereIdx} AND restaurant_id = $${whereIdx + 1}
       RETURNING *`, params);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Service request not found" });
        }
        // Broadcast update to staff
        const io = websocket_1.webSocketServer.getIO();
        if (io) {
            const roomName = `restaurant-${restaurantId}-service-requests`;
            io.to(roomName).emit("service-request-updated", result.rows[0]);
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error("Failed to update service request:", err);
        res.status(500).json({ error: "Failed to update service request" });
    }
});
exports.default = router;
//# sourceMappingURL=serviceRequests.routes.js.map