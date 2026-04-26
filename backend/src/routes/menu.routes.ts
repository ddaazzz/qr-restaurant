import { Router } from "express";
import multer from "multer";
import pool from "../config/db";
import { upload } from "../config/upload";
import { isR2Configured, uploadToR2, getR2Folder } from "../config/storage";

const memoryUpload = multer({ storage: multer.memoryStorage() });

const router = Router();



//QR Landing Info

router.get("/qr/:token/landing", async (req, res) => {
  const { token } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        r.name AS restaurant_name,
        r.logo_url,
        r.address,
        r.phone,
        r.service_charge_percent,
        t.restaurant_id,
        t.name AS table_name,
        ts.id AS session_id,
        ts.pax

      FROM table_units tu
      JOIN tables t ON t.id = tu.table_id
      JOIN restaurants r ON r.id = t.restaurant_id
      LEFT JOIN table_sessions ts
        ON ts.table_id = t.id
       AND ts.ended_at IS NULL

      WHERE tu.qr_token = $1
      `,
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Invalid QR" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("QR landing load failed:", err);
    res.status(500).json({ error: "Failed to load QR landing" });
  }
});

/**
 * ==========================
 * MENU CATEGORIES (Admin)
 * ==========================
 */

/**
 * GET categories by restaurant
 * /api/menu_categories?restaurant_id=1
 */
router.get("/restaurants/:restaurantId/menu_categories",
  async (req, res) => {
    try {
      const restaurantId = Number(req.params.restaurantId);

      if (!restaurantId || Number.isNaN(restaurantId)) {
        return res.status(400).json({ error: "Invalid restaurant ID" });
      }

      const result = await pool.query(
        `
        SELECT id, name, name_zh, sort_order,
               COALESCE(time_restricted, FALSE) AS time_restricted,
               TO_CHAR(available_from, 'HH24:MI') AS available_from,
               TO_CHAR(available_to,   'HH24:MI') AS available_to
        FROM menu_categories
        WHERE restaurant_id = $1
        ORDER BY sort_order, id
        `,
        [restaurantId]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("LOAD CATEGORIES ERROR:", err);
      res.status(500).json({ error: "Failed to load categories" });
    }
  }
);

//Create category
router.post("/restaurants/:restaurantId/menu_categories",
  async (req, res) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const { name, name_zh } = req.body;

      if (!restaurantId || !name) {
        return res.status(400).json({
          error: "restaurantId and name required"
        });
      }

      const result = await pool.query(
        `
        INSERT INTO menu_categories (restaurant_id, name, name_zh)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [restaurantId, name.trim(), name_zh?.trim() || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("CREATE CATEGORY ERROR:", err);
      res.status(500).json({ error: "Failed to create category" });
    }
  }
);

