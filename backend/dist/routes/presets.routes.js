"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const router = (0, express_1.Router)();
// ============= ADDON PRESETS =============
/**
 * GET /api/restaurants/:restaurantId/addon-presets
 * Get all addon presets for a restaurant
 */
router.get('/restaurants/:restaurantId/addon-presets', async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;
        const result = await db_1.default.query(`SELECT p.id, p.name, p.description, p.is_active, 
              COUNT(api.id) as items_count
       FROM addon_presets p
       LEFT JOIN addon_preset_items api ON p.id = api.addon_preset_id
       WHERE p.restaurant_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`, [restaurantId]);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Error fetching addon presets:', err);
        res.status(500).json({ error: 'Failed to fetch presets' });
    }
});
/**
 * GET /api/restaurants/:restaurantId/addon-presets/:presetId
 * Get a single addon preset with details
 */
router.get('/restaurants/:restaurantId/addon-presets/:presetId', async (req, res) => {
    try {
        const { restaurantId, presetId } = req.params;
        const result = await db_1.default.query(`SELECT * FROM addon_presets WHERE id = $1 AND restaurant_id = $2`, [presetId, restaurantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Preset not found' });
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Error fetching addon preset:', err);
        res.status(500).json({ error: 'Failed to fetch preset' });
    }
});
/**
 * GET /api/restaurants/:restaurantId/addon-presets/:presetId/items
 * Get all items in an addon preset
 */
router.get('/restaurants/:restaurantId/addon-presets/:presetId/items', async (req, res) => {
    try {
        const { restaurantId, presetId } = req.params;
        const result = await db_1.default.query(`SELECT api.id, api.addon_preset_id, api.menu_item_id, 
              api.addon_discount_price_cents, api.is_available,
              mi.name, mi.price_cents, mi.image_url
       FROM addon_preset_items api
       JOIN menu_items mi ON api.menu_item_id = mi.id
       WHERE api.addon_preset_id = $1
       AND $1 IN (SELECT id FROM addon_presets WHERE restaurant_id = $2)
       ORDER BY api.created_at`, [presetId, restaurantId]);
        // Format response with nested menu_item object
        const items = result.rows.map(row => ({
            id: row.id,
            addon_preset_id: row.addon_preset_id,
            menu_item_id: row.menu_item_id,
            addon_discount_price_cents: row.addon_discount_price_cents,
            is_available: row.is_available,
            menu_item: {
                id: row.menu_item_id,
                name: row.name,
                price_cents: row.price_cents,
                image_url: row.image_url
            }
        }));
        res.json(items);
    }
    catch (err) {
        console.error('Error fetching preset items:', err);
        res.status(500).json({ error: 'Failed to fetch items' });
    }
});
/**
 * POST /api/restaurants/:restaurantId/addon-presets
 * Create a new addon preset
 */
router.post('/restaurants/:restaurantId/addon-presets', async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;
        const { name, description, is_active = true } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        const result = await db_1.default.query(`INSERT INTO addon_presets (restaurant_id, name, description, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [restaurantId, name, description || null, is_active]);
        res.json(result.rows[0]);
    }
    catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Preset with this name already exists' });
        }
        console.error('Error creating addon preset:', err);
        res.status(500).json({ error: 'Failed to create preset' });
    }
});
/**
 * POST /api/restaurants/:restaurantId/addon-presets/:presetId/items
 * Add an item to an addon preset
 */
router.post('/restaurants/:restaurantId/addon-presets/:presetId/items', async (req, res) => {
    try {
        const { restaurantId, presetId } = req.params;
        const { menu_item_id, addon_discount_price_cents = 0 } = req.body;
        if (!menu_item_id) {
            return res.status(400).json({ error: 'menu_item_id is required' });
        }
        // Verify preset belongs to restaurant
        const presetCheck = await db_1.default.query(`SELECT id FROM addon_presets WHERE id = $1 AND restaurant_id = $2`, [presetId, restaurantId]);
        if (presetCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Preset not found' });
        }
        const result = await db_1.default.query(`INSERT INTO addon_preset_items (addon_preset_id, menu_item_id, addon_discount_price_cents, is_available)
       VALUES ($1, $2, $3, true)
       RETURNING *`, [presetId, menu_item_id, addon_discount_price_cents]);
        res.json(result.rows[0]);
    }
    catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Item already in preset' });
        }
        console.error('Error adding item to preset:', err);
        res.status(500).json({ error: 'Failed to add item' });
    }
});
/**
 * DELETE /api/restaurants/:restaurantId/addon-presets/:presetId/items/:itemId
 * Remove an item from an addon preset
 */
router.delete('/restaurants/:restaurantId/addon-presets/:presetId/items/:itemId', async (req, res) => {
    try {
        const { restaurantId, presetId, itemId } = req.params;
        // Verify preset belongs to restaurant
        const presetCheck = await db_1.default.query(`SELECT id FROM addon_presets WHERE id = $1 AND restaurant_id = $2`, [presetId, restaurantId]);
        if (presetCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Preset not found' });
        }
        await db_1.default.query(`DELETE FROM addon_preset_items WHERE id = $1 AND addon_preset_id = $2`, [itemId, presetId]);
        res.json({ message: 'Item removed' });
    }
    catch (err) {
        console.error('Error removing item from preset:', err);
        res.status(500).json({ error: 'Failed to remove item' });
    }
});
/**
 * DELETE /api/restaurants/:restaurantId/addon-presets/:presetId
 * Delete an addon preset
 */
router.delete('/restaurants/:restaurantId/addon-presets/:presetId', async (req, res) => {
    try {
        const { restaurantId, presetId } = req.params;
        const result = await db_1.default.query(`DELETE FROM addon_presets WHERE id = $1 AND restaurant_id = $2 RETURNING id`, [presetId, restaurantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Preset not found' });
        }
        res.json({ message: 'Preset deleted' });
    }
    catch (err) {
        console.error('Error deleting addon preset:', err);
        res.status(500).json({ error: 'Failed to delete preset' });
    }
});
// ============= VARIANT PRESETS =============
/**
 * GET /api/restaurants/:restaurantId/variant-presets
 * Get all variant presets for a restaurant
 */
router.get('/restaurants/:restaurantId/variant-presets', async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;
        const result = await db_1.default.query(`SELECT p.id, p.name, p.description, p.is_active,
              COUNT(vpi.id) as variants_count
       FROM variant_presets p
       LEFT JOIN variant_preset_items vpi ON p.id = vpi.variant_preset_id
       WHERE p.restaurant_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`, [restaurantId]);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Error fetching variant presets:', err);
        res.status(500).json({ error: 'Failed to fetch presets' });
    }
});
/**
 * GET /api/restaurants/:restaurantId/variant-presets/:presetId
 * Get a single variant preset with details
 */
router.get('/restaurants/:restaurantId/variant-presets/:presetId', async (req, res) => {
    try {
        const { restaurantId, presetId } = req.params;
        const result = await db_1.default.query(`SELECT * FROM variant_presets WHERE id = $1 AND restaurant_id = $2`, [presetId, restaurantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Preset not found' });
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Error fetching variant preset:', err);
        res.status(500).json({ error: 'Failed to fetch preset' });
    }
});
/**
 * GET /api/restaurants/:restaurantId/variant-presets/:presetId/variants
 * Get all variants in a variant preset
 */
router.get('/restaurants/:restaurantId/variant-presets/:presetId/variants', async (req, res) => {
    try {
        const { restaurantId, presetId } = req.params;
        const result = await db_1.default.query(`SELECT vpi.id, vpi.variant_preset_id, vpi.variant_id,
              mv.id as variant_id, mv.name, mv.required, mv.min_select, mv.max_select,
              mi.name as menu_item_name
       FROM variant_preset_items vpi
       JOIN menu_item_variants mv ON vpi.variant_id = mv.id
       LEFT JOIN menu_items mi ON mv.menu_item_id = mi.id
       WHERE vpi.variant_preset_id = $1
       AND $1 IN (SELECT id FROM variant_presets WHERE restaurant_id = $2)
       ORDER BY vpi.created_at`, [presetId, restaurantId]);
        const variants = result.rows.map(row => ({
            id: row.id,
            variant_preset_id: row.variant_preset_id,
            variant_id: row.variant_id,
            variant: {
                id: row.variant_id,
                name: row.name,
                required: row.required,
                min_select: row.min_select,
                max_select: row.max_select
            },
            menu_item_name: row.menu_item_name
        }));
        res.json(variants);
    }
    catch (err) {
        console.error('Error fetching variant preset items:', err);
        res.status(500).json({ error: 'Failed to fetch variants' });
    }
});
/**
 * POST /api/restaurants/:restaurantId/variant-presets
 * Create a new variant preset
 */
router.post('/restaurants/:restaurantId/variant-presets', async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;
        const { name, description, is_active = true } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        const result = await db_1.default.query(`INSERT INTO variant_presets (restaurant_id, name, description, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [restaurantId, name, description || null, is_active]);
        res.json(result.rows[0]);
    }
    catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Preset with this name already exists' });
        }
        console.error('Error creating variant preset:', err);
        res.status(500).json({ error: 'Failed to create preset' });
    }
});
/**
 * POST /api/restaurants/:restaurantId/variant-presets/:presetId/variants
 * Add a variant to a variant preset
 */
