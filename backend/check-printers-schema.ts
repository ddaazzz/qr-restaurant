/**
 * Diagnostic script to check printers table schema and data
 * Run with: npx ts-node check-printers-schema.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'qr_restaurant',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function checkSchema() {
  try {
    console.log('🔍 Checking printers table schema...\n');

    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'printers'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Printers table does not exist!');
      return;
    }

    console.log('✅ Printers table exists\n');

    // Get column info
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'printers'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Table Schema:');
    console.table(columns.rows);

    // Check data
    const dataCheck = await pool.query(`
      SELECT COUNT(*) as total_rows FROM printers;
    `);

    console.log(`\n📊 Data Count: ${dataCheck.rows[0].total_rows} rows\n`);

    // Check specific restaurant
    const restaurantId = 1; // Change this to test different restaurant
    const printerData = await pool.query(`
      SELECT id, restaurant_id, type, printer_type, bluetooth_device_name
      FROM printers
      WHERE restaurant_id = $1
      ORDER BY type;
    `, [restaurantId]);

    console.log(`🍽️  Printers for restaurant ${restaurantId}:`);
    if (printerData.rows.length === 0) {
      console.log('   No printers configured');
    } else {
      console.table(printerData.rows);
    }

    // Check for NULL type fields
    const nullCheck = await pool.query(`
      SELECT COUNT(*) as null_type_rows FROM printers WHERE type IS NULL;
    `);

    if (nullCheck.rows[0].null_type_rows > 0) {
      console.log(`\n⚠️  WARNING: ${nullCheck.rows[0].null_type_rows} printers have NULL type!`);
      const nullRows = await pool.query(`
        SELECT id, restaurant_id, printer_type, printer_host FROM printers WHERE type IS NULL;
      `);
      console.table(nullRows.rows);
    } else {
      console.log('\n✅ No NULL type values found');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

checkSchema();
