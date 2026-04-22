"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrinterZonesService = void 0;
exports.getPrinterZonesService = getPrinterZonesService;
class PrinterZonesService {
    constructor(pool) {
        this.pool = pool;
    }
    /**
     * Create a new printer zone for a restaurant
     */
    async createZone(restaurantId, zoneName, printerConfig) {
        const result = await this.pool.query(`INSERT INTO printer_zones (restaurant_id, zone_name, printer_type, printer_host, printer_port)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`, [
            restaurantId,
            zoneName,
            printerConfig.type,
            printerConfig.host || null,
            printerConfig.port || null,
        ]);
        return this.formatZone(result.rows[0]);
    }
    /**
     * Get all zones for a restaurant
     */
    async getZonesByRestaurant(restaurantId) {
        const result = await this.pool.query(`SELECT * FROM printer_zones WHERE restaurant_id = $1 ORDER BY zone_name ASC`, [restaurantId]);
        return result.rows.map(row => this.formatZone(row));
    }
    /**
     * Get a specific zone
     */
    async getZone(zoneId) {
        const result = await this.pool.query(`SELECT * FROM printer_zones WHERE id = $1`, [zoneId]);
        return result.rows.length > 0 ? this.formatZone(result.rows[0]) : null;
    }
    /**
     * Update a printer zone
     */
    async updateZone(zoneId, updates) {
        const fields = [];
        const values = [zoneId];
        let paramCount = 2;
        if (updates.zoneName !== undefined) {
            fields.push(`zone_name = $${paramCount++}`);
            values.push(updates.zoneName);
        }
        if (updates.printerType !== undefined) {
            fields.push(`printer_type = $${paramCount++}`);
            values.push(updates.printerType);
        }
        if (updates.printerHost !== undefined) {
            fields.push(`printer_host = $${paramCount++}`);
            values.push(updates.printerHost || null);
        }
        if (updates.printerPort !== undefined) {
            fields.push(`printer_port = $${paramCount++}`);
            values.push(updates.printerPort || null);
        }
        if (fields.length === 0) {
            return this.getZone(zoneId);
        }
        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        const result = await this.pool.query(`UPDATE printer_zones SET ${fields.join(', ')} WHERE id = $1 RETURNING *;`, values);
        return result.rows.length > 0 ? this.formatZone(result.rows[0]) : null;
    }
    /**
     * Delete a printer zone
     */
    async deleteZone(zoneId) {
        // Remove all category mappings first
        await this.pool.query(`DELETE FROM category_printer_zones WHERE zone_id = $1`, [zoneId]);
        // Delete the zone
        const result = await this.pool.query(`DELETE FROM printer_zones WHERE id = $1`, [zoneId]);
        return (result.rowCount || 0) > 0;
    }
    /**
     * Link a menu category to a printer zone
     */
    async linkCategoryToZone(zoneId, categoryId) {
        // Check if already linked
        const existingResult = await this.pool.query(`SELECT * FROM category_printer_zones WHERE zone_id = $1 AND menu_category_id = $2`, [zoneId, categoryId]);
        if (existingResult.rows.length > 0) {
            return this.formatMapping(existingResult.rows[0]);
        }
        // Create new link
        const result = await this.pool.query(`INSERT INTO category_printer_zones (zone_id, menu_category_id)
       VALUES ($1, $2)
       RETURNING *;`, [zoneId, categoryId]);
        return this.formatMapping(result.rows[0]);
    }
    /**
     * Unlink a category from a printer zone
     */
    async unlinkCategoryFromZone(zoneId, categoryId) {
        const result = await this.pool.query(`DELETE FROM category_printer_zones WHERE zone_id = $1 AND menu_category_id = $2`, [zoneId, categoryId]);
        return (result.rowCount || 0) > 0;
    }
    /**
     * Get all categories linked to a zone
     */
    async getCategoriesForZone(zoneId) {
        const result = await this.pool.query(`SELECT menu_category_id FROM category_printer_zones WHERE zone_id = $1 ORDER BY menu_category_id`, [zoneId]);
        return result.rows.map(row => row.menu_category_id);
    }
    /**
     * Get printer zone by category ID directly
     */
    async getZoneByCategoryId(restaurantId, categoryId) {
        if (!categoryId) {
            return null;
        }
        const zoneResult = await this.pool.query(`SELECT pz.* FROM printer_zones pz
       JOIN category_printer_zones cpz ON pz.id = cpz.zone_id
       WHERE pz.restaurant_id = $1 AND cpz.menu_category_id = $2
       LIMIT 1;`, [restaurantId, categoryId]);
        return zoneResult.rows.length > 0 ? this.formatZone(zoneResult.rows[0]) : null;
    }
    /**
     * Get printer zone for a menu item (by category)
     */
    async getZoneForMenuItem(restaurantId, menuItemId) {
        // Get the menu item's category
        const itemResult = await this.pool.query(`SELECT category_id FROM menu_items WHERE id = $1 AND restaurant_id = $2`, [menuItemId, restaurantId]);
        if (itemResult.rows.length === 0) {
            return null;
        }
        const categoryId = itemResult.rows[0].category_id;
        // Find zone for this category
        const zoneResult = await this.pool.query(`SELECT pz.* FROM printer_zones pz
       JOIN category_printer_zones cpz ON pz.id = cpz.zone_id
       WHERE pz.restaurant_id = $1 AND cpz.menu_category_id = $2
       LIMIT 1;`, [restaurantId, categoryId]);
        return zoneResult.rows.length > 0 ? this.formatZone(zoneResult.rows[0]) : null;
    }
    /**
     * Get default zone for restaurant (first zone created)
     */
    async getDefaultZone(restaurantId) {
        const result = await this.pool.query(`SELECT * FROM printer_zones WHERE restaurant_id = $1 ORDER BY created_at ASC LIMIT 1`, [restaurantId]);
        return result.rows.length > 0 ? this.formatZone(result.rows[0]) : null;
    }
    /**
     * Format zone row from database
     */
    formatZone(row) {
        return {
            id: row.id,
            restaurant_id: row.restaurant_id,
            zone_name: row.zone_name,
            printer_type: row.printer_type,
            printer_host: row.printer_host,
            printer_port: row.printer_port,
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at),
        };
    }
    /**
     * Format mapping row from database
     */
    formatMapping(row) {
        return {
            id: row.id,
            zone_id: row.zone_id,
            menu_category_id: row.menu_category_id,
            created_at: new Date(row.created_at),
        };
    }
}
exports.PrinterZonesService = PrinterZonesService;
// Singleton instance
let zonesInstance = null;
function getPrinterZonesService(pool) {
    if (!zonesInstance) {
        zonesInstance = new PrinterZonesService(pool);
    }
    return zonesInstance;
}
//# sourceMappingURL=printerZones.js.map