router.post('/restaurants/:restaurantId/variant-presets/:presetId/variants', async (req, res) => {
    try {
        const { restaurantId, presetId } = req.params;
        const { variant_id } = req.body;
        if (!variant_id) {
            return res.status(400).json({ error: 'variant_id is required' });
        }
        // Verify preset belongs to restaurant
        const presetCheck = await db_1.default.query(`SELECT id FROM variant_presets WHERE id = $1 AND restaurant_id = $2`, [presetId, restaurantId]);
        if (presetCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Preset not found' });
        }
        const result = await db_1.default.query(`INSERT INTO variant_preset_items (variant_preset_id, variant_id)
       VALUES ($1, $2)
       RETURNING *`, [presetId, variant_id]);
        res.json(result.rows[0]);
    }
    catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Variant already in preset' });
        }
        console.error('Error adding variant to preset:', err);
        res.status(500).json({ error: 'Failed to add variant' });
    }
});
/**
 * DELETE /api/restaurants/:restaurantId/variant-presets/:presetId/variants/:variantId
 * Remove a variant from a variant preset
 */
router.delete('/restaurants/:restaurantId/variant-presets/:presetId/variants/:variantId', async (req, res) => {
    try {
        const { restaurantId, presetId, variantId } = req.params;
        // Verify preset belongs to restaurant
        const presetCheck = await db_1.default.query(`SELECT id FROM variant_presets WHERE id = $1 AND restaurant_id = $2`, [presetId, restaurantId]);
        if (presetCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Preset not found' });
        }
        await db_1.default.query(`DELETE FROM variant_preset_items WHERE variant_preset_id = $1 AND variant_id = $2`, [presetId, variantId]);
        res.json({ message: 'Variant removed' });
    }
    catch (err) {
        console.error('Error removing variant from preset:', err);
        res.status(500).json({ error: 'Failed to remove variant' });
    }
});
/**
 * DELETE /api/restaurants/:restaurantId/variant-presets/:presetId
 * Delete a variant preset
 */
