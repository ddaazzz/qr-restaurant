import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://chuio_demo_user:lA7yJYtXe8gUFPg5j60Sc77nx9XeXnjP@dpg-d5neo34mrvns73fmt0sg-a.singapore-postgres.render.com:5432/chuio_demo'
});

async function createTestStaff() {
  try {
    const pin = '123456'; // Simple PIN for testing
    const hashedPin = await bcrypt.hash(pin, 10);
    const allAccessRights = JSON.stringify(['orders', 'tables', 'reports', 'staff', 'settings', 'bookings']);

    const result = await pool.query(
      `INSERT INTO users (name, role, pin, restaurant_id, access_rights) 
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, pin, access_rights`,
      ['Test Staff', 'staff', hashedPin, 1, allAccessRights]
    );

    console.log('✅ Test staff user created:');
    console.log('  ID:', result.rows[0].id);
    console.log('  Name:', result.rows[0].name);
    console.log('  PIN (plain text):', pin);
    console.log('  PIN (hashed):', result.rows[0].pin);
    console.log('  Access Rights:', result.rows[0].access_rights);
  } catch (err: any) {
    console.error('❌ Error creating test staff:', err.message);
  } finally {
    await pool.end();
  }
}

createTestStaff();
