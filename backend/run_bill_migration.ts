import pool from "./src/config/db";

async function runBillMigration() {
  try {
    console.log("📊 Adding Bill Closure and POS Integration...\n");

    // Step 1: Add bill closure fields to table_sessions
    console.log("1️⃣ Adding bill closure fields to table_sessions...");
    await pool.query(`
      ALTER TABLE table_sessions 
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash',
      ADD COLUMN IF NOT EXISTS amount_paid BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discount_applied BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS closed_by_staff_id INTEGER,
      ADD COLUMN IF NOT EXISTS pos_reference VARCHAR(100) UNIQUE;
    `);
    console.log("✅ Bill closure fields added\n");

    // Step 2: Add POS webhook configuration to restaurants
    console.log("2️⃣ Adding POS webhook configuration to restaurants...");
    await pool.query(`
      ALTER TABLE restaurants 
      ADD COLUMN IF NOT EXISTS pos_webhook_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS pos_api_key VARCHAR(500);
    `);
    console.log("✅ POS webhook configuration added\n");

    // Step 3: Create bill closure audit table
    console.log("3️⃣ Creating bill closure audit table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bill_closures (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES table_sessions(id),
        closed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_by_staff_id INTEGER,
        payment_method VARCHAR(50),
        amount_paid BIGINT,
        discount_applied BIGINT,
        total_amount BIGINT,
        pos_reference VARCHAR(100),
        webhook_sent BOOLEAN DEFAULT false,
        webhook_response TEXT,
        notes TEXT
      );
    `);
    console.log("✅ Bill closure audit table created\n");

    // Step 4: Create indexes
    console.log("4️⃣ Creating indexes for performance...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bill_closures_session ON bill_closures(session_id);
      CREATE INDEX IF NOT EXISTS idx_bill_closures_pos_ref ON bill_closures(pos_reference);
      CREATE INDEX IF NOT EXISTS idx_table_sessions_pos_ref ON table_sessions(pos_reference);
    `);
    console.log("✅ Indexes created\n");

    // Step 5: Add table availability tracking
    console.log("5️⃣ Adding table availability tracking...");
    await pool.query(`
      ALTER TABLE tables 
      ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true;
    `);
    console.log("✅ Table availability tracking added\n");

    console.log("============================================================");
    console.log("🎉 Bill Closure and POS Migration Completed Successfully!");
    console.log("============================================================");
    console.log("\n✅ Database now supports:");
    console.log("  • Bill closure tracking with payment methods");
    console.log("  • POS webhook integration configuration");
    console.log("  • Bill closure audit trail");
    console.log("  • Table availability status");
    console.log("  • Performance indexes for quick lookups\n");

  } catch (err: any) {
    console.error("❌ Migration failed:", err.message);
    console.error("Details:", err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runBillMigration();
