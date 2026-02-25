import pool from "./src/config/db";

async function checkColumn() {
  try {
    const res = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='restaurants' AND column_name='language_preference'
    `);
    
    if (res.rows.length > 0) {
      console.log('✓ language_preference column EXISTS');
    } else {
      console.log('✗ language_preference column NOT FOUND - running migration...');
      // Run the migration
      const fs = require('fs');
      const path = require('path');
      const migrationSql = fs.readFileSync(path.join(__dirname, 'migrations/024_add_language_preference.sql'), 'utf-8');
      await pool.query(migrationSql);
      console.log('✓ Migration applied successfully');
    }
    process.exit(0);
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkColumn();
