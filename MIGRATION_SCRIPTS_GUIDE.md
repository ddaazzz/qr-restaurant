# Upload Migration Scripts

Two automated scripts to handle file migration and cleanup:

## 1. Migration Script: `migrate-uploads.ts`

Moves files from old flat structure to new restaurant-specific structure and updates database records.

### Usage

```bash
# Migrate a specific restaurant (ID = 1)
npx ts-node scripts/migrate-uploads.ts 1

# Migrate all restaurants
npx ts-node scripts/migrate-uploads.ts
```

### What It Does

✅ **For Each Restaurant:**
1. Creates folder: `uploads/restaurants/{restaurantId}/`
2. Creates subfolder: `uploads/restaurants/{restaurantId}/menu/`
3. Copies logo file → `uploads/restaurants/{restaurantId}/logo.ext`
4. Copies background file → `uploads/restaurants/{restaurantId}/background.ext`
5. Copies menu images → `uploads/restaurants/{restaurantId}/menu/image.ext`
6. Updates database paths:
   - `restaurants.logo_url` 
   - `restaurants.background_url`
   - `menu_items.image_url`

### Migration Example

**Before:**
```
uploads/
├── restaurants/
│   ├── abc123hash.jpg (logo for restaurant 1)
│   ├── def456hash.jpg (background for restaurant 1)
│   └── ghi789hash.jpg (background for restaurant 2)
└── menu/
    ├── jkl012hash.jpg (menu item for restaurant 1)
    └── mno345hash.jpg (menu item for restaurant 2)
```

**After:**
```
uploads/restaurants/
├── 1/
│   ├── abc123hash.jpg (logo)
│   ├── def456hash.jpg (background)
│   └── menu/
│       └── jkl012hash.jpg
└── 2/
    ├── ghi789hash.jpg (background)
    └── menu/
        └── mno345hash.jpg
```

**Database Changes:**
- `logo_url: /uploads/restaurants/abc123hash.jpg` → `/uploads/restaurants/1/abc123hash.jpg`
- `background_url: /uploads/restaurants/def456hash.jpg` → `/uploads/restaurants/1/def456hash.jpg`
- `image_url: /uploads/menu/jkl012hash.jpg` → `/uploads/restaurants/1/menu/jkl012hash.jpg`

### Output Example

```
🚀 Starting upload migration...

📋 Found 1 restaurant(s) to migrate: 1

📂 Migrating files for restaurant 1...
✅ Logo migrated: abc123hash.jpg
✅ Background migrated: def456hash.jpg

🍽️  Migrating menu item images for restaurant 1...
✅ Menu item image migrated: jkl012hash.jpg
✅ Menu item image migrated: mno345hash.jpg

==================================================
📊 MIGRATION SUMMARY
==================================================
✅ Logos migrated: 1
✅ Backgrounds migrated: 1
✅ Menu items migrated: 2
✅ Database records updated: 4

🎉 Migration completed successfully with no errors!
==================================================
```

---

## 2. Cleanup Script: `cleanup-old-uploads.ts`

Safely removes old files after verifying they've been migrated and are no longer in use.

### Usage

```bash
# Dry run (preview what will be deleted, no actual deletion)
npx ts-node scripts/cleanup-old-uploads.ts --dry-run

# Actually delete old files
npx ts-node scripts/cleanup-old-uploads.ts
```

### What It Does

✅ **Safety Checks:**
1. Verifies each file has been migrated (checks database)
2. Only deletes files that are no longer referenced
3. Preserves any files not yet migrated
4. Optionally runs in dry-run mode first

✅ **Removes:**
- Old files from `uploads/restaurants/` (non-directory)
- Old files from `uploads/menu/` (non-directory)

✅ **Preserves:**
- New `uploads/restaurants/{id}/` directories (stays)
- Files not yet migrated
- Directory structure

### Output Example

