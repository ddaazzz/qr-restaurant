import pool from "../src/config/db";

async function createKitchenStaff() {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    const restaurantId = 1;
    const pin = "000000";
    const role = "kitchen";

    console.log(`Creating kitchen staff with PIN ${pin} for restaurant ${restaurantId}...`);

    // Create kitchen staff user
    const result = await client.query(
      `INSERT INTO users (name, pin, role, restaurant_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (pin, restaurant_id) DO UPDATE
       SET role = $3
       RETURNING id, name, pin, role, restaurant_id`,
      ["Kitchen Staff", pin, role, restaurantId]
    );

    const user = result.rows[0];
    console.log("✅ Kitchen staff created/updated:", {
      id: user.id,
      name: user.name,
      pin: user.pin,
      role: user.role,
      restaurant_id: user.restaurant_id
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error creating kitchen staff:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

createKitchenStaff();
