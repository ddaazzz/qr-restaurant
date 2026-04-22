"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("../config/db"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Parse SQL statements respecting quoted strings, dollar-quoted strings, and comments
function parseSQLStatements(sql) {
    const statements = [];
    let current = '';
    let inDollarQuote = false;
    let dollarQuoteTag = '';
    let inSingleQuote = false;
    let inLineComment = false;
    let inBlockComment = false;
    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        const nextChar = sql[i + 1];
        // Handle line comments
        if (!inDollarQuote && !inSingleQuote && !inBlockComment && char === '-' && nextChar === '-') {
            inLineComment = true;
            current += char;
            continue;
        }
        if (inLineComment && char === '\n') {
            inLineComment = false;
            current += char;
            continue;
        }
        if (inLineComment) {
            current += char;
            continue;
        }
        // Handle block comments
        if (!inDollarQuote && !inSingleQuote && !inLineComment && char === '/' && nextChar === '*') {
            inBlockComment = true;
            current += char;
            continue;
        }
        if (inBlockComment && char === '*' && nextChar === '/') {
            current += char + nextChar;
            i++;
            inBlockComment = false;
            continue;
        }
        if (inBlockComment) {
            current += char;
            continue;
        }
        // Handle single-quoted strings ('' is an escaped quote inside)
        if (!inDollarQuote && !inLineComment && !inBlockComment && char === "'") {
            if (inSingleQuote) {
                if (nextChar === "'") {
                    // Escaped single quote ('')
                    current += char + nextChar;
                    i++;
                    continue;
                }
                inSingleQuote = false;
            }
            else {
                inSingleQuote = true;
            }
            current += char;
            continue;
        }
        if (inSingleQuote) {
            current += char;
            continue;
        }
        // Handle dollar quotes
        if (!inLineComment && !inBlockComment && char === '$') {
            if (!inDollarQuote) {
                // Starting dollar quote - find the tag
                let j = i + 1;
                let tag = '';
                while (j < sql.length && sql[j] !== '$') {
                    tag += sql[j];
                    j++;
                }
                if (j < sql.length) {
                    inDollarQuote = true;
                    dollarQuoteTag = tag;
                    current += sql.substring(i, j + 1);
                    i = j;
                    continue;
                }
            }
            else {
                // Check if this ends the dollar quote
                let j = i + 1;
                let tag = '';
                while (j < sql.length && sql[j] !== '$') {
                    tag += sql[j];
                    j++;
                }
                if (tag === dollarQuoteTag && j < sql.length) {
                    inDollarQuote = false;
                    current += sql.substring(i, j + 1);
                    i = j;
                    continue;
                }
            }
        }
        // Handle statement terminators
        if (!inDollarQuote && !inSingleQuote && !inLineComment && !inBlockComment && char === ';') {
            current += char;
            if (current.trim()) {
                statements.push(current.trim());
            }
            current = '';
            continue;
        }
        current += char;
    }
    // Add any remaining statement
    if (current.trim() && !inDollarQuote) {
        statements.push(current.trim());
    }
    return statements;
}
async function runMigration() {
    try {
        const migrationsDir = path_1.default.join(__dirname, '../../migrations');
        const files = fs_1.default.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
        console.log(`📋 Found ${files.length} migration files\n`);
        let completedCount = 0;
        let skippedCount = 0;
        for (const file of files) {
            console.log(`🔄 Running migration: ${file}`);
            const migrationPath = path_1.default.join(migrationsDir, file);
            const sql = fs_1.default.readFileSync(migrationPath, 'utf-8');
            // Use proper SQL statement parser
            const statements = parseSQLStatements(sql);
            for (const statement of statements) {
                if (statement.trim()) {
                    try {
                        // Show preview of statement
                        const preview = statement.trim().substring(0, 80).replace(/\n/g, ' ');
                        console.log(`  ▪ ${preview}${preview.length >= 80 ? '...' : ''}`);
                        await db_1.default.query(statement);
                    }
                    catch (error) {
                        // Ignore "already exists" type errors - these migrations are idempotent
                        if (error.message && (error.message.includes('already exists') || error.code === '42P07' || error.code === '42701')) {
                            console.log(`    ⚠️  Already exists (skipping)`);
                            skippedCount++;
                        }
                        else {
                            throw error;
                        }
                    }
                }
            }
            console.log(`  ✅ ${file} completed\n`);
            completedCount++;
        }
        console.log(`\n✅ All migrations completed!`);
        console.log(`   ${completedCount} files processed`);
        console.log(`   ${skippedCount} statements skipped (already exist)`);
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}
runMigration();
//# sourceMappingURL=runMigration.js.map