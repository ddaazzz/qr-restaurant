const { Pool } = require('pg');
const pool = new Pool();

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
    await pool.end();
  } catch(e) {
    console.log('Error: ' + e.message);
  }
})();
