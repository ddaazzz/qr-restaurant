import pool from "../src/config/db";

async function cleanData() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("🗑️  Starting database cleanup...\n");

    // 1. Delete order items
    const itemsRes = await client.query(`
      SELECT COUNT(*) as count FROM order_items
    `);
    console.log(`📊 Found ${itemsRes.rows[0].count} order items`);

    await client.query(`
      DELETE FROM order_items
      WHERE order_id IN (SELECT id FROM orders)
    `);
    console.log("✅ Deleted all order items");

    // 2. Delete orders
    const ordersRes = await client.query(`
      SELECT COUNT(*) as count FROM orders
    `);
    console.log(`📊 Found ${ordersRes.rows[0].count} orders`);

    await client.query(`
      DELETE FROM orders
      WHERE session_id IN (SELECT id FROM table_sessions)
    `);
    console.log("✅ Deleted all orders");

    // 3. Delete bill closures
    const billRes = await client.query(`
      SELECT COUNT(*) as count FROM bill_closures
    `);
    console.log(`📊 Found ${billRes.rows[0].count} bill closures`);

    await client.query(`
      DELETE FROM bill_closures
      WHERE session_id IN (SELECT id FROM table_sessions)
    `);
    console.log("✅ Deleted all bill closures");

    // 4. Delete sessions
    const sessionsRes = await client.query(`
      SELECT COUNT(*) as count FROM table_sessions
    `);
    console.log(`📊 Found ${sessionsRes.rows[0].count} sessions`);

    await client.query(`
      DELETE FROM table_sessions
    `);
    console.log("✅ Deleted all table sessions");

    await client.query("COMMIT");
    console.log("\n✅ Database cleanup complete!");
    console.log("🎉 All old data has been removed. Ready for fresh data.");

    await client.release();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error:", (err as any).message);
    await client.release();
    process.exit(1);
  }

  await pool.end();
}

cleanData();
