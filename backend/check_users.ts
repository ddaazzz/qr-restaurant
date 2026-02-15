import pool from "./src/config/db";

async function checkUsers() {
  try {
    const result = await pool.query("SELECT id, email, role FROM users;");
    console.log("Current users:");
    console.log(JSON.stringify(result.rows, null, 2));
    
    // Also check constraints
    const constraints = await pool.query(`
      SELECT constraint_name, check_clause 
      FROM information_schema.check_constraints 
      WHERE table_name = 'users';
    `);
    console.log("\nCurrent constraints:");
    console.log(JSON.stringify(constraints.rows, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  } finally {
    process.exit(0);
  }
}

checkUsers();