//Update Category (name + time restriction)
router.patch("/menu_categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, name_zh, time_restricted, available_from, available_to } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let p = 1;

    if (name !== undefined) {
      updates.push(`name = $${p++}`);
      values.push(name.trim());
    }
    if (name_zh !== undefined) {
      updates.push(`name_zh = $${p++}`);
      values.push(name_zh?.trim() || null);
    }
    if (time_restricted !== undefined) {
      updates.push(`time_restricted = $${p++}`);
      values.push(!!time_restricted);
    }
    if (available_from !== undefined) {
      updates.push(`available_from = $${p++}`);
      values.push(available_from || null);
    }
    if (available_to !== undefined) {
      updates.push(`available_to = $${p++}`);
      values.push(available_to || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE menu_categories SET ${updates.join(", ")} WHERE id = $${p}
       RETURNING id, name, name_zh, sort_order,
                 COALESCE(time_restricted, FALSE) AS time_restricted,
                 TO_CHAR(available_from, 'HH24:MI') AS available_from,
                 TO_CHAR(available_to,   'HH24:MI') AS available_to`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("UPDATE CATEGORY ERROR:", err);
    res.status(500).json({ error: "Failed to update category" });
  }
});

//Delete Category name - ✅ MULTI-RESTAURANT SUPPORT
router.delete("/menu_categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { restaurantId } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ error: "Restaurant ID is required" });
    }

    // Verify category belongs to restaurant
    const categoryCheck = await pool.query(
      `SELECT id FROM menu_categories WHERE id = $1 AND restaurant_id = $2`,
      [id, restaurantId]
    );

    if (categoryCheck.rowCount === 0) {
      return res.status(404).json({ error: "Category not found or doesn't belong to this restaurant" });
    }

    const used = await pool.query(
      `
      SELECT 1
      FROM menu_items
      WHERE category_id = $1
      LIMIT 1
      `,
      [id]
    );

    if ((used?.rowCount ?? 0) > 0) {
      return res.status(400).json({
        error: "Cannot delete category with menu items"
      });
    }

    const result = await pool.query(
      "DELETE FROM menu_categories WHERE id = $1 AND restaurant_id = $2",
      [id, restaurantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE CATEGORY ERROR:", err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

/**
 * PUT /api/restaurants/:restaurantId/menu-categories/reorder
 * Bulk-update sort_order for menu categories
 */
router.put("/restaurants/:restaurantId/menu-categories/reorder", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { categories } = req.body;
    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: "categories array required" });
    }
    await Promise.all(
      categories.map(({ id, sort_order }) =>
        pool.query(
          "UPDATE menu_categories SET sort_order = $1 WHERE id = $2 AND restaurant_id = $3",
          [sort_order, id, restaurantId]
        )
      )
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("REORDER CATEGORIES ERROR:", err);
    res.status(500).json({ error: "Failed to reorder categories" });
  }
});

/**
 * PUT /api/restaurants/:restaurantId/menu-items/reorder
 * Bulk-update sort_order for menu items (within a category or globally)
 */
router.put("/restaurants/:restaurantId/menu-items/reorder", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items array required" });
    }
    await Promise.all(
      items.map(({ id, sort_order }) =>
        pool.query(
          "UPDATE menu_items SET sort_order = $1 WHERE id = $2",
          [sort_order, id]
        )
      )
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("REORDER ITEMS ERROR:", err);
    res.status(500).json({ error: "Failed to reorder items" });
  }
});

// Get full menu for a restaurant
// GET /restaurants/:restaurantId/menu
router.get("/restaurants/:restaurantId/menu", async (req, res) => {
      const restaurantId = Number(req.params.restaurantId);
       
      
      if (!restaurantId || Number.isNaN(restaurantId)) {
      return res.status(400).json({
        error: "Invalid restaurant ID"
      });
    }
    try {
        const categoriesResult = await pool.query(
            "SELECT id, name, name_zh, sort_order, time_restricted, available_from, available_to FROM menu_categories WHERE restaurant_id=$1 ORDER BY sort_order",
            [restaurantId]
        );

        const itemsResult = await pool.query(
            `SELECT mi.id, mi.name, mi.name_zh, mi.price_cents, mi.description, mi.available, mi.image_url,
                    mi.category_id, mi.is_meal_combo, mi.sort_order,
                    mc.name AS category_name, mc.name_zh AS category_name_zh
             FROM menu_items mi
             JOIN menu_categories mc ON mi.category_id=mc.id
             WHERE mi.available=true AND mc.restaurant_id=$1
             ORDER BY mi.sort_order, mi.id`,
            [restaurantId]
        );

        const items = itemsResult.rows;

        // fetch variants for all menu items
        const itemIds = items.map(i => i.id);
        let variants: any[] = [];
        if(itemIds.length > 0){
            const variantsResult = await pool.query(
                `SELECT
                  v.*,
                  o.id AS option_id,
                  o.name AS option_name,
                  o.price_cents,
                  o.is_available
                FROM menu_item_variants v
                LEFT JOIN menu_item_variant_options o
                  ON v.id = o.variant_id
                WHERE v.menu_item_id = ANY($1::int[])`
                ,
                [itemIds]
            );
            variants = variantsResult.rows;
        }

        // group variants per menu item
        const itemsWithVariants = items.map(item => {
            const itemVariants = variants
            .filter(v => v.menu_item_id === item.id)
            .reduce((acc: any[], v) => {
              let existing = acc.find(e => e.id === v.id);

              if (!existing) {
                existing = {
                  id: v.id,
                  name: v.name,
                  required: v.required,
                  min_select: v.min_select,
                  max_select: v.max_select,
                  options: []
                };
                acc.push(existing);
              }

              if (v.option_id) {
                existing.options.push({
                  id: v.option_id,
                  name: v.option_name,
                  price_cents: v.price_cents,
                  is_available: v.is_available
                });
              }

              return acc;
            }, []);

            return { ...item, variants: itemVariants };
        });

        res.json({ categories: categoriesResult.rows, items: itemsWithVariants });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});


// STAFF menu (see all items)
router.get("/restaurants/:restaurantId/menu/staff", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    //Load Menu Items
    const itemsResult = await pool.query(
      `
      SELECT
      mi.id,
      mi.name,
      mi.name_zh,
      mi.description,
      mi.price_cents,
      mi.available,
      mi.image_url,
      mi.category_id,
      mi.is_meal_combo,
      mc.name AS category_name,
      mc.name_zh AS category_name_zh
      FROM menu_items mi
      JOIN menu_categories mc ON mc.id = mi.category_id
      WHERE mc.restaurant_id = $1
      ORDER BY mc.sort_order, mi.id
      `,
      [restaurantId]
    
    );

    //Load Variants + Options
    const variantsResult = await pool.query(
  `
  SELECT
    v.id              AS variant_id,
    v.menu_item_id,
    v.name            AS variant_name,
    v.min_select,
    v.max_select,

    o.id              AS option_id,
    o.name            AS option_name,
    o.price_cents,
    o.is_available
  FROM menu_item_variants v
  LEFT JOIN menu_item_variant_options o
    ON o.variant_id = v.id
  WHERE v.menu_item_id = ANY($1)
  ORDER BY v.id, o.id
  `,
  [itemsResult.rows.map(i => i.id)]
);

  //Group Variants
    const variantsByItem: Record<number, any[]> = {};


    for (const row of variantsResult.rows) {
      if (!variantsByItem[row.menu_item_id]) {
        variantsByItem[row.menu_item_id] = [];
      }

      let variant = variantsByItem[row.menu_item_id]!.find(
        v => v.id === row.variant_id
      );

      if (!variant) {
        variant = {
          id: row.variant_id,
          name: row.variant_name,
          min_select: row.min_select,
          max_select: row.max_select,
          options: []
        };
        variantsByItem[row.menu_item_id]!.push(variant);
      }

      if (row.option_id) {
        variant.options.push({
          id: row.option_id,
          name: row.option_name,
          price_cents: row.price_cents,
          is_available: row.is_available
        });
      }
    }

    //Attach Variants to items
    const itemsWithVariants = itemsResult.rows.map(item => ({
      ...item,
      variants: variantsByItem[item.id] || []
    }));

        res.json(itemsWithVariants);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load staff menu" });
      }
    });

// STAFF toggle menu availability - ✅ MULTI-RESTAURANT SUPPORT
router.patch("/menu-items/:id/availability", async (req, res) => {
  try {
    const { id } = req.params;
    const { available, restaurantId } = req.body;

    if (typeof available !== "boolean") {
      return res.status(400).json({ error: "available must be boolean" });
    }

    if (!restaurantId) {
      return res.status(400).json({ error: "Restaurant ID is required" });
    }

    // Verify item belongs to restaurant
    const itemCheck = await pool.query(
      `SELECT mi.id FROM menu_items mi
       JOIN menu_categories mc ON mi.category_id = mc.id
       WHERE mi.id = $1 AND mc.restaurant_id = $2`,
      [id, restaurantId]
    );

    if (itemCheck.rowCount === 0) {
      return res.status(404).json({ error: "Menu item not found or doesn't belong to this restaurant" });
    }

    const result = await pool.query(
      `
      UPDATE menu_items
      SET available = $1
      WHERE id = $2
      RETURNING *
      `,
      [available, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update availability" });
  }
});

// STAFF toggle menu variant availability
router.patch("/menu-item-variant-options/:id/availability",
  async (req, res) => {
    const { id } = req.params;
    const { is_available } = req.body;

    await pool.query(
      `
      UPDATE menu_item_variant_options
      SET is_available = $1
      WHERE id = $2
      `,
      [is_available, id]
    );

    res.json({ success: true });
  }
);


/**
 * CREATE menu item - ✅ MULTI-RESTAURANT SUPPORT
 * (Admin)
 */
router.post("/restaurants/:restaurantId/menu-items", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const {
      category_id,
      name,
      name_zh,
      price_cents,
      description,
      is_meal_combo
    } = req.body;

    if (!category_id || !name || price_cents == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify category belongs to restaurant
    const categoryCheck = await pool.query(
      `SELECT id FROM menu_categories WHERE id = $1 AND restaurant_id = $2`,
      [category_id, restaurantId]
    );

    if (categoryCheck.rowCount === 0) {
      return res.status(400).json({ error: "Category not found or doesn't belong to this restaurant" });
    }

    const result = await pool.query(
      `
      INSERT INTO menu_items
        (category_id, name, name_zh, price_cents, description, available, is_meal_combo)
      VALUES ($1, $2, $3, $4, $5, true, $6)
      RETURNING *
      `,
      [
        category_id,
        name.trim(),
        name_zh?.trim() || null,
        price_cents,
        description || null,
        is_meal_combo || false
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create menu item" });
  }
});



/**
 * UPDATE menu item - ✅ MULTI-RESTAURANT SUPPORT
 * (Admin)
 */
router.patch("/menu-items/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;
    const {
      name,
      name_zh,
      price_cents,
      description,
      category_id,
      is_meal_combo,
      available,
      restaurantId
    } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ error: "Restaurant ID is required" });
    }

    // Verify item belongs to restaurant (via category)
    const itemCheck = await pool.query(
      `SELECT mi.id FROM menu_items mi
       JOIN menu_categories mc ON mi.category_id = mc.id
       WHERE mi.id = $1 AND mc.restaurant_id = $2`,
      [itemId, restaurantId]
    );

    if (itemCheck.rowCount === 0) {
      return res.status(404).json({ error: "Menu item not found or doesn't belong to this restaurant" });
    }

    // If updating category, verify new category belongs to same restaurant
    if (category_id) {
      const catCheck = await pool.query(
        `SELECT id FROM menu_categories WHERE id = $1 AND restaurant_id = $2`,
        [category_id, restaurantId]
      );

      if (catCheck.rowCount === 0) {
        return res.status(400).json({ error: "Category not found or doesn't belong to this restaurant" });
      }
    }

    const result = await pool.query(
      `
      UPDATE menu_items
      SET
        name = COALESCE($1, name),
        name_zh = COALESCE($2, name_zh),
        price_cents = COALESCE($3, price_cents),
        description = COALESCE($4, description),
        category_id = COALESCE($5, category_id),
        is_meal_combo = COALESCE($6, is_meal_combo),
        available = COALESCE($7, available)
      WHERE id = $8
      RETURNING *
      `,
      [
        name?.trim() ?? null,
        name_zh?.trim() ?? null,
        price_cents ?? null,
        description ?? null,
        category_id ?? null,
        is_meal_combo ?? null,
        available ?? null,
        itemId
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update menu item" });
  }
});

/**
 * DELETE menu item - ✅ MULTI-RESTAURANT SUPPORT
 * (Admin – safe)
 */
router.delete("/menu-items/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;
    const { restaurantId } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ error: "Restaurant ID is required" });
    }

    // Verify item belongs to restaurant
    const itemCheck = await pool.query(
      `SELECT mi.id FROM menu_items mi
       JOIN menu_categories mc ON mi.category_id = mc.id
       WHERE mi.id = $1 AND mc.restaurant_id = $2`,
      [itemId, restaurantId]
    );

    if (itemCheck.rowCount === 0) {
      return res.status(404).json({ error: "Menu item not found or doesn't belong to this restaurant" });
    }

    // Nullify references in order_items so order history is preserved
    await pool.query(
      `UPDATE order_items SET menu_item_id = NULL WHERE menu_item_id = $1`,
      [itemId]
    );

    const result = await pool.query(
      "DELETE FROM menu_items WHERE id = $1",
      [itemId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete menu item" });
  }
});
/**
 * GET variants for a menu item (Admin)
 */
router.get("/menu-items/:menuItemId/variants", async (req, res) => {
  try {
    const { menuItemId } = req.params;

    const result = await pool.query(
      `
      SELECT
        v.id,
        v.name,
        v.required,
        v.min_select,
        v.max_select,
        o.id AS option_id,
        o.name AS option_name,
        o.price_cents,
        o.is_available
      FROM menu_item_variants v
      LEFT JOIN menu_item_variant_options o
        ON o.variant_id = v.id
      WHERE v.menu_item_id = $1
      ORDER BY v.id, o.id
      `,
      [menuItemId]
    );

    // group options under variants
    const variants = result.rows.reduce((acc: any[], row) => {
      let v = acc.find(x => x.id === row.id);

      if (!v) {
        v = {
          id: row.id,
          name: row.name,
          required: row.required,
          min_select: row.min_select,
          max_select: row.max_select,
          options: []
        };
        acc.push(v);
      }

      if (row.option_id) {
        v.options.push({
          id: row.option_id,
          name: row.option_name,
          price_cents: row.price_cents,
          is_available: row.is_available
        });
      }

      return acc;
    }, []);

    res.json(variants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load variants" });
  }
});

/**
 * CREATE variant group
 * (Admin)
 */
router.post("/menu-items/:menuItemId/variants", async (req, res) => {
  try {
    const { menuItemId } = req.params;
    let { name, required, min_select, max_select } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Variant name required" });
    }

    if (
      min_select !== null &&
      max_select !== null &&
      min_select !== undefined &&
      max_select !== undefined &&
      max_select < min_select
    ) {
      return res.status(400).json({
        error: "max_select cannot be less than min_select"
      });
    }

if (required && min_select === null) {
  min_select = 1;
}

    if (!required && min_select && min_select > 0) {
  return res.status(400).json({
    error: "min_select cannot be > 0 if variant is not required"
  });
}


    const result = await pool.query(
      `
      INSERT INTO menu_item_variants
        (menu_item_id, name, required, min_select, max_select)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        menuItemId,
        name.trim(),
        required ?? false,
        min_select ?? null,
        max_select ?? null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create variant" });
  }
});



