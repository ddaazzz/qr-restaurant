# Addon System Implementation - Complete Guide

## Overview
The addon system allows restaurants to enhance menu items by offering optional add-ons (like drinks for meals, sides, etc.) at discounted prices. When customers select an item with addons, those addons become child order items that are routed to the correct kitchen zone based on their category.

## Database Schema

### New Table: `addons`
Stores addon configurations for menu items.

```sql
CREATE TABLE addons (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL,
  menu_item_id INTEGER NOT NULL,
  addon_item_id INTEGER NOT NULL,
  addon_name TEXT NOT NULL,
  addon_description TEXT,
  regular_price_cents INTEGER NOT NULL,
  addon_discount_price_cents INTEGER NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(restaurant_id, menu_item_id, addon_item_id)
);
```

### Modified Table: `order_items`
Added columns to support addon relationships and kitchen routing:

```sql
ALTER TABLE order_items ADD:
- is_addon BOOLEAN DEFAULT false
- parent_order_item_id INTEGER (FK to order_items)
- addon_id INTEGER (FK to addons)
- print_category_id INTEGER (FK to menu_categories)
```

## API Endpoints

### Addon Management

#### Get all addons for a restaurant
```
GET /api/restaurants/:restaurantId/addons
```
Returns all addons with full item details.

#### Get addons for a specific menu item
```
GET /api/restaurants/:restaurantId/menu-items/:menuItemId/addons
```
Returns only available addons for that item.

#### Create an addon
```
POST /api/restaurants/:restaurantId/addons
```
Body:
```json
{
  "menu_item_id": 5,
  "addon_item_id": 12,
  "addon_name": "Add Beverages",
  "addon_description": "Choose a drink to make this a combo",
  "regular_price_cents": 250,
  "addon_discount_price_cents": 150
}
```

#### Update an addon
```
PATCH /api/restaurants/:restaurantId/addons/:addonId
```
Body: Any of the above fields

#### Delete an addon
```
DELETE /api/restaurants/:restaurantId/addons/:addonId
```

## Frontend Implementation (Web)

### User Flow

1. **Customer adds item to cart**
   - Item is added to cart array with `addons: []`

2. **Addon selection modal appears**
   - Fetches available addons for the item
   - Displays each addon with:
     - Item image
     - Item name
     - Category
     - Discounted price
     - Discount percentage
   - Checkbox for each addon to select multiple

3. **Customer confirms selection**
   - Selected addons are stored in cart item
   - Total price is updated to include addon prices

4. **Order submission**
   - Order payload includes `addons` array with `addon_id` and `quantity`
   - Server creates child order items for each addon

### Files Modified
- `frontend/menu.js` - Added `showAddonModal()`, `closeAddonModal()`, `confirmAddons()`
- `frontend/translations.js` - Added addon-related translations
- Order submission now includes `addons` field

## Backend Implementation

### Order Processing

When an order is placed with addons:

1. **Main item is created** in `order_items`
   - `is_addon = false`
   - `parent_order_item_id = NULL`
   - Links to the base menu item

2. **Addon items are created** as child items
   - `is_addon = true`
   - `parent_order_item_id = [main item id]`
   - `addon_id = [addon record id]`
   - `print_category_id = [addon's item's category]`
   - Price = addon's discounted price

### Kitchen Printing & Routing

The system automatically separates printed items by kitchen zone:

1. **Multi-zone printing**: Items route to zones based on their category
   - Main item routes to its menu item's category zone
   - Addon items route to their own category's zone (via `print_category_id`)
   - Example: Chicken rice prints to "Kitchen Staff A", drink addon prints to "Kitchen Staff B"

2. **Single zone printing**: All items print to default zone

### Updated Code Sections

#### `backend/src/routes/orders.routes.ts`
- Order creation endpoint now handles addon items
- Prints addon items with `isAddon` flag in print payload
- Routes items to correct zones based on `print_category_id`

#### `backend/src/services/printerZones.ts`
- Added `getZoneByCategoryId()` method
- Supports routing items by category directly

## Order Response Format

### Get Orders for Session
```
GET /api/sessions/:sessionId/orders
```

Response includes addon structure:
```json
{
  "order_id": 1,
  "items": [
    {
      "order_item_id": 10,
      "menu_item_name": "Chicken Rice",
      "quantity": 1,
      "unit_price_cents": 800,
      "item_total_cents": 800,
      "addons": [
        {
          "order_item_id": 11,
          "menu_item_name": "Iced Tea",
          "quantity": 1,
          "unit_price_cents": 150,
          "item_total_cents": 150,
          "status": "pending"
        }
      ]
    }
  ],
  "total_cents": 950
}
```

## Mobile App Integration

