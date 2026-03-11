# 🚀 Quick Start - Run Migrations Now

## The Fastest Way to Get Started

### Step 1: Make sure PostgreSQL is running

**macOS:**
```bash
brew services start postgresql
```

**Windows (PowerShell as Admin):**
```powershell
Start-Service -Name postgresql-x64-17
# (adjust version number if needed)
```

**Linux:**
```bash
sudo systemctl start postgresql
```

### Step 2: Verify your .env file has DATABASE_URL

```bash
cat /Users/user/Documents/qr-restaurant-ai/.env | grep DATABASE_URL
```

Should show:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qrrestaurant
```

### Step 3: Run migrations

```bash
cd /Users/user/Documents/qr-restaurant-ai

# Make script executable
chmod +x run-migrations.sh

# Run it
./run-migrations.sh
```

Expected output:
```
✅ Migrations table initialized
📁 Found 1 migration files
✅ Already run: 0 migrations
⏳ Running 1 pending migrations...
⏳ Running migration: 031_add_addon_support.sql
✅ Migration completed: 031_add_addon_support.sql
✅ All migrations completed successfully!
```

### Step 4: Start services and test

**Terminal 1 - Backend:**
```bash
cd /Users/user/Documents/qr-restaurant-ai/backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd /Users/user/Documents/qr-restaurant-ai/frontend
npx live-server
```

**Terminal 3 - Test addon API:**
```bash
# Get a simple test
curl http://localhost:10000/api/restaurants/1/addons

# You should get a JSON response (empty array if no addons yet)
[]
```

### Step 5: Test in the web admin

1. Open http://localhost:8080/admin/menu
2. Edit any menu item
3. Scroll to bottom → "Available Add-ons" section
4. Click "+ Add Addon"
5. Select a menu item to add as addon
6. Set discount price (e.g., 250 for $2.50)
7. Click "Confirm"
8. Addon appears in the list!

## If Migration Fails

### Error: "Connection refused"

PostgreSQL isn't running:
```bash
# macOS - check status
brew services list
# Start it
brew services start postgresql
```

### Error: "database does not exist"

Create it first:
```bash
createdb -U postgres qrrestaurant
# or in psql:
createdb qrrestaurant;
```

### Error: "password authentication failed"

Update `DATABASE_URL` in `.env` with correct credentials:
```bash
# Find your PostgreSQL password and update:
# DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/qrrestaurant
```

### Manual Alternative

If script doesn't work:
```bash
cd /Users/user/Documents/qr-restaurant-ai/backend

# Install dependencies if needed
npm install

# Run migration directly
npx ts-node --transpile-only src/scripts/runMigrations.ts
```

## Verify It Worked

```bash
psql postgresql://postgres:postgres@localhost:5432/qrrestaurant -c "\\dt addons"
```

Should show the addons table with columns for:
- id, restaurant_id, menu_item_id, addon_item_id
- addon_name, regular_price_cents, addon_discount_price_cents
- is_available, created_at, updated_at

## What's Installed Now

✅ **Database:**
- addons table (stores addon configurations)
- Updated order_items with addon support fields

✅ **Backend API:**
- POST /api/restaurants/:id/addons (create addon)
- GET /api/restaurants/:id/addons (get addons)
- PATCH /api/restaurants/:id/addons/:id (update)
- DELETE /api/restaurants/:id/addons/:id (delete)

✅ **Web Admin Interface:**
- Edit menu item → scroll to "Available Add-ons"
- Add/edit/delete addons with prices
- Search for menu items to add as addons

✅ **Mobile Admin Interface:**
- Menu item detail → tap 🎁 button
- Opens edit modal with addon configuration
- Same functionality as web (add/edit/delete)

✅ **Customer Ordering:**
- Addon selection modal in menu
- Customers can add configured addons to orders
- Orders print to correct kitchen zone by category

## Troubleshooting Commands

```bash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT version();"

# List all databases
psql -U postgres -l

# Check migrations table
psql -U postgres -d qrrestaurant -c "SELECT * FROM migrations;"

# Check addons table structure
psql -U postgres -d qrrestaurant -c "\\d addons"

# Count addons (should be 0 initially)
psql -U postgres -d qrrestaurant -c "SELECT COUNT(*) FROM addons;"

# Check if order_items has addon columns
psql -U postgres -d qrrestaurant -c "\\d order_items"
```

## Next Steps

1. ✅ Run migrations (you're here!)
2. Start services
3. Test web admin
4. Test mobile admin
5. Test customer ordering
6. Deploy!

---

Need detailed help? See: [ADDON_INTEGRATION_SETUP_GUIDE.md](./ADDON_INTEGRATION_SETUP_GUIDE.md)

Questions? Check: [ADDON_QUICK_REFERENCE.md](./ADDON_QUICK_REFERENCE.md)
