/**
 * Cleanup Script: Remove old upload files after successful migration
 * This script only removes files that have already been migrated
 * Usage: npx ts-node scripts/cleanup-old-uploads.ts [--dry-run]
 */

import fs from "fs";
import path from "path";
import { pool } from "../src/db";
import dotenv from "dotenv";

dotenv.config();

const UPLOADS_BASE = path.join(__dirname, "../uploads");
const RESTAURANTS_OLD = path.join(UPLOADS_BASE, "restaurants");
const MENU_OLD = path.join(UPLOADS_BASE, "menu");

interface CleanupStats {
  filesRemoved: number;
  filesPreserved: number;
  errors: string[];
}

const stats: CleanupStats = {
  filesRemoved: 0,
  filesPreserved: 0,
  errors: []
};

const dryRun = process.argv.slice(2).includes("--dry-run");

if (dryRun) {
  console.log("🔍 DRY RUN MODE - No files will be deleted\n");
}

/**
 * Check if file has been migrated by verifying DB records
 */
async function isFileMigrated(filename: string, type: "logo" | "background" | "menu"): Promise<boolean> {
  try {
    if (type === "logo") {
      const res = await pool.query(
        "SELECT COUNT(*) FROM restaurants WHERE logo_url LIKE $1",
        [`%restaurants/%/${filename}`]
      );
      return res.rows[0].count > 0;
    } else if (type === "background") {
      const res = await pool.query(
        "SELECT COUNT(*) FROM restaurants WHERE background_url LIKE $1",
        [`%restaurants/%/${filename}`]
      );
      return res.rows[0].count > 0;
    } else {
      const res = await pool.query(
        "SELECT COUNT(*) FROM menu_items WHERE image_url LIKE $1",
        [`%restaurants/%/menu/${filename}`]
      );
      return res.rows[0].count > 0;
    }
  } catch (err) {
    console.error(`❌ Error checking migration status for ${filename}:`, err);
    return false;
  }
}

/**
 * Clean old restaurant files (logos and backgrounds)
 */
async function cleanOldRestaurantFiles() {
  console.log("🗑️  Cleaning old restaurant files...");

  if (!fs.existsSync(RESTAURANTS_OLD)) {
    console.log("ℹ️  Old restaurants folder does not exist");
    return;
  }

  const files = fs.readdirSync(RESTAURANTS_OLD);

  for (const file of files) {
    const oldPath = path.join(RESTAURANTS_OLD, file);

    // Skip if it's a directory (like the new restaurant ID folders)
    if (fs.statSync(oldPath).isDirectory()) {
      console.log(`⏭️  Skipping directory: ${file}`);
      continue;
    }

    // Check if this file has been migrated
    const isMigrated = await isFileMigrated(file, "logo") || await isFileMigrated(file, "background");

    if (isMigrated) {
      if (dryRun) {
        console.log(`📋 [DRY RUN] Would delete: ${file}`);
        stats.filesRemoved++;
      } else {
        try {
          fs.unlinkSync(oldPath);
          console.log(`✅ Deleted: ${file}`);
          stats.filesRemoved++;
        } catch (err) {
          const error = `Failed to delete ${file}: ${err}`;
          console.error(`❌ ${error}`);
          stats.errors.push(error);
        }
      }
    } else {
      console.log(`⏭️  Preserved (not migrated): ${file}`);
      stats.filesPreserved++;
    }
  }
}

/**
 * Clean old menu files
 */
async function cleanOldMenuFiles() {
  console.log("\n🗑️  Cleaning old menu files...");

  if (!fs.existsSync(MENU_OLD)) {
    console.log("ℹ️  Old menu folder does not exist");
    return;
  }

  const files = fs.readdirSync(MENU_OLD);

  for (const file of files) {
    const oldPath = path.join(MENU_OLD, file);

    // Skip if it's a directory
    if (fs.statSync(oldPath).isDirectory()) {
      console.log(`⏭️  Skipping directory: ${file}`);
      continue;
    }

    // Check if this file has been migrated
    const isMigrated = await isFileMigrated(file, "menu");

    if (isMigrated) {
      if (dryRun) {
        console.log(`📋 [DRY RUN] Would delete: ${file}`);
        stats.filesRemoved++;
      } else {
        try {
          fs.unlinkSync(oldPath);
          console.log(`✅ Deleted: ${file}`);
          stats.filesRemoved++;
        } catch (err) {
          const error = `Failed to delete ${file}: ${err}`;
          console.error(`❌ ${error}`);
          stats.errors.push(error);
        }
      }
    } else {
      console.log(`⏭️  Preserved (not migrated): ${file}`);
      stats.filesPreserved++;
    }
  }
}

/**
 * Main cleanup function
 */
async function cleanup() {
  try {
    console.log("🧹 Starting cleanup of old upload files...\n");

    await cleanOldRestaurantFiles();
    await cleanOldMenuFiles();

    // Print summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 CLEANUP SUMMARY");
    console.log("=".repeat(50));
    
    if (dryRun) {
      console.log(`📋 [DRY RUN] Files that would be removed: ${stats.filesRemoved}`);
    } else {
      console.log(`✅ Files removed: ${stats.filesRemoved}`);
    }
    
    console.log(`⏭️  Files preserved: ${stats.filesPreserved}`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
      stats.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
    } else {
      if (dryRun) {
        console.log(`\n✅ Dry run completed successfully!`);
        console.log(`Run without --dry-run flag to actually delete files.`);
      } else {
        console.log(`\n🎉 Cleanup completed successfully with no errors!`);
      }
    }

    console.log("=".repeat(50) + "\n");

    await pool.end();
    process.exit(stats.errors.length > 0 ? 1 : 0);

  } catch (err) {
    console.error("❌ Fatal error during cleanup:", err);
    await pool.end();
    process.exit(1);
  }
}

// Run cleanup
cleanup();
