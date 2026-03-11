const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const runMigration = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const migrationSql = fs.readFileSync('./migrations/030_add_printer_paper_width.sql', 'utf8');
    
    console.log('🔄 Running Migration 030: Add printer paper width...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    await pool.query(migrationSql);
    
    console.log('✅ Migration 030 completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📝 Changes applied:');
    console.log('  • Added printer_paper_width column (default: 80mm)');
    console.log('  • Created index for faster lookups');
    console.log('\n✨ Database is ready for adaptive QR code sizing!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runMigration();
