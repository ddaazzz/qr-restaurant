#!/bin/bash
# SQL Migration Runner
# Applies all pending database migrations from the migrations directory

set -e

echo "🔄 Running Database Migrations..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL environment variable is not set"
  echo ""
  echo "Please set DATABASE_URL before running migrations:"
  echo "   export DATABASE_URL='postgresql://user:password@localhost:5432/qrrestaurant'"
  echo ""
  exit 1
fi

echo "📊 Database: $DATABASE_URL"
echo ""

# Navigate to backend directory
cd "$(dirname "$0")/backend"

# Check if PostgreSQL is running (optional verification)
if command -v psql &> /dev/null; then
  echo "✅ PostgreSQL client found"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Run the migration script
echo "⏳ Executing migrations..."
echo ""

npx ts-node --transpile-only src/scripts/runMigrations.ts

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ All migrations completed successfully!"
  echo ""
  echo "✅ Database is ready for the addon system"
else
  echo ""
  echo "❌ Migration failed. Please check the errors above."
  exit 1
fi
