import { Router } from "express";
import pool from "../config/db";
import { upload } from "../config/upload";

const router = Router();


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
        SELECT id, name, sort_order
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
      const { name } = req.body;

      if (!restaurantId || !name) {
        return res.status(400).json({
          error: "restaurantId and name required"
        });
      }

      const result = await pool.query(
        `
        INSERT INTO menu_categories (restaurant_id, name)
        VALUES ($1, $2)
        RETURNING *
        `,
        [restaurantId, name.trim()]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("CREATE CATEGORY ERROR:", err);
      res.status(500).json({ error: "Failed to create category" });
    }
  }
);

//Update Category Name
router.patch("/menu_categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "name required" });
    }

    const result = await pool.query(
      `
      UPDATE menu_categories
      SET name = $1
      WHERE id = $2
      RETURNING *
      `,
      [name.trim(), id]
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

//Delete Category name
router.delete("/menu_categories/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const used = await pool.query(
      `
      SELECT 1
      FROM menu_items
      WHERE category_id = $1
      LIMIT 1
      `,
      [id]
    );

    if (used?.rowCount > 0) {
      return res.status(400).json({
        error: "Cannot delete category with menu items"
      });
    }

    const result = await pool.query(
      "DELETE FROM menu_categories WHERE id = $1",
      [id]
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
            "SELECT * FROM menu_categories WHERE restaurant_id=$1 ORDER BY sort_order",
            [restaurantId]
        );

        const itemsResult = await pool.query(
            `SELECT mi.*, mc.name AS category_name
             FROM menu_items mi
             JOIN menu_categories mc ON mi.category_id=mc.id
             WHERE mi.available=true AND mc.restaurant_id=$1`,
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
      mi.price_cents,
      mi.available,
      mi.image_url,
      mi.category_id,              -- ✅ ADD THIS
      mc.name AS category_name
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

      let variant = variantsByItem[row?.menu_item_id].find(
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
        variantsByItem[row?.menu_item_id].push(variant);
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

// STAFF toggle menu availability
router.patch("/menu-items/:id/availability", async (req, res) => {
  try {
    const { id } = req.params;
    const { available } = req.body;

if (typeof available !== "boolean") {
  return res.status(400).json({ error: "available must be boolean" });
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
router.patch(
  "/menu-item-variant-options/:id/availability",
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
 * CREATE menu item
 * (Admin)
 */
router.post("/restaurants/:restaurantId/menu-items", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const {
      category_id,
      name,
      price_cents,
      description
    } = req.body;

    if (!category_id || !name || price_cents == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      `
      INSERT INTO menu_items
        (restaurant_id, category_id, name, price_cents, description, available)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *
      `,
      [
        restaurantId,
        category_id,
        name.trim(),
        price_cents,
        description || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create menu item" });
  }
});

/**
 * UPDATE menu item
 * (Admin)
 */
router.patch("/menu-items/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;
    const {
      name,
      price_cents,
      description,
      category_id
    } = req.body;

    const result = await pool.query(
      `
      UPDATE menu_items
      SET
        name = COALESCE($1, name),
        price_cents = COALESCE($2, price_cents),
        description = COALESCE($3, description),
        category_id = COALESCE($4, category_id)
      WHERE id = $5
      RETURNING *
      `,
      [
        name?.trim() ?? null,
        price_cents ?? null,
        description ?? null,
        category_id ?? null,
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
 * DELETE menu item
 * (Admin – safe)
 */
router.delete("/menu-items/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;

    // Prevent delete if item exists in orders
    const used = await pool.query(
      `
      SELECT 1
      FROM order_items
      WHERE menu_item_id = $1
      LIMIT 1
      `,
      [itemId]
    );

    if (used?.rowCount > 0) {
      return res.status(400).json({
        error: "Cannot delete item already ordered"
      });
    }

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
        o.price_cents
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
          price_cents: row.price_cents
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
router.post(
  "/menu-items/:menuItemId/image",
  upload.single("image"),
  async (req, res) => {
    try {
      const { menuItemId } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: "Image required" });
      }

      const imageUrl = `/uploads/menu/${req.file.filename}`;

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
      console.error(err);
      res.status(500).json({ error: "Failed to upload image" });
    }
  }
);

export default router;
