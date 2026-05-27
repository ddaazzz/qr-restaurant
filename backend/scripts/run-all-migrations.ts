import pool from "../src/config/db";
import fs from "fs";
import path from "path";

async function runAllMigrations() {
  try {
    console.log("🔄 Running All Database Migrations...\n");

    // Ensure migration tracking table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT now()
      )
    `);

    // Get already-applied migrations
    const appliedResult = await pool.query("SELECT filename FROM schema_migrations");
    const applied = new Set(appliedResult.rows.map((r: any) => r.filename));

    const migrationsDir = path.join(__dirname, "../migrations");
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`⏭️  ${file} already applied (skipped)\n`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      console.log(`▶️ Running: ${file}`);
      try {
        await pool.query(sql);
        await pool.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        console.log(`✅ ${file} completed\n`);
      } catch (err: any) {
        console.error(`❌ ${file} failed:`, err.message);
        throw err;
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
