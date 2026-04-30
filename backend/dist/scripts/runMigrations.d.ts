/**
 * Database Migration Runner
 * Runs all pending migrations from backend/migrations directory
 *
 * Usage: npx ts-node src/scripts/runMigrations.ts
 */
interface Migration {
    name: string;
    path: string;
    content: string;
}
/**
 * Read all migration files from migrations directory
 * Migrations should be numbered: 001_*, 002_*, etc. for proper ordering
 */
declare function getMigrations(): Migration[];
/**
 * Get list of already-run migrations
 */
declare function getRunMigrations(): Promise<string[]>;
/**
 * Main migration runner
 * @param standalone - if true (CLI usage), calls process.exit and pool.end
 */
declare function runAllMigrations(standalone?: boolean): Promise<void>;
export { runAllMigrations, getMigrations, getRunMigrations };
//# sourceMappingURL=runMigrations.d.ts.map