# Category Management - Complete CRUD Operations

## Overview
Users can now **add, edit, and delete** both table and food categories with a clean, intuitive UI in the admin portal.

## Features

### 1. **Tables Tab** (admin-tables.html)

#### Create Category
- Click the **"+ Add"** button in edit mode
- Enter category name (e.g., "Main Floor", "Patio", "Outdoor Seating")
- Category is created and appears in the tabs

#### Edit Category
- In **edit mode**, click the **✏️ (pencil)** button next to any category tab
- A prompt appears with the current category name
- Edit the name and click OK
- Changes are saved immediately

#### Delete Category
- In **edit mode**, click the **🗑️ (trash)** button next to any category tab
- Confirmation dialog appears
- **Note:** Deleting a category will NOT delete tables in it; tables will be orphaned but data is preserved
- Once confirmed, category is deleted

#### View Mode
- Switch to **view mode** to hide edit controls
- Category tabs remain clickable for navigation

---

### 2. **Menu Tab** (admin-menu.html)

#### Create Category
- Click the **"+ Add Category"** button in edit mode
- Enter category name (e.g., "Appetizers", "Main Courses", "Desserts")
- Category is created and appears in the tabs

#### Edit Category
- In **edit mode**, click the **✏️ (pencil)** button next to any category tab
- A prompt appears with the current category name
- Edit the name and click OK
- Changes are saved immediately

#### Delete Category
- In **edit mode**, click the **🗑️ (trash)** button next to any category tab
- Confirmation dialog appears
- **Note:** Deleting a category will NOT delete menu items in it; items will be orphaned but data is preserved
- Once confirmed, category is deleted

#### View Mode
- Switch to **view mode** to hide edit controls
- Category tabs remain clickable for navigation

---

## UI/UX Details

### Button Styling
| Button | Color | Icon | Purpose |
|--------|-------|------|---------|
| Category Tab | Blue/Gray | - | Select category |
| Edit (✏️) | Blue (#3b82f6) | ✏️ | Edit category name |
| Delete (🗑️) | Red (#ef4444) | 🗑️ | Delete category |
| + Add / + Add Category | Gray | + | Create new category |

### Edit Mode Toggle
- Click **"Edit"** button in admin portal to enter edit mode
- Edit controls (✏️, 🗑️) appear next to all category tabs
- Click **"Done"** to exit edit mode and hide controls

### Confirmation Dialogs
- All destructive actions (delete) require confirmation
- Warning text: `"Delete category \"[name]\"? Any [items/tables] in this category will be orphaned."`
- Click "Cancel" to abort, "OK" to confirm

---

## Backend API Endpoints

### Table Categories

**Create:**
```
POST /api/restaurants/{restaurantId}/table-categories
Body: { "name": "category name" }
```

**Edit:**
```
PATCH /api/restaurants/{restaurantId}/table-categories/{categoryId}
Body: { "name": "new name" }
```

**Delete:**
```
DELETE /api/restaurants/{restaurantId}/table-categories/{categoryId}
```

### Menu Categories

**Create:**
```
POST /api/restaurants/{restaurantId}/menu_categories
Body: { "name": "category name" }
```

**Edit:**
```
PATCH /api/menu_categories/{categoryId}
Body: { "name": "new name" }
```

**Delete:**
```
DELETE /api/menu_categories/{categoryId}
```

---

## Frontend Code Changes

### admin-tables.js
- **renderTableCategoryTabs()** - Enhanced to add edit/delete buttons wrapper around each category
- **editTableCategory()** - New function to handle category name updates via PATCH
- **deleteTableCategory()** - New function to handle category deletion via DELETE

### admin-menu.js
- **renderMenuCategoryTabs()** - Enhanced to add edit/delete buttons wrapper around each category
- **editMenuCategory()** - New function to handle category name updates via PATCH
- **deleteMenuCategory()** - New function to handle category deletion via DELETE

---

## Testing Instructions

### Test Table Category Management
1. Login to admin portal (test@test123.com / 999999 for restaurant 2)
2. Navigate to **Tables** tab
3. Click **"Edit"** button
4. Click **"+ Add"** to create a new table category
5. Click **✏️** button next to a category to edit its name
6. Click **🗑️** button next to a category to delete it (with confirmation)
7. Click **"Done"** to exit edit mode

### Test Menu Category Management
1. Login to admin portal
2. Navigate to **Menu** tab
3. Click **"Edit"** button
4. Click **"+ Add Category"** to create a new menu category
5. Click **✏️** button next to a category to edit its name
6. Click **🗑️** button next to a category to delete it (with confirmation)
7. Click **"Done"** to exit edit mode

---

## Error Handling

All operations include error handling:
- **Create fails:** Alert shows error message from backend
- **Edit fails:** Alert shows error message from backend
- **Delete fails:** Alert shows error message from backend (e.g., "Cannot delete category with menu items")

---

## Data Persistence

- All changes are immediately saved to the PostgreSQL database
- Upon successful operation, the category list is refreshed from the backend
- UI automatically updates to reflect changes
- No manual refresh needed

---

## Constraints

### Table Categories
- Cannot have duplicate category names within a restaurant
- Deleting a category orphans its tables (data preserved, but category link removed)

### Menu Categories
- Cannot have duplicate category names within a restaurant
- Cannot delete categories that contain menu items (prevents orphaning)

---

## File Modifications

### Lines Modified in admin-tables.js
- Lines 27-128: **renderTableCategoryTabs()** - Added wrapper containers with edit/delete buttons
- Lines 131-182: **editTableCategory()** - New function
- Lines 184-195: **deleteTableCategory()** - New function

### Lines Modified in admin-menu.js
- Lines 66-154: **renderMenuCategoryTabs()** - Added wrapper containers with edit/delete buttons
- Lines 157-185: **editMenuCategory()** - New function
- Lines 187-200: **deleteMenuCategory()** - New function

---

## Git Commit
Commit: `ff50636`
Message: "feat: Add edit and delete functionality for table and menu categories"

---

## Future Enhancements
- Inline editing with text input instead of prompts
- Drag-and-drop to reorder categories
- Bulk operations (multi-select delete)
- Category-level permissions/visibility settings
- Custom category colors/icons
