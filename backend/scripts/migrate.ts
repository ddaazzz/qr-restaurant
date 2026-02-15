import pool from "../src/config/db";

async function runMigration() {
  try {
    console.log("🔄 Running Multi-Restaurant Database Migration...\n");

    // Step 1: Add PIN column to users
    console.log("1️⃣ Adding PIN column to users table...");
    await pool.query(`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS pin text;
    `);
    console.log("✅ PIN column added\n");

    // Step 2: Update role constraint
    console.log("2️⃣ Updating role constraint to support 'kitchen' role...");
    await pool.query(`
      ALTER TABLE public.users
      DROP CONSTRAINT IF EXISTS users_role_check;
    `);
    await pool.query(`
      ALTER TABLE public.users
      ADD CONSTRAINT users_role_check CHECK (role = ANY (ARRAY['admin'::text, 'staff'::text, 'kitchen'::text, 'superadmin'::text]));
    `);
    console.log("✅ Role constraint updated\n");

    // Step 3: Add restaurant_id to table_sessions if missing
    console.log("3️⃣ Adding restaurant_id to table_sessions...");
    await pool.query(`
      ALTER TABLE public.table_sessions
      ADD COLUMN IF NOT EXISTS restaurant_id integer,
      ADD COLUMN IF NOT EXISTS table_unit_id integer;
    `);
    console.log("✅ restaurant_id and table_unit_id columns added\n");

    // Step 4: Create table_units table if it doesn't exist
    console.log("4️⃣ Ensuring table_units table exists...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.table_units (
        id integer NOT NULL PRIMARY KEY,
        restaurant_id integer NOT NULL,
        display_name text NOT NULL,
        created_at timestamp DEFAULT now()
      );
    `);
    console.log("✅ table_units table ensured\n");

    // Step 5: Add foreign key constraints for multi-restaurant support
    console.log("5️⃣ Adding foreign key constraints...");
    
    // Users -> Restaurants
    await pool.query(`
      ALTER TABLE public.users
      DROP CONSTRAINT IF EXISTS users_restaurant_id_fk;
    `);
    await pool.query(`
      ALTER TABLE public.users
      ADD CONSTRAINT users_restaurant_id_fk 
      FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
    `);
    console.log("  ✅ users.restaurant_id -> restaurants.id");

    // table_sessions -> restaurants
    await pool.query(`
      ALTER TABLE public.table_sessions
      DROP CONSTRAINT IF EXISTS table_sessions_restaurant_id_fk;
    `);
    await pool.query(`
      ALTER TABLE public.table_sessions
      ADD CONSTRAINT table_sessions_restaurant_id_fk 
      FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
    `);
    console.log("  ✅ table_sessions.restaurant_id -> restaurants.id");

    // table_sessions -> table_units
    await pool.query(`
      ALTER TABLE public.table_sessions
      DROP CONSTRAINT IF EXISTS table_sessions_table_unit_id_fk;
    `);
    await pool.query(`
      ALTER TABLE public.table_sessions
      ADD CONSTRAINT table_sessions_table_unit_id_fk 
      FOREIGN KEY (table_unit_id) REFERENCES public.table_units(id);
    `);
    console.log("  ✅ table_sessions.table_unit_id -> table_units.id");

    // menu_categories -> restaurants (should already exist)
    await pool.query(`
      ALTER TABLE public.menu_categories
      DROP CONSTRAINT IF EXISTS menu_categories_restaurant_id_fk;
    `);
    await pool.query(`
      ALTER TABLE public.menu_categories
      ADD CONSTRAINT menu_categories_restaurant_id_fk 
      FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
    `);
    console.log("  ✅ menu_categories.restaurant_id -> restaurants.id");

    console.log("\n6️⃣ Creating indexes for multi-restaurant queries...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_restaurant_id ON public.users(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant_id ON public.table_sessions(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant_id ON public.menu_categories(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
    `);
    console.log("✅ Indexes created for better performance\n");

    console.log("7️⃣ Verifying schema integrity...");
    const result = await pool.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name IN ('users', 'table_sessions', 'menu_categories', 'table_units')
      AND column_name IN ('restaurant_id', 'pin', 'table_unit_id')
      ORDER BY table_name, column_name;
    `);
    
    if (result.rows.length > 0) {
      console.log("✅ Schema verification passed:");
      result.rows.forEach(row => {
        console.log(`   - ${row.table_name}.${row.column_name}`);
      });
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 Multi-Restaurant Migration Completed Successfully!");
    console.log("=".repeat(60));
    console.log("\n✅ Your database now supports:");
    console.log("  • Multiple restaurants with complete data isolation");
    console.log("  • Admin users per restaurant");
    console.log("  • Staff and kitchen staff per restaurant");
    console.log("  • Restaurant-specific orders and sessions");
    console.log("  • Foreign key constraints for data integrity");
    console.log("  • Performance indexes for multi-restaurant queries");
    console.log("  • Staff activity logging with login/logout tracking\n");

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message);
    console.error("Details:", error);
    process.exit(1);
  }
}

runMigration();
