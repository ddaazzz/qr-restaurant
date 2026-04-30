"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const pool = new pg_1.Pool({
    connectionString: 'postgresql://chuio_demo_user:lA7yJYtXe8gUFPg5j60Sc77nx9XeXnjP@dpg-d5neo34mrvns73fmt0sg-a.singapore-postgres.render.com/chuio_demo',
    ssl: { rejectUnauthorized: false }
});
async function checkKeys() {
    try {
        const result = await pool.query(`
      SELECT 
        id,
        app_id,
        platform_public_key IS NOT NULL as has_platform_key,
        app_private_key IS NOT NULL as has_app_key,
        keys_exchanged_at,
        keys_expire_at
      FROM payment_terminals
      WHERE id = 1
    `);
        if (result.rows.length > 0) {
            const row = result.rows[0];
            console.log('Payment Terminal 1 Key Storage Status:');
            console.log(`  ID: ${row.id}`);
            console.log(`  App ID: ${row.app_id}`);
            console.log(`  ✅ Platform Public Key Stored: ${row.has_platform_key}`);
            console.log(`  ✅ App Private Key Stored: ${row.has_app_key}`);
            console.log(`  Keys Exchanged At: ${row.keys_exchanged_at}`);
            console.log(`  Keys Expire At: ${row.keys_expire_at}`);
        }
        else {
            console.log('Terminal not found');
        }
    }
    catch (err) {
        console.error('Error:', err);
    }
    finally {
        pool.end();
    }
}
checkKeys();
//# sourceMappingURL=verifyKeys.js.map