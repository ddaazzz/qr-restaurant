import bcrypt from "bcrypt";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function createSuperadmin() {
  try {
    // Create superadmin user (skip constraint updates to avoid existing row conflicts)
    const email = "superadmin@chuio.io";
    const password = "Chuio123!";
    const passwordHash = await bcrypt.hash(password, 10);

    // Check if superadmin already exists
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      console.log("✓ Superadmin user already exists:", email);
      return;
    }

    // Insert superadmin user (restaurant_id = 1, but will be flexible)
    const result = await pool.query(
      `INSERT INTO users (restaurant_id, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, role`,
      [1, email, passwordHash, "superadmin"]
    );

    console.log("✓ Superadmin user created successfully:");
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Role: superadmin`);
    console.log(`  ID: ${result.rows[0].id}`);
  } catch (err) {
    console.error("Error creating superadmin:", err);
  } finally {
    await pool.end();
  }
}

createSuperadmin();