```
🔍 DRY RUN MODE - No files will be deleted

🗑️  Cleaning old restaurant files...
📋 [DRY RUN] Would delete: abc123hash.jpg
📋 [DRY RUN] Would delete: def456hash.jpg

🗑️  Cleaning old menu files...
📋 [DRY RUN] Would delete: jkl012hash.jpg
📋 [DRY RUN] Would delete: mno345hash.jpg

==================================================
📊 CLEANUP SUMMARY
==================================================
📋 [DRY RUN] Files that would be removed: 4
⏭️  Files preserved: 0

✅ Dry run completed successfully!
Run without --dry-run flag to actually delete files.
==================================================
```

---

## Complete Migration Workflow

### Step 1: Run Migration
```bash
cd backend
npx ts-node scripts/migrate-uploads.ts 1
```

Check output for success ✅

### Step 2: Verify in Database
```bash
# Check that paths were updated
SELECT id, logo_url, background_url FROM restaurants WHERE id = 1;
SELECT id, image_url FROM menu_items WHERE restaurant_id = 1 AND image_url IS NOT NULL;
```

Should show paths like `/uploads/restaurants/1/...`

### Step 3: Test in UI
- Go to admin dashboard
- Check Settings → logos display correctly
- Check Admin Menu → images display correctly
- Check Kitchen Dashboard → images display correctly

### Step 4: Dry Run Cleanup
```bash
npx ts-node scripts/cleanup-old-uploads.ts --dry-run
```

Review what will be deleted

### Step 5: Execute Cleanup
```bash
npx ts-node scripts/cleanup-old-uploads.ts
```

Old files removed ✅

---

## Troubleshooting

### Issue: Script won't run

**Error:** `Cannot find module`
- Ensure you're in `/backend` directory
- Run: `npm install` first

### Issue: Database connection fails

**Error:** `connect ECONNREFUSED`
- Ensure PostgreSQL is running
- Check `DATABASE_URL` environment variable
- Verify `.env` file exists

### Issue: File not found during migration

**Info:** `Menu item image file not found`
- This is normal if files were already deleted
- Script will skip and continue
- Check cleanup output for details

### Issue: Permission denied on delete

**Error:** `EACCES: permission denied`
- Run with admin/sudo privileges: `sudo npx ts-node scripts/cleanup-old-uploads.ts`
- Or check folder permissions: `chmod 755 backend/uploads`

---

## Safety Features

✅ **Dry Run Mode**
- Preview all deletions before executing
- No files are actually deleted with `--dry-run`

✅ **Database Verification**
- Only deletes files that are confirmed migrated
- Checks all DB records before deletion

✅ **Error Logging**
- All errors are collected and reported
- Script continues even if individual files fail
- Final summary shows all errors

✅ **File Copying (Not Moving)**
- Migration **copies** files, doesn't move them
- Original files preserved until cleanup confirms
- If migration fails, originals still exist

---

## For Multiple Restaurants

To migrate all restaurants at once:

```bash
# Migrate all restaurants
npx ts-node scripts/migrate-uploads.ts

# This runs migration for restaurants 1, 2, 3, etc.
```

Each restaurant gets its own folder:
- `uploads/restaurants/1/`
- `uploads/restaurants/2/`
- `uploads/restaurants/3/`
- etc.

---

## Script Flow Diagram

```
migrate-uploads.ts
├── Get restaurant IDs from DB
├── For each restaurant:
│   ├── Get logo_url and background_url from DB
│   ├── Copy logo to uploads/restaurants/{id}/
│   ├── Update logo_url in DB
│   ├── Copy background to uploads/restaurants/{id}/
│   ├── Update background_url in DB
│   ├── Get all menu_items with images for restaurant
│   ├── For each menu item:
│   │   ├── Copy image to uploads/restaurants/{id}/menu/
│   │   └── Update image_url in DB
│   └── Print results
└── Return summary with stats

cleanup-old-uploads.ts
├── [Optional] Dry run mode
├── Scan uploads/restaurants/ for old files
├── For each file:
│   ├── Check if file is referenced in restaurants table
│   ├── If migrated: delete or mark for deletion
│   └── If not migrated: preserve
├── Scan uploads/menu/ for old files
├── For each file:
│   ├── Check if file is referenced in menu_items table
│   ├── If migrated: delete or mark for deletion
│   └── If not migrated: preserve
└── Return summary with stats
```
