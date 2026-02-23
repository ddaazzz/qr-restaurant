import pool from '../src/config/db';
import bcrypt from 'bcrypt';

async function setupSuperadmin() {
  const client = await pool.connect();
  try {
    console.log('🔧 Configuring superadmin access...\n');

    // 1. Delete superadmin@test.com
    const deleteRes = await client.query(
      `DELETE FROM users WHERE email = 'superadmin@test.com' RETURNING id, email`,
    );
    if (deleteRes.rowCount && deleteRes.rowCount > 0) {
      console.log('✅ Removed superadmin@test.com');
    }

    // 2. Check if superadmin@chuio.io exists
    const checkRes = await client.query(
      `SELECT id, email, role FROM users WHERE email = 'superadmin@chuio.io'`
    );

    if (checkRes.rowCount && checkRes.rowCount > 0) {
      // Update existing superadmin to restaurant 1 (primary)
      const updateRes = await client.query(
        `UPDATE users 
         SET role = 'superadmin', restaurant_id = 1
         WHERE email = 'superadmin@chuio.io'
         RETURNING id, email, role, restaurant_id`,
      );
      console.log('✅ Updated superadmin@chuio.io:', updateRes.rows[0]);
    } else {
      // Create new superadmin
      const hashedPassword = await bcrypt.hash('999999', 10);
      const createRes = await client.query(
        `INSERT INTO users (restaurant_id, name, email, password_hash, role) 
         VALUES (1, 'Superadmin', 'superadmin@chuio.io', $1, 'superadmin')
         RETURNING id, email, role, restaurant_id`,
        [hashedPassword]
      );
      console.log('✅ Created superadmin@chuio.io:', createRes.rows[0]);
    }

    console.log('\n✅ SUPERADMIN SETUP COMPLETE\n');
    console.log('====================================');
    console.log('Superadmin Email: superadmin@chuio.io');
    console.log('Password: 999999');
    console.log('Access: Restaurant 1 & Restaurant 2');
    console.log('====================================\n');

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

setupSuperadmin();
