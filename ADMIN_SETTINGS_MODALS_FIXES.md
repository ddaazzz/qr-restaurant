# Admin Settings Modals - Fixed & Fully Functional

## Summary of Changes

All "More" cards in the admin settings are now fully functional with proper database integration, translations support, and staff login link generation.

## Fixed Issues

### 1. **Staff Login Links Modal** ✅
- **Problem**: Links were not being generated with restaurantId
- **Solution**: Added `loadStaffLoginLinksModal()` function that generates:
  - Table Staff Link: `staff.html?rid={restaurantId}`
  - Kitchen Staff Link: `kitchen.html?rid={restaurantId}`
- **Features**:
  - Copy-to-clipboard button with visual feedback
  - Dynamic URL generation based on current restaurant
  - Both links properly scoped to specific restaurant

### 2. **Restaurant Information Modal** ✅
- **Data Loading**: Now properly fetches from database via `/api/{restaurantId}/settings`
- **Fields Populated**:
  - Restaurant Name
  - Phone Number
  - Address
  - Service Charge Percentage
  - Theme Color
  - Logo (with preview)
- **Edit Mode**:
  - Click "Edit Settings" button to modify
  - Save changes to database with PATCH request
  - Logo upload support via FormData
  - Theme color application in real-time

### 3. **POS Integration Modal** ✅
- **Data Loading**: Fetches POS configuration from database
- **Fields Populated**:
  - Webhook URL
  - API Key (masked as ••••••••••••••••)
  - POS System Type
  - Connection Status (color-coded)
- **Features**:
  - Edit mode for configuring webhooks
  - Test Connection button to verify POS connectivity
  - Visual status indicator (🟢 Configured / 🔴 Not Configured)

### 4. **Coupons Modal** ✅
- **Data Loading**: Fetches all coupons from `/api/restaurants/{restaurantId}/coupons`
- **Display Features**:
  - Shows all active coupons in grid format
  - Displays coupon code, discount type, and value
  - Delete button for each coupon
  - "No coupons" message when empty
- **Creation Features**:
  - Click "Edit" to enter creation mode
  - Form for creating new coupons:
    - Coupon Code (auto-uppercase)
    - Discount Type (Percentage or Fixed Amount)
    - Discount Value
    - Minimum Order Value
    - Maximum Uses (optional, leave blank for unlimited)
    - Valid Until date
    - Description
  - Create button saves to database
  - Real-time list refresh after creation

### 5. **QR Settings Modal** ✅
- **Data Loading**: Fetches QR mode from database
- **Fields**:
  - QR Mode dropdown with 3 options:
    - Regenerate QR Code Each Session (new QR per session)
    - Static QR Code Per Table (one session per table)
    - Static QR Code Per Seat (independent seats)
  - Warning message about active sessions
  - Descriptive help text for each mode
- **Database Integration**: Changes are saved via PATCH to `/api/{restaurantId}/settings`

### 6. **Booking Settings Modal** ✅
- **Data Loading**: Fetches `booking_time_allowance_mins` from database
- **Fields**:
  - Reservation Time Allowance input (in minutes)
  - Range: 5-120 minutes
  - Default: 15 minutes
- **Features**:
  - Descriptive text explaining the setting
  - Save button to persist changes
  - Changes saved to restaurant's `booking_time_allowance_mins` column

### 7. **Preferences Modal** ✅
- **Language Selection**: Chinese (中文) and English
- **Logout**: Clears localStorage and redirects to login.html

## Database Integration

### Tables Verified:
- ✅ `restaurants` - Stores all settings per restaurant
  - `name`, `phone`, `address` - Restaurant info
  - `theme_color` - UI theme
  - `logo_url` - Restaurant logo path
  - `service_charge_percent` - Service charge
  - `pos_webhook_url`, `pos_api_key` - POS integration
  - `qr_mode` - QR code generation mode
  - `booking_time_allowance_mins` - Reservation allowance

- ✅ `coupons` - Store restaurant-specific coupons
  - `restaurant_id` (FK) - Multi-restaurant support
  - `code`, `discount_type`, `discount_value` - Coupon details
  - `maximum_uses`, `valid_until` - Constraints
  - `description` - Customer-facing text

- ✅ `bookings` - Store reservations per restaurant
  - `restaurant_id` (FK) - Multi-restaurant support
  - `booking_date`, `booking_time` - Reservation details

## API Endpoints Used

### GET Endpoints:
- `GET /api/{restaurantId}/settings` - Fetch all restaurant settings
- `GET /api/restaurants/{restaurantId}/coupons` - Fetch all coupons

### PATCH Endpoints:
- `PATCH /api/{restaurantId}/settings` - Update restaurant settings
- `PATCH /api/{restaurantId}/settings` (with QR mode) - Update QR settings
- `PATCH /api/{restaurantId}/settings` (with booking mins) - Update booking settings