router.delete('/restaurants/:restaurantId/variant-presets/:presetId', async (req, res) => {
    try {
        const { restaurantId, presetId } = req.params;
        const result = await db_1.default.query(`DELETE FROM variant_presets WHERE id = $1 AND restaurant_id = $2 RETURNING id`, [presetId, restaurantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Preset not found' });
        }
        res.json({ message: 'Preset deleted' });
    }
    catch (err) {
        console.error('Error deleting variant preset:', err);
        res.status(500).json({ error: 'Failed to delete preset' });
    }
});
// ============= VARIANT PRESET OPTIONS =============
/**
 * GET /api/restaurants/:restaurantId/variant-presets/:presetId/options
 * Get all options for a variant preset
 */
router.get('/restaurants/:restaurantId/variant-presets/:presetId/options', async (req, res) => {
    try {
        const { restaurantId, presetId } = req.params;
        const result = await db_1.default.query(`SELECT * FROM variant_preset_options 
       WHERE variant_preset_id = $1 AND restaurant_id = $2
       ORDER BY display_order, created_at`, [presetId, restaurantId]);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Error fetching variant preset options:', err);
        res.status(500).json({ error: 'Failed to fetch options' });
    }
});
/**
 * GET /api/restaurants/:restaurantId/variant-presets/:presetId/options/:optionId
 * Get a single option from a variant preset
 */
router.get('/restaurants/:restaurantId/variant-presets/:presetId/options/:optionId', async (req, res) => {
    try {
        const { restaurantId, presetId, optionId } = req.params;
        const result = await db_1.default.query(`SELECT * FROM variant_preset_options 
       WHERE id = $1 AND variant_preset_id = $2 AND restaurant_id = $3`, [optionId, presetId, restaurantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Option not found' });
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Error fetching variant preset option:', err);
        res.status(500).json({ error: 'Failed to fetch option' });
    }
});
/**
 * POST /api/restaurants/:restaurantId/variant-presets/:presetId/options
 * Create a new option in a variant preset
 */
router.post('/restaurants/:restaurantId/variant-presets/:presetId/options', async (req, res) => {
    try {
        const { restaurantId, presetId } = req.params;
        const { name, price_cents } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Option name required' });
        }
        // Verify preset belongs to restaurant
        const presetCheck = await db_1.default.query(`SELECT id FROM variant_presets WHERE id = $1 AND restaurant_id = $2`, [presetId, restaurantId]);
        if (presetCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Preset not found' });
        }
        const result = await db_1.default.query(`INSERT INTO variant_preset_options
        (variant_preset_id, restaurant_id, name, price_cents, display_order)
       VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(display_order) FROM variant_preset_options WHERE variant_preset_id = $1), 0) + 1)
       RETURNING *`, [presetId, restaurantId, name.trim(), price_cents ?? 0]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error('Error creating variant preset option:', err);
        res.status(500).json({ error: 'Failed to create option' });
    }
});
/**
 * PATCH /api/restaurants/:restaurantId/variant-presets/:presetId/options/:optionId
 * Update an option in a variant preset
 */
router.patch('/restaurants/:restaurantId/variant-presets/:presetId/options/:optionId', async (req, res) => {
    try {
        const { restaurantId, presetId, optionId } = req.params;
        const { name, price_cents } = req.body;
        const result = await db_1.default.query(`UPDATE variant_preset_options
       SET name = COALESCE($1, name),
           price_cents = COALESCE($2, price_cents),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND variant_preset_id = $4 AND restaurant_id = $5
       RETURNING *`, [name?.trim() ?? null, price_cents ?? null, optionId, presetId, restaurantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Option not found' });
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Error updating variant preset option:', err);
        res.status(500).json({ error: 'Failed to update option' });
    }
});
/**
 * DELETE /api/restaurants/:restaurantId/variant-presets/:presetId/options/:optionId
 * Delete an option from a variant preset
 */
router.delete('/restaurants/:restaurantId/variant-presets/:presetId/options/:optionId', async (req, res) => {
    try {
        const { restaurantId, presetId, optionId } = req.params;
        const result = await db_1.default.query(`DELETE FROM variant_preset_options
       WHERE id = $1 AND variant_preset_id = $2 AND restaurant_id = $3
       RETURNING id`, [optionId, presetId, restaurantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Option not found' });
        }
        res.status(204).end();
    }
    catch (err) {
        console.error('Error deleting variant preset option:', err);
        res.status(500).json({ error: 'Failed to delete option' });
    }
});
exports.default = router;
//# sourceMappingURL=presets.routes.js.map