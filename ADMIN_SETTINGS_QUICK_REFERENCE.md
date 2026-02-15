# Quick Reference: Admin Settings Modals Implementation

## Files Modified

### 1. `frontend/admin-settings.js` (Added ~350 lines of functions)
**Key Additions:**
- `openSettingsModal(modalName)` - Enhanced to initialize data on modal open
- `closeSettingsModal(modalName)` - Closes any modal
- 6 Modal loader functions: `load*Modal()`
- 6 Edit/Save function pairs
- Utility functions: `copyToClipboard()`, `testPOSConnection()`

### 2. `frontend/admin-settings.html` (No changes needed)
- Already had all the modal HTML structure
- Modals contain proper form fields and buttons
- All onclick handlers properly reference new functions

### 3. `frontend/translations.js` (Added 8 translation keys)
**English:**
```javascript
'admin.booking-settings'
'admin.reservation-time-allowance'
'admin.booking-time-desc'
'admin.default-15-mins'
```

**Chinese (中文):**
```javascript
'admin.booking-settings': '預訂設置'
'admin.reservation-time-allowance': '預訂時間寬限'
'admin.booking-time-desc': '預訂超時後保留預訂多長時間（分鐘）'
'admin.default-15-mins': '默認值：15 分鐘'
'admin.qr-mode-warning': '只能在沒有活動期間時更改二維碼模式。請先關閉所有期間。'
```

## How It Works

### Flow: User Clicks Settings Card
```
User clicks card
  ↓
onclick="openSettingsModal('card-type')" fires
  ↓
openSettingsModal(modalName) {
  - Shows modal (removes 'hidden' class)
  - Calls loadXxxModal() based on modalName
  - Data fetches from API
  - Form fields populated
}
  ↓
Modal is now displayed with live data
```

### Flow: User Edits & Saves
```
User clicks "Edit" button
  ↓
enterEditMode() or similar function
  ↓
View-only spans hidden, input fields shown
  ↓
User modifies values
  ↓
User clicks "Save"
  ↓
saveXxxSettings() function
  ↓
PATCH request to /api/{restaurantId}/settings
  ↓
Database updated
  ↓
Success alert shown
  ↓
Modal reloads with new data
```

## Staff Login Links Feature

### URL Generation
```javascript
staffLink = `${window.location.origin}/staff.html?rid=${restaurantId}`
kitchenLink = `${window.location.origin}/kitchen.html?rid=${restaurantId}`
```

### How Staff Uses Links
1. Admin copies link and shares with staff
2. Staff clicks link → goes to `staff.html?rid=123` (or `kitchen.html?rid=123`)
3. Page loads with restaurantId from URL param
4. Staff enters PIN to login
5. Staff sees only their assigned restaurant's data

## Database Connections

### Settings PATCH Endpoint
```javascript
PATCH /api/{restaurantId}/settings
Body: {
  name, phone, address, theme_color, 
  service_charge_percent, pos_webhook_url, 
  pos_api_key, qr_mode, booking_time_allowance_mins
}
```

### Coupons GET Endpoint
```javascript
GET /api/restaurants/{restaurantId}/coupons
Returns: Array of coupons with restaurant_id filter
```

### Coupons POST Endpoint
```javascript
POST /api/restaurants/{restaurantId}/coupons
Body: {
  code, discount_type, discount_value, 
  minimum_order_value, max_uses, valid_until, 
  description
}
```

## Key Features

✅ **Multi-Restaurant Scoping**
- All data filtered by restaurantId
- Staff links include rid parameter
- Database constraints enforce isolation

✅ **Bilingual Support**
- All UI elements support Chinese + English
- Translations dynamically applied
- Language stored in localStorage

✅ **Form Validation**
- Required fields checked before save
- API validation on backend
- User-friendly error messages

✅ **Real-time Updates**
- Theme color changes immediately
- Logo preview on upload
- Status indicators for POS

✅ **Data Persistence**
- All changes saved to PostgreSQL
- Booking settings per restaurant
- Coupons with restaurant_id FK

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Modal not opening | Check if `restaurantId` in localStorage |
| Data not loading | Check API endpoint responds on `/api/{rid}/settings` |
| Staff links incorrect | Verify `window.location.origin` is correct |
| Coupons not showing | Check database has coupons with matching `restaurant_id` |
| Translations blank | Check `localStorage.language` is set to 'en' or 'zh' |
| Theme not applying | Verify `theme_color` column exists in restaurants table |

## Modal Structure (HTML)

Each modal follows this pattern:
```html
<div id="modal-{modalName}" class="settings-modal hidden">
  <div class="modal-backdrop" onclick="closeSettingsModal('{modalName}')"></div>
  <div class="modal-content">
    <div class="modal-header">
      <h3 data-i18n="admin.{modalName}">Title</h3>
      <button class="modal-close" onclick="closeSettingsModal('{modalName}')">✕</button>
    </div>
    <div class="modal-body">
      <!-- Form content here -->
    </div>
  </div>
</div>
```

## Init on Page Load

When settings tab loads (`admin.js` line 185):
```javascript
await loadAdminSettings();  // Loads data for card-based system
await loadCoupons();        // Pre-loads coupons for display
```

Both functions check if elements exist before operating to avoid errors.
