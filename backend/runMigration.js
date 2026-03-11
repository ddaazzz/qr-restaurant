const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qrrestaurant';

console.log('📊 Using DATABASE_URL:', DATABASE_URL.replace(/:[^@]*@/, ':****@'));

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false,
  statement_timeout: 30000,
});

async function runAllMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting database migration...');
    console.log(`📊 Database: ${DATABASE_URL}`);
    
    // Read all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`📁 Found ${migrationFiles.length} migration files`);
    
    // Run each migration
    for (const migrationFile of migrationFiles) {
      const migrationPath = path.join(migrationsDir, migrationFile);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
      
      try {
        console.log(`⏳ Running migration: ${migrationFile}`);
        
        // Start transaction
        await client.query('BEGIN');
        
        // Execute the migration
        await client.query(migrationSQL);
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log(`✅ Migration completed: ${migrationFile}`);
      } catch (err) {
        await client.query('ROLLBACK');
        
        // Check if it's a "already exists" type error (safe to ignore)
        if (err.message.includes('already exists') || err.message.includes('duplicate key')) {
          console.log(`⚠️  Skipping ${migrationFile} (already applied)`);
        } else {
          throw err;
        }
      }
    }
    
    console.log('✅ All migrations completed successfully!');
    console.log('🎉 Database schema is up to date');
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runAllMigrations();