/**
 * UPDATE variant group
 * (Admin)
 */
router.patch("/variants/:variantId", async (req, res) => {
  try {
    const { variantId } = req.params;

    let {
      name,
      required,
      min_select,
      max_select
    } = req.body;

    // ---- NORMALIZATION ----
  
    if (
        min_select !== null &&
        max_select !== null &&
        min_select !== undefined &&
        max_select !== undefined &&
        max_select < min_select
      ) {
        return res.status(400).json({
          error: "max_select cannot be less than min_select"
        });
      }
    if (required && min_select === null) {
  min_select = 1;
}

    if (!required && min_select && min_select > 0) {
      return res.status(400).json({
        error: "min_select cannot be > 0 if variant is not required"
      });
    }


    const result = await pool.query(
      `
      UPDATE menu_item_variants
      SET
        name = COALESCE($1, name),
        required = COALESCE($2, required),
        min_select = COALESCE($3, min_select),
        max_select = COALESCE($4, max_select)
      WHERE id = $5
      RETURNING *
      `,
      [
        name?.trim() ?? null,
        required ?? null,
        min_select ?? null,
        max_select ?? null,
        variantId
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Variant not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("UPDATE VARIANT ERROR:", err);
    res.status(500).json({ error: "Failed to update variant" });
  }
});


/**
 * DELETE variant group
 * (Admin)
 */
router.delete("/variants/:variantId", async (req, res) => {
  try {
    const { variantId } = req.params;

    await pool.query(
      "DELETE FROM menu_item_variant_options WHERE variant_id = $1",
      [variantId]
    );

    const result = await pool.query(
      "DELETE FROM menu_item_variants WHERE id = $1",
      [variantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Variant not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete variant" });
  }
});

/**
 * CREATE variant option
 * (Admin)
 */
router.post("/variants/:variantId/options", async (req, res) => {
  try {
    const { variantId } = req.params;
    const { name, price_cents } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Option name required" });
    }

    const result = await pool.query(
      `
      INSERT INTO menu_item_variant_options
        (variant_id, name, price_cents)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [variantId, name.trim(), price_cents ?? 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create option" });
  }
});


/**
 * UPDATE variant option
 * (Admin)
 */
router.patch("/variant-options/:optionId", async (req, res) => {
  try {
    const { optionId } = req.params;
    const { name, price_cents } = req.body;

    const result = await pool.query(
      `
      UPDATE menu_item_variant_options
      SET
        name = COALESCE($1, name),
        price_cents = COALESCE($2, price_cents)
      WHERE id = $3
      RETURNING *
      `,
      [
        name?.trim() ?? null,
        price_cents ?? null,
        optionId
      ]
    );

    

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Option not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update option" });
  }
});

/**
 * DELETE variant option
 * (Admin)
 */

router.delete("/variant-options/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `DELETE FROM menu_item_variant_options WHERE id = $1`,
      [id]
    );

    res.status(204).end();
  } catch (err) {
    console.error("DELETE VARIANT OPTION ERROR:", err);
    res.status(500).json({ error: "Failed to delete option" });
  }
});


/**
 * UPLOAD menu item image
 * (Admin)
 */
router.post("/menu-items/:menuItemId/image",
  upload.single("image"),
  async (req, res) => {
    try {
      const { menuItemId } = req.params;
      const restaurantId = req.body.restaurantId || req.headers["x-restaurant-id"];

      if (!req.file) {
        return res.status(400).json({ error: "Image required" });
      }

      if (!restaurantId) {
        return res.status(400).json({ error: "restaurantId required" });
      }

      let imageUrl: string;
      if (isR2Configured() && req.file!.buffer) {
        imageUrl = await uploadToR2(req.file!.buffer, req.file!.originalname, getR2Folder("menu", restaurantId), req.file!.mimetype);
      } else {
        imageUrl = `/uploads/restaurants/${restaurantId}/menu/${req.file!.filename}`;
      }

      const result = await pool.query(
        `
        UPDATE menu_items
        SET image_url = $1
        WHERE id = $2
        RETURNING id, name, image_url
        `,
        [imageUrl, menuItemId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Menu item not found" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Image upload error:", err);
      res.status(500).json({ error: "Failed to upload image" });
    }
  }
);

router.post("/restaurants/:restaurantId/menu-items/:menuItemId/image",
  upload.single("image"),
  async (req, res) => {
    try {
      const { restaurantId, menuItemId } = req.params as { restaurantId: string; menuItemId: string };

      if (!req.file) {
        return res.status(400).json({ error: "Image required" });
      }

      const itemCheck = await pool.query(
        `SELECT mi.id FROM menu_items mi
         JOIN menu_categories mc ON mi.category_id = mc.id
         WHERE mi.id = $1 AND mc.restaurant_id = $2`,
        [menuItemId, restaurantId]
      );

      if (itemCheck.rowCount === 0) {
        return res.status(404).json({ error: "Menu item not found or doesn't belong to this restaurant" });
      }

      let imageUrl: string;
      if (isR2Configured() && req.file!.buffer) {
        imageUrl = await uploadToR2(req.file!.buffer, req.file!.originalname, getR2Folder("menu", restaurantId), req.file!.mimetype);
      } else {
        imageUrl = `/uploads/restaurants/${restaurantId}/menu/${req.file!.filename}`;
      }

      const result = await pool.query(
        `
        UPDATE menu_items
        SET image_url = $1
        WHERE id = $2
        RETURNING id, name, image_url
        `,
        [imageUrl, menuItemId]
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to upload image" });
    }
  }
);

// Endpoint for admin to fetch only items (without categories)
router.get("/restaurants/:restaurantId/menu/items", async (req, res) => {
  const restaurantId = Number(req.params.restaurantId);
  
  if (!restaurantId || Number.isNaN(restaurantId)) {
    return res.status(400).json({
      error: "Invalid restaurant ID"
    });
  }

  try {
    const itemsResult = await pool.query(
      `SELECT mi.*
       FROM menu_items mi
       JOIN menu_categories mc ON mi.category_id = mc.id
       WHERE mc.restaurant_id = $1`,
      [restaurantId]
    );

    res.json(itemsResult.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


/**
 * POST /api/restaurants/:restaurantId/menu-import
 * Import menu from Excel (.xlsx). Columns expected (row 0 = header):
 *   A: Menu Category English
 *   B: Menu Category Chinese
 *   C: Food Item Name Chinese
 *   D: Food Item Name English
 *   E: Food Item Image  (ignored – images are uploaded separately)
 *   F: Price            (numeric, dollars)
 *
 * Creates categories (deduped by English name) and menu items.
 * All items are created as available=true. Existing categories with the same
 * name are reused; existing items (same name + category) are skipped.
 */
router.post(
  "/restaurants/:restaurantId/menu-import",
  memoryUpload.single("file"),
  async (req, res) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId || Number.isNaN(restaurantId)) {
        return res.status(400).json({ error: "Invalid restaurant ID" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const XLSX = await import("xlsx");
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({ error: "Empty workbook" });
      }
      const sheet = workbook.Sheets[sheetName]!
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: null,
      });

      // Skip header row
      const dataRows = rows.slice(1).filter(
        (r) => r[0] || r[3] // must have category or English name
      );

      if (dataRows.length === 0) {
        return res.status(400).json({ error: "No data rows found in file" });
      }

      // Load existing categories for this restaurant
      const existingCats = await pool.query(
        "SELECT id, name FROM menu_categories WHERE restaurant_id = $1",
        [restaurantId]
      );
      const catMap: Record<string, number> = {};
      for (const row of existingCats.rows) {
        catMap[row.name.trim().toLowerCase()] = row.id;
      }

      const created = { categories: 0, items: 0, skipped: 0 };

      for (const row of dataRows) {
        const catNameEn = (row[0] ?? "").toString().trim();
        const catNameZh = (row[1] ?? "").toString().trim() || null;
        const itemNameZh = (row[2] ?? "").toString().trim() || null;
        const itemNameEn = (row[3] ?? "").toString().trim();
        const priceRaw = row[5];
        const priceCents = priceRaw != null ? Math.round(Number(priceRaw) * 100) : 0;

        if (!catNameEn && !itemNameEn) continue;

        // Resolve or create category
        const catKey = catNameEn.toLowerCase();
        let categoryId: number | undefined = catMap[catKey];
        if (!categoryId) {
          const catRes = await pool.query(
            `INSERT INTO menu_categories (restaurant_id, name, name_zh)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING
             RETURNING id`,
            [restaurantId, catNameEn, catNameZh]
          );
          if (catRes.rows.length > 0) {
            categoryId = catRes.rows[0].id as number;
            catMap[catKey] = categoryId;
            created.categories++;
          } else {
            // Rare race condition – re-fetch
            const refetch = await pool.query(
              "SELECT id FROM menu_categories WHERE restaurant_id=$1 AND lower(name)=$2",
              [restaurantId, catKey]
            );
            if (refetch.rows.length === 0) continue;
            categoryId = refetch.rows[0].id as number;
            catMap[catKey] = categoryId;
          }
        } else {
          // Update name_zh if provided and not yet set
          if (catNameZh) {
            await pool.query(
              `UPDATE menu_categories SET name_zh = COALESCE(name_zh, $1) WHERE id = $2`,
              [catNameZh, categoryId]
            );
          }
        }

        if (!itemNameEn) {
          created.skipped++;
          continue;
        }

        // Check if item already exists (by English name + category)
        const existing = await pool.query(
          "SELECT id FROM menu_items WHERE category_id=$1 AND lower(name)=$2",
          [categoryId, itemNameEn.toLowerCase()]
        );
        if (existing.rows.length > 0) {
          created.skipped++;
          continue;
        }

        await pool.query(
          `INSERT INTO menu_items (category_id, name, name_zh, price_cents, available)
           VALUES ($1, $2, $3, $4, true)`,
          [categoryId, itemNameEn, itemNameZh, priceCents]
        );
        created.items++;
      }

      res.json({
        ok: true,
        created_categories: created.categories,
        created_items: created.items,
        skipped_items: created.skipped,
      });
    } catch (err) {
      console.error("MENU IMPORT ERROR:", err);
      res.status(500).json({ error: "Failed to import menu" });
    }
  }
);

export default router;

