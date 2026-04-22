import { Pool } from 'pg';
export interface PrinterZone {
    id: number;
    restaurant_id: number;
    zone_name: string;
    printer_type: string;
    printer_host?: string;
    printer_port?: number;
    created_at: Date;
    updated_at: Date;
}
export interface CategoryZoneMapping {
    id: number;
    zone_id: number;
    menu_category_id: number;
    created_at: Date;
}
export declare class PrinterZonesService {
    private pool;
    constructor(pool: Pool);
    /**
     * Create a new printer zone for a restaurant
     */
    createZone(restaurantId: number, zoneName: string, printerConfig: {
        type: string;
        host?: string;
        port?: number;
    }): Promise<PrinterZone>;
    /**
     * Get all zones for a restaurant
     */
    getZonesByRestaurant(restaurantId: number): Promise<PrinterZone[]>;
    /**
     * Get a specific zone
     */
    getZone(zoneId: number): Promise<PrinterZone | null>;
    /**
     * Update a printer zone
     */
    updateZone(zoneId: number, updates: Partial<{
        zoneName: string;
        printerType: string;
        printerHost: string;
        printerPort: number;
    }>): Promise<PrinterZone | null>;
    /**
     * Delete a printer zone
     */
    deleteZone(zoneId: number): Promise<boolean>;
    /**
     * Link a menu category to a printer zone
     */
    linkCategoryToZone(zoneId: number, categoryId: number): Promise<CategoryZoneMapping>;
    /**
     * Unlink a category from a printer zone
     */
    unlinkCategoryFromZone(zoneId: number, categoryId: number): Promise<boolean>;
    /**
     * Get all categories linked to a zone
     */
    getCategoriesForZone(zoneId: number): Promise<number[]>;
    /**
     * Get printer zone by category ID directly
     */
    getZoneByCategoryId(restaurantId: number, categoryId: number): Promise<PrinterZone | null>;
    /**
     * Get printer zone for a menu item (by category)
     */
    getZoneForMenuItem(restaurantId: number, menuItemId: number): Promise<PrinterZone | null>;
    /**
     * Get default zone for restaurant (first zone created)
     */
    getDefaultZone(restaurantId: number): Promise<PrinterZone | null>;
    /**
     * Format zone row from database
     */
    private formatZone;
    /**
     * Format mapping row from database
     */
    private formatMapping;
}
export declare function getPrinterZonesService(pool: Pool): PrinterZonesService;
//# sourceMappingURL=printerZones.d.ts.map