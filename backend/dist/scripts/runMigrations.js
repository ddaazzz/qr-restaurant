"use strict";
/**
 * Database Migration Runner
 * Runs all pending migrations from backend/migrations directory
 *
 * Usage: npx ts-node src/scripts/runMigrations.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAllMigrations = runAllMigrations;
exports.getMigrations = getMigrations;
exports.getRunMigrations = getRunMigrations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_1 = __importDefault(require("../config/db"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/**
 * Read all migration files from migrations directory
 * Migrations should be numbered: 001_*, 002_*, etc. for proper ordering
 */
function getMigrations() {
    const migrationsDir = path_1.default.join(__dirname, '../../migrations');
    if (!fs_1.default.existsSync(migrationsDir)) {
        console.error(`❌ Migrations directory not found: ${migrationsDir}`);
        process.exit(1);
    }
    const files = fs_1.default.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Sorts numerically by default in JS for numbered files
    return files.map(file => ({
        name: file,
        path: path_1.default.join(migrationsDir, file),
        content: fs_1.default.readFileSync(path_1.default.join(migrationsDir, file), 'utf-8')
    }));
}
/**
 * Create migrations tracking table if it doesn't exist
 */
async function initializeMigrationsTable() {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    try {
        await db_1.default.query(createTableQuery);
        console.log('✅ Migrations table initialized');
    }
    catch (err) {
        console.error('❌ Error initializing migrations table:', err);
        throw err;
    }
}
/**
 * Get list of already-run migrations
 */
async function getRunMigrations() {
    try {
        const result = await db_1.default.query('SELECT name FROM migrations ORDER BY run_at');
        return result.rows.map(row => row.name);
    }
    catch (err) {
        console.error('❌ Error fetching run migrations:', err);
        return [];
    }
}
/**
 * Run a single migration
 */
async function runMigration(migration) {
    const client = await db_1.default.connect();
    try {
        // Start transaction
        await client.query('BEGIN');
        console.log(`⏳ Running migration: ${migration.name}`);
        // Split the migration into individual statements
        // Handle multiple statements separated by semicolons
        const statements = migration.content
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        // Execute each statement
        for (const statement of statements) {
            await client.query(statement);
        }
        // Record the migration as run
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
        // Commit transaction
        await client.query('COMMIT');
        console.log(`✅ Migration completed: ${migration.name}`);
        return true;
    }
    catch (err) {
        // Rollback on error
        await client.query('ROLLBACK');
        console.error(`❌ Error in migration ${migration.name}:`, err.message);
        return false;
    }
    finally {
        client.release();
    }
}
/**
 * Main migration runner
 * @param standalone - if true (CLI usage), calls process.exit and pool.end
 */
async function runAllMigrations(standalone = false) {
    try {
        console.log('🔄 Starting database migration...\n');
        if (standalone) {
            console.log(`📊 Database: ${process.env.DATABASE_URL}`);
            console.log('');
        }
        // Initialize migrations table
        await initializeMigrationsTable();
        // Get migrations
        const migrations = getMigrations();
        console.log(`📁 Found ${migrations.length} migration files\n`);
        if (migrations.length === 0) {
            console.log('ℹ️  No migrations to run');
            if (standalone)
                process.exit(0);
            return;
        }
        // Get already-run migrations
        const ranMigrations = await getRunMigrations();
        console.log(`✅ Already run: ${ranMigrations.length} migrations\n`);
        // Run pending migrations
        const pendingMigrations = migrations.filter(m => !ranMigrations.includes(m.name));
        if (pendingMigrations.length === 0) {
            console.log('✅ All migrations are up to date!');
            if (standalone)
                process.exit(0);
            return;
        }
        console.log(`⏳ Running ${pendingMigrations.length} pending migrations...\n`);
        let failureCount = 0;
        for (const migration of pendingMigrations) {
            const success = await runMigration(migration);
            if (!success) {
                failureCount++;
            }
        }
        console.log('');
        if (failureCount === 0) {
            console.log('✅ All migrations completed successfully!');
            if (standalone)
                process.exit(0);
        }
        else {
            console.log(`❌ ${failureCount} migration(s) failed`);
            console.log('   Please check the errors above and fix them manually if needed');
            if (standalone)
                process.exit(1);
            else
                throw new Error(`${failureCount} migration(s) failed`);
        }
    }
    catch (err) {
        console.error('❌ Fatal error:', err.message);
        if (standalone)
            process.exit(1);
        else
            throw err;
    }
    finally {
        if (standalone)
            await db_1.default.end();
    }
}
// Run migrations if this file is executed directly
if (require.main === module) {
    runAllMigrations(true);
}
//# sourceMappingURL=runMigrations.js.map