/**
 * Migration Script: Move uploads to restaurant-specific folders
 * Moves files from flat structure to uploads/restaurants/{restaurantId}/ structure
 * Usage: npx ts-node scripts/migrate-uploads.ts [restaurantId]
 */

import fs from "fs";
import path from "path";
import { pool } from "../src/db";
import dotenv from "dotenv";

dotenv.config();

const UPLOADS_BASE = path.join(__dirname, "../uploads");
const RESTAURANTS_OLD = path.join(UPLOADS_BASE, "restaurants");
const MENU_OLD = path.join(UPLOADS_BASE, "menu");

interface MigrationStats {
  logos: number;
  backgrounds: number;
  menuItems: number;
  totalFilesMoved: number;
  databaseUpdates: number;
  errors: string[];
}

const stats: MigrationStats = {
  logos: 0,
  backgrounds: 0,
  menuItems: 0,
  totalFilesMoved: 0,
  databaseUpdates: 0,
  errors: []
};

/**
 * Ensure directory exists
 */
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get restaurant IDs to migrate
 */
async function getRestaurantIds(specificId?: number): Promise<number[]> {
  try {
    if (specificId) {
      return [specificId];
    }

    const result = await pool.query("SELECT id FROM restaurants ORDER BY id");
    return result.rows.map((row: any) => row.id);
  } catch (err) {
    console.error("❌ Error fetching restaurants:", err);
    throw err;
  }
}

/**
 * Migrate restaurant logo and background files
 */
async function migrateRestaurantFiles(restaurantId: number) {
  console.log(`\n📂 Migrating files for restaurant ${restaurantId}...`);

  const restaurantDir = path.join(UPLOADS_BASE, "restaurants", String(restaurantId));
  ensureDir(restaurantDir);

  // Get restaurant info from DB
  const res = await pool.query(
    "SELECT logo_url, background_url FROM restaurants WHERE id = $1",
    [restaurantId]
  );

  if (res.rowCount === 0) {
    console.log(`⚠️  Restaurant ${restaurantId} not found`);
    return;
  }

  const restaurant = res.rows[0];

  // Migrate logo
  if (restaurant.logo_url) {
    const oldPath = path.join(UPLOADS_BASE, restaurant.logo_url.replace(/^\/uploads\//, ""));
    
    if (fs.existsSync(oldPath)) {
      const filename = path.basename(oldPath);
      const newPath = path.join(restaurantDir, filename);
      
      try {
        fs.copyFileSync(oldPath, newPath);
        
        const newUrl = `/uploads/restaurants/${restaurantId}/${filename}`;
        await pool.query(
          "UPDATE restaurants SET logo_url = $1 WHERE id = $2",
          [newUrl, restaurantId]
        );
        
        console.log(`✅ Logo migrated: ${filename}`);
        stats.logos++;
        stats.databaseUpdates++;
      } catch (err) {
        const error = `Failed to migrate logo: ${err}`;
        console.error(`❌ ${error}`);
        stats.errors.push(error);
      }
    }
  }

  // Migrate background
  if (restaurant.background_url) {
    const oldPath = path.join(UPLOADS_BASE, restaurant.background_url.replace(/^\/uploads\//, ""));
    
    if (fs.existsSync(oldPath)) {
      const filename = path.basename(oldPath);
      const newPath = path.join(restaurantDir, filename);
      
      try {
        fs.copyFileSync(oldPath, newPath);
        
        const newUrl = `/uploads/restaurants/${restaurantId}/${filename}`;
        await pool.query(
          "UPDATE restaurants SET background_url = $1 WHERE id = $2",
          [newUrl, restaurantId]
        );
        
        console.log(`✅ Background migrated: ${filename}`);
        stats.backgrounds++;
        stats.databaseUpdates++;
      } catch (err) {
        const error = `Failed to migrate background: ${err}`;
        console.error(`❌ ${error}`);
        stats.errors.push(error);
      }
    }
  }
}

/**
 * Migrate menu item images
 */
async function migrateMenuImages(restaurantId: number) {
  console.log(`\n🍽️  Migrating menu item images for restaurant ${restaurantId}...`);

  const menuDir = path.join(UPLOADS_BASE, "restaurants", String(restaurantId), "menu");
  ensureDir(menuDir);

  // Get all menu items with images for this restaurant
  const res = await pool.query(
    "SELECT id, image_url FROM menu_items WHERE restaurant_id = $1 AND image_url IS NOT NULL AND image_url != ''",
    [restaurantId]
  );

  if (res.rowCount === 0) {
    console.log(`ℹ️  No menu items with images found for restaurant ${restaurantId}`);
    return;
  }

  for (const item of res.rows) {
    const imageUrl = item.image_url;
    
    // Skip if already migrated
    if (imageUrl.includes(`/restaurants/${restaurantId}/menu/`)) {
      console.log(`⏭️  Already migrated: ${imageUrl}`);
      continue;
    }

    const oldPath = path.join(UPLOADS_BASE, imageUrl.replace(/^\/uploads\//, ""));
    
    if (fs.existsSync(oldPath)) {
      const filename = path.basename(oldPath);
      const newPath = path.join(menuDir, filename);
      
      try {
        fs.copyFileSync(oldPath, newPath);
        
        const newUrl = `/uploads/restaurants/${restaurantId}/menu/${filename}`;
        await pool.query(
          "UPDATE menu_items SET image_url = $1 WHERE id = $2",
          [newUrl, item.id]
        );
        
        console.log(`✅ Menu item image migrated: ${filename}`);
        stats.menuItems++;
        stats.databaseUpdates++;
      } catch (err) {
        const error = `Failed to migrate menu item ${item.id}: ${err}`;
        console.error(`❌ ${error}`);
        stats.errors.push(error);
      }
    } else {
      const error = `Menu item image file not found: ${oldPath}`;
      console.warn(`⚠️  ${error}`);
      stats.errors.push(error);
    }
  }
}

/**
 * Main migration function
 */
async function migrate() {
  try {
    console.log("🚀 Starting upload migration...\n");

    // Get restaurant ID from command line args
    const args = process.argv.slice(2);
    const restaurantId = args[0] ? parseInt(args[0]) : undefined;

    // Get list of restaurants to migrate
    const restaurantIds = await getRestaurantIds(restaurantId);
    console.log(`📋 Found ${restaurantIds.length} restaurant(s) to migrate: ${restaurantIds.join(", ")}`);

    // Migrate each restaurant
    for (const id of restaurantIds) {
      await migrateRestaurantFiles(id);
      await migrateMenuImages(id);
    }

    // Print summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 MIGRATION SUMMARY");
    console.log("=".repeat(50));
    console.log(`✅ Logos migrated: ${stats.logos}`);
    console.log(`✅ Backgrounds migrated: ${stats.backgrounds}`);
    console.log(`✅ Menu items migrated: ${stats.menuItems}`);
    console.log(`✅ Database records updated: ${stats.databaseUpdates}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
      stats.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
    } else {
      console.log(`\n🎉 Migration completed successfully with no errors!`);
    }

    console.log("=".repeat(50) + "\n");

    await pool.end();
    process.exit(stats.errors.length > 0 ? 1 : 0);

  } catch (err) {
    console.error("❌ Fatal error during migration:", err);
    await pool.end();
    process.exit(1);
  }
}

// Run migration
migrate();
