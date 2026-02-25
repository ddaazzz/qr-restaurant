import bcrypt from "bcrypt";
import pool from "./src/config/db";

async function updatePassword() {
  const email = "test@test123.com";
  const newPassword = "test1234";

  try {
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log(`Hashed password: ${hashedPassword}`);

    // Update the user's password
    const result = await pool.query(
      "UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, email",
      [hashedPassword, email]
    );

    if (result.rows.length === 0) {
      console.log(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    const updatedUser = result.rows[0];
    console.log(`✓ Password updated successfully for user: ${updatedUser.email} (ID: ${updatedUser.id})`);
    console.log(`✓ New password: ${newPassword}`);
    process.exit(0);
  } catch (error) {
    console.error("Error updating password:", error);
    process.exit(1);
  }
}

updatePassword();
