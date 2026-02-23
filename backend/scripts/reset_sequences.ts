import pool from "../src/config/db";

async function resetSequences() {
  try {
    console.log("🔄 Resetting database sequences...\n");

    // Truncate orders table and reset sequence
    console.log("1️⃣ Truncating orders table and resetting sequence...");
    await pool.query("TRUNCATE TABLE orders CASCADE");
    await pool.query("ALTER SEQUENCE orders_id_seq RESTART WITH 1");
    console.log("✅ Orders reset\n");

    // Truncate table_sessions table and reset sequence
    console.log("2️⃣ Truncating table_sessions table and resetting sequence...");
    await pool.query("TRUNCATE TABLE table_sessions CASCADE");
    await pool.query("ALTER SEQUENCE table_sessions_id_seq RESTART WITH 1");
    console.log("✅ Table sessions reset\n");

    // Truncate bill_closures for clean state
    console.log("3️⃣ Truncating bill_closures table...");
    await pool.query("TRUNCATE TABLE bill_closures CASCADE");
    console.log("✅ Bill closures reset\n");

    console.log("✨ Database reset complete! Sessions and orders will now start from 1.");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error resetting sequences:", error.message);
    process.exit(1);
  }
}

resetSequences();