### Service File
`mobile/src/services/addonService.ts` provides:
- `getAllAddons()` - Get all addons for restaurant
- `getAddonsForMenuItem()` - Get addons for specific item
- `createAddon()` - Create new addon
- `updateAddon()` - Modify addon
- `deleteAddon()` - Remove addon
- Helper utilities for formatting

### Integration Points
For admin staff managing menu items in the mobile app:
1. Import the addon service
2. Display addon list for selected menu item
3. Provide add/edit/delete UI for addons
4. Use the service methods for API calls

## Migration & Deployment

### 1. Apply Database Migration
```bash
# File: backend/migrations/031_add_addon_support.sql
# Run migration to create addons table and modify order_items
psql -d qr_restaurant -f backend/migrations/031_add_addon_support.sql
```

### 2. Register Routes
✅ Already added to `backend/src/app.ts`
```typescript
app.use("/api", addonsRoutes);
```

### 3. Verify Printer Service
✅ `getZoneByCategoryId()` method added to `PrinterZonesService`

## Configuration Examples

### Example: Meal Combo System
A restaurant wants to offer "meals" where customers can add drinks to food items at a discount.

**Setup:**
1. Create addon:
   - Menu Item: Chicken Rice (450¢)
   - Addon Item: Iced Tea (250¢)
   - Addon Name: "Add Beverage"
   - Regular Price: 250¢
   - Discounted Price: 150¢ (-40%)

2. Category Mapping (in printer zones):
   - Chicken Rice → Grill Zone (Kitchen Staff A)
   - Iced Tea → Beverages Zone (Kitchen Staff B)

3. Result:
   - Customer orders Chicken Rice: 450¢
   - Adds Iced Tea addon: +150¢
   - Total: 600¢
   - Printing: Chicken Rice → Grill Zone, Iced Tea → Beverages Zone

## Error Handling

### Invalid Addon Scenarios
The system validates:
- Both items must belong to the restaurant
- Addon item must be available
- Duplicate addon configurations prevented with UNIQUE constraint
- Addon must exist and be available when processing orders

### API Errors
- 404: Addon, menu item, or addon item not found
- 400: Missing required fields or invalid data
- 403: Item doesn't belong to user's restaurant

## Performance Considerations

1. **Indexed columns** for fast queries:
   - `idx_addons_restaurant_id`
   - `idx_addons_menu_item_id`
   - `idx_order_items_is_addon`
   - `idx_order_items_parent_item`

2. **Efficient printing**: Items grouped by zone before querying

3. **Storage**: Minimal overhead - only stores addon configuration, not per-order

## Future Enhancements

1. **Addon Categories**: Group addons by type (beverages, sides, etc.)
2. **Quantity Selection**: Allow customers to select addon quantity in modal
3. **Addon Limits**: Restrict number of addons per item
4. **Bulk Addon Pricing**: Define addons at category level
5. **Analytics**: Track most popular addons and revenue impact
6. **Mobile Ordering**: Customer-facing mobile app integration

## Troubleshooting

### Addons not showing in modal
- Verify addons are marked `is_available = true`
- Check restaurant_id matches
- Ensure menu_item_id is correct

### Items not routing to correct kitchen zone
- Verify `print_category_id` is populated in order_items
- Check category is linked to printer zone
- Confirm zone is configured with correct printer

### Addon prices not applied
- Verify `addon_discount_price_cents` is set correctly
- Check price calculation in order creation
- Review order response for correct pricing

## API Testing

### Create Test Data
```javascript
// Create addon for testing
const addon = {
  menu_item_id: 1,
  addon_item_id: 3,
  addon_name: "Add Drink",
  regular_price_cents: 250,
  addon_discount_price_cents: 150
};

const res = await fetch(`/api/restaurants/1/addons`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(addon)
});
```

### Place Order with Addon
```javascript
const order = {
  items: [{
    menu_item_id: 1,
    quantity: 1,
    selected_option_ids: [],
    addons: [
      { addon_id: 1, quantity: 1 }
    ]
  }]
};

const res = await fetch(`/api/sessions/123/orders`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(order)
});
```

---

## Summary Checklist

- ✅ Database migration created (031_add_addon_support.sql)
- ✅ Addon CRUD routes implemented (/api/restaurants/:restaurantId/addons)
- ✅ Order processing updated to handle addons
- ✅ Kitchen printing modified to separate items by category
- ✅ Web frontend addon selection UI implemented
- ✅ Addon selection modal with discounts
- ✅ Mobile app service layer created (addonService.ts)
- ✅ Translations added (EN & Traditional Chinese)
- ✅ Error handling and validation in place
- ✅ Printer zones integration complete

**Status: READY FOR USE**