### POST Endpoints:
- `POST /api/restaurants/{restaurantId}/coupons` - Create new coupon
- `POST /api/{restaurantId}/logo` - Upload restaurant logo

### DELETE Endpoints:
- `DELETE /api/coupons/{couponId}` - Delete coupon

## Translation Keys Added

### English Translations:
```javascript
'admin.booking-settings': 'Booking Settings',
'admin.reservation-time-allowance': 'Reservation Time Allowance',
'admin.booking-time-desc': 'How long a reservation is held past the booked time before it expires (in minutes)',
'admin.default-15-mins': 'Default: 15 minutes',
```

### Chinese Translations (中文):
```javascript
'admin.booking-settings': '預訂設置',
'admin.reservation-time-allowance': '預訂時間寬限',
'admin.booking-time-desc': '預訂超時後保留預訂多長時間（分鐘）',
'admin.default-15-mins': '默認值：15 分鐘',
'admin.qr-mode-warning': '只能在沒有活動期間時更改二維碼模式。請先關閉所有期間。',
```

## JavaScript Functions Added

### Modal Opening & Initialization:
```javascript
openSettingsModal(modalName)          // Opens modal + initializes data
closeSettingsModal(modalName)         // Closes modal
```

### Data Loading Functions:
```javascript
loadRestaurantInfoModal()      // Fetch & populate restaurant info
loadPOSIntegrationModal()      // Fetch & populate POS config
loadStaffLoginLinksModal()     // Generate staff login URLs
loadQRSettingsModal()          // Fetch & populate QR settings
loadCouponsModal()             // Fetch & list coupons
loadBookingSettingsModal()     // Fetch & populate booking settings
```

### Edit Mode Functions:
```javascript
enterEditMode()                // Switch restaurant info to edit mode
cancelEditMode()               // Revert restaurant info edits
enterEditModePOS()             // Switch POS to edit mode
cancelEditModePOS()            // Revert POS edits
```

### Save Functions:
```javascript
saveAdminSettings()            // Save restaurant info
savePOSSettings()              // Save POS configuration
saveBookingSettings()          // Save booking allowance
createCoupon()                 // Create new coupon
deleteCoupon(couponId)         // Delete existing coupon
changeQRMode()                 // Change QR generation mode
uploadRestaurantLogo(file)     // Upload and save logo
testPOSConnection()            // Test POS webhook
copyToClipboard(elementId)     // Copy URLs to clipboard
```

## Usage Flow

### 1. Admin Opens Settings Tab:
1. Click "Settings" in sidebar
2. admin-settings.html loads into view
3. Modal cards are displayed in grid

### 2. Admin Clicks on a Card:
1. `onclick="openSettingsModal('card-name')"`
2. Modal opens and calls appropriate `load{CardName}Modal()`
3. Data is fetched from database
4. Form fields are populated

### 3. Admin Edits and Saves:
1. Click "Edit" button
2. Form fields become editable
3. Make changes
4. Click "Save"
5. POST/PATCH request sent to API
6. Database updated
7. Success message shown
8. Modal reloads with new data

### 4. Multiple Restaurants Support:
- All data operations use `restaurantId` from localStorage
- Each restaurant's settings are completely isolated
- Staff login links include the correct `rid` parameter
- Coupons are filtered by restaurant_id

## Testing Checklist

- [x] Restaurant information loads from database
- [x] POS configuration loads and displays
- [x] Staff login links generate with correct restaurantId
- [x] QR settings load and save correctly
- [x] Coupons list loads and displays
- [x] New coupons can be created
- [x] Existing coupons can be deleted
- [x] Booking settings load and save
- [x] Theme color changes apply immediately
- [x] Logo upload works
- [x] All translations display correctly (EN + 中文)
- [x] Copy-to-clipboard works for staff links
- [x] POS connection test works
- [x] All modal close buttons work
- [x] Edit mode toggle works correctly

## Error Handling

All functions include try-catch blocks with:
- Console error logging
- User-friendly alert messages
- Graceful fallbacks if data is missing
- Proper error messages from backend

## Performance Optimizations

- Data is loaded on-demand when modal opens (not pre-loaded)
- Coupons list rendered efficiently with map()
- No redundant API calls
- Clipboard copy uses modern navigator.clipboard API
- Theme color change applies via CSS variable update

## Future Enhancements

1. Add coupon code validation (unique per restaurant)
2. Add POS system-specific integrations (Square, Toast, etc.)
3. Add email/SMS notifications for system errors
4. Add audit log for all changes
5. Add batch coupon creation from CSV
6. Add QR code preview in settings modal
7. Add POS webhook test log viewer

## Notes

- All modals are properly scoped to current restaurant via `restaurantId` localStorage key
- The staff login links do NOT require PIN - they direct to the respective pages which handle role-based login
- Coupons use composite unique constraint: (restaurant_id, code)
- Booking time allowance defaults to 15 minutes but is fully configurable
