const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'restaurant_db',
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting migration: Addon System Support');
    
    await client.query('BEGIN');

    // 1. Create addons table
    console.log('📝 Creating addons table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS addons (
        id SERIAL PRIMARY KEY,
        restaurant_id INTEGER NOT NULL,
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        addon_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
        regular_price_cents INTEGER NOT NULL,
        addon_discount_price_cents INTEGER NOT NULL,
        is_available BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT addon_fk_restaurant FOREIGN KEY (restaurant_id) 
          REFERENCES restaurants(id) ON DELETE CASCADE,
        CONSTRAINT addon_unique_per_menu_item UNIQUE(restaurant_id, menu_item_id, addon_item_id)
      );
    `);

    // Create indexes for addon queries
    console.log('📑 Creating addon indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_addons_restaurant_id 
      ON addons(restaurant_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_addons_menu_item_id 
      ON addons(menu_item_id);
    `);

    // 2. Add is_addon_item column to order_items to track if this is an addon
    console.log('📝 Adding is_addon_item column to order_items...');
    await client.query(`
      ALTER TABLE order_items 
      ADD COLUMN IF NOT EXISTS is_addon BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS parent_order_item_id INTEGER REFERENCES order_items(id) ON DELETE CASCADE;
    `);

    // 3. Add print_category column to order_items for kitchen printing
    console.log('📝 Adding print_category to order_items...');
    await client.query(`
      ALTER TABLE order_items 
      ADD COLUMN IF NOT EXISTS print_category_id INTEGER REFERENCES menu_categories(id) ON DELETE SET NULL;
    `);

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
