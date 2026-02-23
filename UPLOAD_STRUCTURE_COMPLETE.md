# Upload Structure Reorganization - Complete

## Summary

Restaurant file uploads have been reorganized from a flat structure to a hierarchical, restaurant-specific folder structure.

### Previous Structure (Flat)
```
uploads/
├── restaurants/
│   ├── random1hash.jpg (all logos)
│   └── random2hash.jpg (all backgrounds)
└── menu/
    ├── random3hash.jpg (all menu items)
    └── random4hash.jpg
```

### New Structure (Hierarchical by Restaurant)
```
uploads/
└── restaurants/
    ├── {restaurantId}/
    │   ├── random1hash.jpg (restaurant logo)
    │   ├── random2hash.jpg (restaurant background)
    │   └── menu/
    │       ├── random3hash.jpg (restaurant's menu items)
    │       └── random4hash.jpg
    └── {anotherRestaurantId}/
        ├── random5hash.jpg
        ├── random6hash.jpg
        └── menu/
            ├── random7hash.jpg
            └── random8hash.jpg
```

## Changes Made

### 1. Backend Configuration - `backend/src/config/upload.ts`

**Key Changes:**
- Extract `restaurantId` from route params: `req.params.restaurantId || req.params.id`
- Generate dynamic folder paths based on route type:
  - **Menu items**: `uploads/restaurants/{restaurantId}/menu`
  - **Logo/Background**: `uploads/restaurants/{restaurantId}`
- Create folder structure recursively: `fs.mkdirSync(folder, { recursive: true })`

**Benefits:**
- Files automatically organized by restaurant
- Multi-tenant isolation at filesystem level
- Consistent folder creation across all upload types

### 2. Restaurant Background Upload - `backend/src/routes/restaurants.routes.ts`

**Changed:**
```typescript
// Before
const backgroundPath = `/uploads/restaurants/${req.file.filename}`;

// After
const backgroundPath = `/uploads/restaurants/${restaurantId}/${req.file.filename}`;
```

**Why:** Organize backgrounds in restaurant-specific folders

### 3. Restaurant Logo Upload - `backend/src/routes/staff.routes.ts`

**Changed:**
```typescript
// Before
const logoPath = `/uploads/restaurants/${req.file.filename}`;

// After
const logoPath = `/uploads/restaurants/${id}/${req.file.filename}`;
```

**Why:** Organize logos in restaurant-specific folders (`:id` param is restaurantId)

### 4. Menu Item Image Upload - `backend/src/routes/menu.routes.ts`

**Key Changes:**
- Accept `restaurantId` from request body: `const restaurantId = req.body.restaurantId;`
- Validate restaurantId is provided
- Generate path: `/uploads/restaurants/${restaurantId}/menu/${req.file.filename}`

**Why:** Menu items need restaurantId passed from frontend (not in route params)

### 5. Frontend Updates - `frontend/admin-menu.js`

**Three upload functions updated:**

1. **uploadMenuItemImage()** - General image upload
2. **Edit modal** - Image replacement during item edit
3. **Create modal** - Image upload during new item creation

**Change Pattern:**
```javascript
// Before
formData.append('image', file);

// After
formData.append('image', file);
formData.append('restaurantId', localStorage.getItem('restaurantId'));
```

**Why:** Pass restaurantId to menu upload endpoint for correct folder organization

## URL Path Changes

| Type | Old Path | New Path |
|------|----------|----------|
| Restaurant Logo | `/uploads/restaurants/abc123.jpg` | `/uploads/restaurants/{restaurantId}/abc123.jpg` |
| Restaurant Background | `/uploads/restaurants/def456.jpg` | `/uploads/restaurants/{restaurantId}/def456.jpg` |
| Menu Item Image | `/uploads/menu/ghi789.jpg` | `/uploads/restaurants/{restaurantId}/menu/ghi789.jpg` |

## Database Updates Required

After deployment, existing image_url/logo_url/background_url paths should be migrated:

```sql
-- This is informational only; run manually if needed
-- UPDATE restaurants SET logo_url = REPLACE(logo_url, '/uploads/restaurants/', '/uploads/restaurants/[restaurantId]/');
-- UPDATE restaurants SET background_url = REPLACE(background_url, '/uploads/restaurants/', '/uploads/restaurants/[restaurantId]/');
-- UPDATE menu_items SET image_url = REPLACE(image_url, '/uploads/menu/', '/uploads/restaurants/[restaurantId]/menu/');
```

## Testing Checklist

- [ ] Upload restaurant logo - saves to `uploads/restaurants/{restaurantId}/`
- [ ] Upload restaurant background - saves to `uploads/restaurants/{restaurantId}/`
- [ ] Create menu item with image - saves to `uploads/restaurants/{restaurantId}/menu/`
- [ ] Edit menu item image - saves to `uploads/restaurants/{restaurantId}/menu/`
- [ ] Different restaurants' files isolated in separate folders
- [ ] Admin dashboard displays logos and backgrounds correctly
- [ ] Kitchen dashboard displays menu items with images correctly
- [ ] Customer menu displays images correctly

## Benefits

1. **Multi-tenant Isolation**: Each restaurant's files are in separate folders
2. **Scalability**: Easy to manage thousands of restaurants without file conflicts
3. **Organization**: Clear filesystem hierarchy mirrors business structure
4. **Backup/Migration**: Easier to backup or transfer specific restaurant data
5. **Security**: Reduced risk of file conflicts between restaurants
6. **Performance**: Smaller directories for faster filesystem operations

## Future Enhancements

1. Add migration script for existing files
2. Add file cleanup on restaurant deletion
3. Add CDN path rewriting for production deployments
4. Consider S3 storage for cloud deployments
