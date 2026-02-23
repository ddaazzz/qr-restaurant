import pool from '../src/config/db';
import bcrypt from 'bcrypt';

async function setup() {
  const client = await pool.connect();
  try {
    console.log('🚀 Creating new restaurant and admin user...\n');

    // Hash password
    const hashedPassword = await bcrypt.hash('999999', 10);

    // 1. Insert restaurant
    const restRes = await client.query(
      `INSERT INTO restaurants (id, name, theme_color, logo_url) 
       VALUES (2, 'Test Restaurant', '#f97316', '')
       ON CONFLICT (id) DO UPDATE SET name = 'Test Restaurant'
       RETURNING id, name`
    );
    console.log('✅ Restaurant created:', restRes.rows[0]?.id, restRes.rows[0]?.name);

    // 2. Insert admin user for restaurant 2
    const adminRes = await client.query(
      `INSERT INTO users (restaurant_id, name, email, password_hash, role) 
       VALUES (2, 'Test Admin', 'test@test123.com', $1, 'admin')
       ON CONFLICT (email) DO UPDATE 
         SET password_hash = $1, role = 'admin', restaurant_id = 2
       RETURNING id, email, role, restaurant_id`,
      [hashedPassword]
    );
    console.log('✅ Admin user created:', adminRes.rows[0]);

    // 3. Insert superadmin (can switch restaurants)
    const superRes = await client.query(
      `INSERT INTO users (restaurant_id, name, email, password_hash, role) 
       VALUES (1, 'Superadmin', 'superadmin@test.com', $1, 'superadmin')
       ON CONFLICT (email) DO UPDATE 
         SET password_hash = $1, role = 'superadmin'
       RETURNING id, email, role, restaurant_id`,
      [hashedPassword]
    );
    console.log('✅ Superadmin user created:', superRes.rows[0]);

    // 4. Create menu categories for restaurant 2
    const cats = ['Appetizers', 'Mains', 'Desserts', 'Beverages'];
    for (const cat of cats) {
      try {
        await client.query(
          `INSERT INTO menu_categories (restaurant_id, name) 
           VALUES (2, $1)
           ON CONFLICT DO NOTHING`,
          [cat]
        );
      } catch (e) {
        // Silently skip if table doesn't exist
      }
    }
    console.log('✅ Menu categories created (if table exists)');

    // 5. Create table categories for restaurant 2
    const tableCats = ['Indoor', 'Outdoor', 'VIP'];
    for (const tcat of tableCats) {
      try {
        await client.query(
          `INSERT INTO table_categories (restaurant_id, category_name) 
           VALUES (2, $1)
           ON CONFLICT DO NOTHING`,
          [tcat]
        );
      } catch (e) {
        // Silently skip if table doesn't exist
      }
    }
    console.log('✅ Table categories created (if table exists)');

    console.log('\n✅ SETUP COMPLETE\n');
    console.log('====================================');
    console.log('Restaurant ID: 2');
    console.log('Admin Email: test@test123.com');
    console.log('Password: 999999');
    console.log('');
    console.log('Superadmin Email: superadmin@test.com');
    console.log('Superadmin Password: 999999');
    console.log('====================================\n');

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

setup();
