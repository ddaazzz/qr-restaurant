import dotenv from 'dotenv';
import pool from './src/config/db';

dotenv.config();

(async () => {
  try {
    const result = await pool.query(
      'SELECT id, session_id, restaurant_id, closed_at, payment_method FROM bill_closures WHERE session_id = $1 ORDER BY closed_at DESC LIMIT 1',
      [98]
    );
    if (result.rows.length > 0) {
      console.log('✅ Bill Closure Record Found:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('❌ No bill closure found for session 98');
    }
    process.exit(0);
  } catch(e) {
    console.log('Error: ' + (e instanceof Error ? e.message : String(e)));
    process.exit(1);
  }
})();
