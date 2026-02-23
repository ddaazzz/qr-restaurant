import pool from '../src/config/db';
import bcrypt from 'bcrypt';

async function createNewRestaurant() {
  try {
    console.log('🚀 Creating new restaurant...');

    // 1. Create restaurant with ID 2
    const restaurantRes = await pool.query(
      `INSERT INTO restaurants (id, name, currency, logo_url) 
       VALUES (2, 'Test Restaurant', 'SGD', '')
       ON CONFLICT (id) DO UPDATE SET name = 'Test Restaurant'
       RETURNING id, name`,
      []
    );

    if (restaurantRes.rowCount === 0) {
      console.error('❌ Failed to create restaurant');
      process.exit(1);
    }

    console.log('✅ Restaurant created:', restaurantRes.rows[0]);

    // 2. Create admin user with email login
    const hashedPassword = await bcrypt.hash('999999', 10);

    const userRes = await pool.query(
      `INSERT INTO staff (restaurant_id, name, email, password_hash, role, kitchen_pin) 
       VALUES (2, 'Test Admin', 'test@test123.com', $1, 'admin', NULL)
       ON CONFLICT (email) DO UPDATE SET password_hash = $1, role = 'admin'
       RETURNING id, email, role, restaurant_id`,
      [hashedPassword]
    );

    if (userRes.rowCount === 0) {
      console.error('❌ Failed to create user');
      process.exit(1);
    }

    console.log('✅ Admin user created:', userRes.rows[0]);

    // 3. Create a superadmin account that can switch restaurants
    const superadminRes = await pool.query(
      `INSERT INTO staff (restaurant_id, name, email, password_hash, role, kitchen_pin) 
       VALUES (1, 'Superadmin', 'superadmin@test.com', $1, 'superadmin', NULL)
       ON CONFLICT (email) DO UPDATE SET password_hash = $1, role = 'superadmin'
       RETURNING id, email, role, restaurant_id`,
      [hashedPassword]
    );

    if (superadminRes.rowCount === 0) {
      console.error('❌ Failed to create superadmin');
      process.exit(1);
    }

    console.log('✅ Superadmin user created:', superadminRes.rows[0]);

    // 4. Create default categories for restaurant 2
    const categories = ['Appetizers', 'Mains', 'Desserts', 'Beverages'];
    for (let i = 0; i < categories.length; i++) {
      await pool.query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order) 
         VALUES (2, $1, $2)
         ON CONFLICT (restaurant_id, name) DO NOTHING`,
        [categories[i], i + 1]
      );
    }

    console.log('✅ Menu categories created for restaurant 2');

    // 5. Create default table categories
    const tableCategories = ['Indoor', 'Outdoor', 'VIP'];
    for (let i = 0; i < tableCategories.length; i++) {
      await pool.query(
        `INSERT INTO table_categories (restaurant_id, name, sort_order) 
         VALUES (2, $1, $2)
         ON CONFLICT (restaurant_id, name) DO NOTHING`,
        [tableCategories[i], i + 1]
      );
    }

    console.log('✅ Table categories created for restaurant 2');

    console.log('\n✅ SETUP COMPLETE');
    console.log('=====================================');
    console.log('Restaurant ID: 2');
    console.log('Admin Email: test@test123.com');
    console.log('Admin Password: 999999');
    console.log('Superadmin Email: superadmin@test.com');
    console.log('Superadmin Password: 999999');
    console.log('=====================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createNewRestaurant();
