const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const runMigration = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const migrationSql = fs.readFileSync('./migrations/029_add_per_printer_type_columns.sql', 'utf8');
    
    console.log('🔄 Running Migration 029: Add per-printer-type columns...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    await pool.query(migrationSql);
    
    console.log('✅ Migration 029 completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📝 Changes applied:');
    console.log('  • Added QR printer config columns (qr_printer_type, qr_printer_host, etc)');
    console.log('  • Added Bill printer config columns (bill_printer_type, bill_printer_host, etc)');
    console.log('  • Added Kitchen printer config columns (kitchen_printer_type, etc)');
    console.log('  • Added indexes for faster lookups');
    console.log('\n✨ Database is ready for per-printer-type configuration!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runMigration();
