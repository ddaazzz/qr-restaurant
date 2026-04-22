"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const pool = new pg_1.Pool({
    connectionString: 'postgresql://chuio_demo_user:lA7yJYtXe8gUFPg5j60Sc77nx9XeXnjP@dpg-d5neo34mrvns73fmt0sg-a.singapore-postgres.render.com/chuio_demo',
    ssl: { rejectUnauthorized: false }
});
async function applyMigration() {
    try {
        console.log('Applying migration: Add payment key columns...');
        // Run the migration SQL
        const sql = `
      ALTER TABLE payment_terminals 
      ADD COLUMN IF NOT EXISTS platform_public_key TEXT,
      ADD COLUMN IF NOT EXISTS app_private_key TEXT,
      ADD COLUMN IF NOT EXISTS keys_exchanged_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS keys_expire_at TIMESTAMP;
      
      CREATE INDEX IF NOT EXISTS idx_payment_terminals_keys_valid 
      ON payment_terminals(restaurant_id, keys_exchanged_at);
    `;
        const result = await pool.query(sql);
        console.log('✅ Migration applied successfully');
        // Verify columns exist
        const check = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'payment_terminals'
      AND column_name IN ('platform_public_key', 'app_private_key', 'keys_exchanged_at', 'keys_expire_at')
    `);
        console.log(`\n✅ Columns created: ${check.rows.length}`);
        check.rows.forEach((row) => {
            console.log(`  - ${row.column_name}`);
        });
    }
    catch (err) {
        console.error('❌ Error:', err);
    }
    finally {
        pool.end();
    }
}
applyMigration();
//# sourceMappingURL=applyMigration.js.map