"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../config/db"));
const printerZones_1 = require("../services/printerZones");
const router = express_1.default.Router();
/**
 * Get all printer zones for a restaurant
 */
router.get("/restaurants/:restaurantId/printer-zones", async (req, res) => {
    const restaurantId = req.params.restaurantId;
    try {
        const service = (0, printerZones_1.getPrinterZonesService)(db_1.default);
        const zones = await service.getZonesByRestaurant(parseInt(restaurantId));
        res.json({
            success: true,
            restaurantId: parseInt(restaurantId),
            zones,
        });
    }
    catch (err) {
        console.error("❌ Failed to fetch printer zones:", err);
        res.status(500).json({ error: "Failed to fetch printer zones" });
    }
});
/**
 * Create a new printer zone
 */
router.post("/restaurants/:restaurantId/printer-zones", async (req, res) => {
    const restaurantId = req.params.restaurantId;
    const { zone_name, printer_type, printer_host, printer_port } = req.body;
    if (!zone_name || !printer_type) {
        return res.status(400).json({ error: "zone_name and printer_type are required" });
    }
    try {
        // Verify restaurant exists
        const restaurantRes = await db_1.default.query("SELECT id FROM restaurants WHERE id = $1", [parseInt(restaurantId)]);
        if (restaurantRes.rowCount === 0) {
            return res.status(404).json({ error: "Restaurant not found" });
        }
        const service = (0, printerZones_1.getPrinterZonesService)(db_1.default);
        const zone = await service.createZone(parseInt(restaurantId), zone_name, {
            type: printer_type,
            host: printer_host,
            port: printer_port,
        });
        res.json({
            success: true,
            zone,
        });
    }
    catch (err) {
        console.error("❌ Failed to create printer zone:", err);
        res.status(500).json({ error: "Failed to create printer zone" });
    }
});
/**
 * Get a specific printer zone
 */
router.get("/printer-zones/:zoneId", async (req, res) => {
    const zoneId = req.params.zoneId;
    try {
        const service = (0, printerZones_1.getPrinterZonesService)(db_1.default);
        const zone = await service.getZone(parseInt(zoneId));
        if (!zone) {
            return res.status(404).json({ error: "Printer zone not found" });
        }
        res.json({
            success: true,
            zone,
        });
    }
    catch (err) {
        console.error("❌ Failed to fetch printer zone:", err);
        res.status(500).json({ error: "Failed to fetch printer zone" });
    }
});
/**
 * Update a printer zone
 */
router.patch("/printer-zones/:zoneId", async (req, res) => {
    const zoneId = req.params.zoneId;
    const { zone_name, printer_type, printer_host, printer_port } = req.body;
    try {
        const service = (0, printerZones_1.getPrinterZonesService)(db_1.default);
        const zone = await service.updateZone(parseInt(zoneId), {
            zoneName: zone_name,
            printerType: printer_type,
            printerHost: printer_host,
            printerPort: printer_port,
        });
        if (!zone) {
            return res.status(404).json({ error: "Printer zone not found" });
        }
        res.json({
            success: true,
            zone,
        });
    }
    catch (err) {
        console.error("❌ Failed to update printer zone:", err);
        res.status(500).json({ error: "Failed to update printer zone" });
    }
});
/**
 * Delete a printer zone
 */
router.delete("/printer-zones/:zoneId", async (req, res) => {
    const zoneId = req.params.zoneId;
    try {
        const service = (0, printerZones_1.getPrinterZonesService)(db_1.default);
        const deleted = await service.deleteZone(parseInt(zoneId));
        if (!deleted) {
            return res.status(404).json({ error: "Printer zone not found" });
        }
        res.json({
            success: true,
            message: "Printer zone deleted",
        });
    }
    catch (err) {
        console.error("❌ Failed to delete printer zone:", err);
        res.status(500).json({ error: "Failed to delete printer zone" });
    }
});
/**
 * Get categories linked to a zone
 */
router.get("/printer-zones/:zoneId/categories", async (req, res) => {
    const zoneId = req.params.zoneId;
    try {
        const service = (0, printerZones_1.getPrinterZonesService)(db_1.default);
        const categoryIds = await service.getCategoriesForZone(parseInt(zoneId));
        res.json({
            success: true,
            zoneId: parseInt(zoneId),
            categoryIds,
        });
    }
    catch (err) {
        console.error("❌ Failed to fetch zone categories:", err);
        res.status(500).json({ error: "Failed to fetch zone categories" });
    }
});
/**
 * Link a menu category to a printer zone
 */
router.post("/printer-zones/:zoneId/categories/:categoryId", async (req, res) => {
    const zoneId = req.params.zoneId;
    const categoryId = req.params.categoryId;
    try {
        const service = (0, printerZones_1.getPrinterZonesService)(db_1.default);
        // Verify zone exists
        const zone = await service.getZone(parseInt(zoneId));
        if (!zone) {
            return res.status(404).json({ error: "Printer zone not found" });
        }
        // Verify category exists
        const categoryRes = await db_1.default.query("SELECT id FROM menu_categories WHERE id = $1", [parseInt(categoryId)]);
        if (categoryRes.rowCount === 0) {
            return res.status(404).json({ error: "Menu category not found" });
        }
        const mapping = await service.linkCategoryToZone(parseInt(zoneId), parseInt(categoryId));
        res.json({
            success: true,
            message: "Category linked to zone",
            mapping,
        });
    }
    catch (err) {
        console.error("❌ Failed to link category to zone:", err);
        res.status(500).json({ error: "Failed to link category to zone" });
    }
});
/**
 * Unlink a menu category from a printer zone
 */
router.delete("/printer-zones/:zoneId/categories/:categoryId", async (req, res) => {
    const zoneId = req.params.zoneId;
    const categoryId = req.params.categoryId;
    try {
        const service = (0, printerZones_1.getPrinterZonesService)(db_1.default);
        const unlinked = await service.unlinkCategoryFromZone(parseInt(zoneId), parseInt(categoryId));
        if (!unlinked) {
            return res.status(404).json({ error: "Category not linked to zone" });
        }
        res.json({
            success: true,
            message: "Category unlinked from zone",
        });
    }
    catch (err) {
        console.error("❌ Failed to unlink category from zone:", err);
        res.status(500).json({ error: "Failed to unlink category from zone" });
    }
});
exports.default = router;
//# sourceMappingURL=printerZones.routes.js.map