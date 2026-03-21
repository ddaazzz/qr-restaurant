import pool from '../config/db';
import fs from 'fs';
import path from 'path';

// Parse SQL statements respecting dollar-quoted strings and comments
function parseSQLStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let dollarQuoteTag = '';
  let inLineComment = false;
  let inBlockComment = false;
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];
    const prevChar = sql[i - 1];
    
    // Handle line comments
    if (!inDollarQuote && !inBlockComment && char === '-' && nextChar === '-') {
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
    if (!inDollarQuote && !inLineComment && char === '/' && nextChar === '*') {
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
      } else {
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
    if (!inDollarQuote && !inLineComment && !inBlockComment && char === ';') {
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
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    
    console.log(`📋 Found ${files.length} migration files\n`);
    
    let completedCount = 0;
    let skippedCount = 0;
    
    for (const file of files) {
      console.log(`🔄 Running migration: ${file}`);
      
      const migrationPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      
      // Use proper SQL statement parser
      const statements = parseSQLStatements(sql);
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            // Show preview of statement
            const preview = statement.trim().substring(0, 80).replace(/\n/g, ' ');
            console.log(`  ▪ ${preview}${preview.length >= 80 ? '...' : ''}`);
            await pool.query(statement);
          } catch (error: any) {
            // Ignore "already exists" type errors - these migrations are idempotent
            if (error.message && (error.message.includes('already exists') || error.code === '42P07' || error.code === '42701')) {
              console.log(`    ⚠️  Already exists (skipping)`);
              skippedCount++;
            } else {
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
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
