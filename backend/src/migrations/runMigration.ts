import pool from '../config/db';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    console.log('🔄 Running migration: 035_add_variant_preset_options.sql');
    
    const migrationPath = path.join(__dirname, '../../migrations/035_add_variant_preset_options.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolon to handle multiple statements
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.trim().substring(0, 80)}...`);
        await pool.query(statement);
      }
    }
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
