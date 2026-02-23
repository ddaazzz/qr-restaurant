import pool from '../src/config/db';

async function resetData() {
  try {
    console.log('🗑️  Starting database reset...');
    
    // Delete all orders
    console.log('Deleting all order items...');
    await pool.query('DELETE FROM order_items');
    console.log(`✅ Deleted order items`);
    
    // Delete all sessions
    console.log('Deleting all sessions...');
    await pool.query('DELETE FROM table_sessions');
    console.log(`✅ Deleted sessions`);
    
    // Delete all bill closures
    console.log('Deleting all bill closures...');
    await pool.query('DELETE FROM bill_closures');
    console.log(`✅ Deleted bill closures`);
    
    console.log('✅ Database reset complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error resetting database:', err);
    process.exit(1);
  }
}

resetData();
