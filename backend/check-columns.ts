import pool from "./src/config/db";

async function check() {
  try {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY column_name`
    );
    
    const columns = result.rows.map(r => r.column_name);
    console.log("Columns in users table:", columns);
    
    if (columns.includes("hourly_rate_cents")) {
      console.log("✅ hourly_rate_cents column EXISTS");
    } else {
      console.log("❌ hourly_rate_cents column MISSING - migration not applied");
    }
    
    await pool.end();
  } catch (err: any) {
    console.error("Error:", err.message);
    await pool.end();
  }
}

check();
