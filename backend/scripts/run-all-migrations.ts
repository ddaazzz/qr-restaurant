import pool from "../src/config/db";
import fs from "fs";
import path from "path";

async function runAllMigrations() {
  try {
    console.log("🔄 Running All Database Migrations...\n");

    const migrationsDir = path.join(__dirname, "../migrations");
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      console.log(`▶️ Running: ${file}`);
      try {
        await pool.query(sql);
        console.log(`✅ ${file} completed\n`);
      } catch (err: any) {
        // Some migrations might have IF NOT EXISTS or similar idempotent patterns
        // Skip errors for already-applied migrations
        if (err.message.includes("already exists") || err.message.includes("IF NOT EXISTS")) {
          console.log(`⚠️ ${file} already applied (skipped)\n`);
        } else {
          console.error(`❌ ${file} failed:`, err.message);
          throw err;
        }
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 All Migrations Completed Successfully!");
    console.log("=".repeat(60));

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message);
    console.error("Details:", error);
    process.exit(1);
  }
}

runAllMigrations();
