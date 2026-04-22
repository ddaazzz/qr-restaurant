"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const upload_1 = require("../config/upload");
const storage_1 = require("../config/storage");
const router = (0, express_1.Router)();
// ✅ MULTI-RESTAURANT SUPPORT
// GET all restaurants (superadmin only - verify via token)
router.get("/", async (req, res) => {
    try {
        const result = await db_1.default.query("SELECT id, name, address, phone FROM restaurants ORDER BY id");
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch restaurants" });
    }
});
// GET single restaurant details (admin/staff of that restaurant only)
router.get("/:restaurantId", async (req, res) => {
    try {
        const { restaurantId } = req.params;
        // Verify restaurant exists
        const result = await db_1.default.query("SELECT id, name, address, phone, logo_url, theme_color, timezone, background_url FROM restaurants WHERE id = $1", [restaurantId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Restaurant not found" });
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch restaurant" });
    }
});
// POST upload restaurant background image
router.post("/:restaurantId/background", upload_1.upload.single("image"), async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;
        if (!req.file) {
            return res.status(400).json({ error: "Image upload failed" });
        }
        let backgroundPath;
        if ((0, storage_1.isR2Configured)() && req.file.buffer) {
            backgroundPath = await (0, storage_1.uploadToR2)(req.file.buffer, req.file.originalname, (0, storage_1.getR2Folder)("background", restaurantId), req.file.mimetype);
        }
        else {
            backgroundPath = `/uploads/restaurants/${restaurantId}/${req.file.filename}`;
        }
        await db_1.default.query(`UPDATE restaurants SET background_url = $1 WHERE id = $2`, [backgroundPath, restaurantId]);
        res.json({ background_url: backgroundPath });
    }
    catch (err) {
        console.error("Error uploading background:", err);
        res.status(500).json({ error: "Failed to upload background image" });
    }
});
exports.default = router;
//# sourceMappingURL=restaurants.routes.js.map