"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const pool = new pg_1.Pool({
    connectionString: 'postgresql://chuio_demo_user:lA7yJYtXe8gUFPg5j60Sc77nx9XeXnjP@dpg-d5neo34mrvns73fmt0sg-a.singapore-postgres.render.com/chuio_demo',
    ssl: { rejectUnauthorized: false }
});
async function checkSchema() {
    try {
        const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'payment_terminals'
      ORDER BY column_name
    `);
        console.log('Columns in payment_terminals table:');
        result.rows.forEach((row) => {
            console.log(`  - ${row.column_name}: ${row.data_type}`);
        });
        // Check specifically for our new columns
        const newColumns = ['platform_public_key', 'app_private_key', 'keys_exchanged_at', 'keys_expire_at'];
        console.log('\nNew columns status:');
        newColumns.forEach(col => {
            const exists = result.rows.some((r) => r.column_name === col);
            console.log(`  ${exists ? '✅' : '❌'} ${col}`);
        });
    }
    catch (err) {
        console.error('Error:', err);
    }
    finally {
        pool.end();
    }
}
checkSchema();
//# sourceMappingURL=checkSchema.js.map