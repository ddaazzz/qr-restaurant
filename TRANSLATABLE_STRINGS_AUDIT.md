# Translatable Strings Audit - All Admin & Staff HTML Files

## Overview
This document lists all user-visible hardcoded English text from admin and staff HTML files that needs i18n translation attributes and translations.js entries.

---

## FILE: admin-bookings.html

### Headers (h1, h2, h3)
- h1: "📅 Reservations"
- h2: "Bookings for [date]" (dynamic with span id="selected-date-display")
- h2: "New Booking" / "Edit Booking" (modal-title - dynamic)
- h2: "Confirm Action" (confirm modal header)

### Button Labels
- "+ New Booking" (btn-new-booking)
- "← Previous" (btn-prev-month)
- "Next →" (btn-next-month)
- "Today" (btn-today)
- "Cancel" (btn-cancel-form)
- "Delete" (btn-delete-booking - hidden by default)
- "Save Booking" (submit button)

### Form Labels
- "Guest Name *" (booking-guest-name label)
- "Phone" (booking-phone label)
- "Number of Guests *" (booking-pax label)
- "Table *" (booking-table label)
- "Date *" (booking-date label)
- "Time *" (booking-time label)
- "Status *" (booking-status label)
- "Notes" (booking-notes label)

### Form Placeholders & Options
- "Enter guest name" (booking-guest-name placeholder)
- "Enter phone number" (booking-phone placeholder)
- "Pax" (booking-pax placeholder)
- "Select a table" (booking-table default option)
- "Confirmed" (booking-status option)
- "Completed" (booking-status option)
- "Cancelled" (booking-status option)
- "No Show" (booking-status option)
- "Add any special notes or requirements" (booking-notes placeholder)

### Status/Messages
- "No bookings for this date" (empty-state)
- "Cancel" (confirm modal cancel button)
- "Delete" (confirm modal confirm button)

### Weekday Headers
- "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" (calendar weekdays)

---

## FILE: admin-coupons.html

### Headers (h2, h3)
- h2: "🎫 Coupons & Discounts"
- h3: "Create New Coupon"

### Form Labels
- "Coupon Code" (new-coupon-code label)
- "Discount Type" (new-coupon-type label)
- "Discount Value" (new-coupon-value label)
- "Minimum Order Value ($)" (new-coupon-min-order label)
- "Max Uses (leave blank for unlimited)" (new-coupon-max-uses label)
- "Valid Until" (new-coupon-valid-until label)
- "Description" (new-coupon-description label)

### Form Placeholders
- "e.g., SUMMER20" (new-coupon-code placeholder)
- "e.g., 20" (new-coupon-value placeholder)
- "e.g., 50" (new-coupon-min-order placeholder)
- "e.g., 100" (new-coupon-max-uses placeholder)
- "e.g., Summer special - 20% off all items" (new-coupon-description placeholder)

### Select Options
- "Percentage (%)" (new-coupon-type option)
- "Fixed Amount ($)" (new-coupon-type option)

### Button Labels
- "➕ Create Coupon" (onclick="createCoupon()")

---

## FILE: admin-orders.html

### Headers (h3, h4)
- h3: "Cart" (cart-header)
- h4: "Order History" (orders-history-left-view)
- h3: "Order Details" (order-details-title)

### Button Labels & Labels
- "<img> Edit" (cart-edit-btn)
- "Add to Table" (order-type-table label)
- "Order Now" (order-type-pay label)
- "To Go" (order-type-togo label)
- "Select Table:" (table-selection-ui label)
- "Submit Order" (order-submit-btn)

### Status Labels
- "Status: " (static text in order-status-display)
- "Total:" (cart-total label)

### Placeholders & Messages
- "Cart is empty" (empty state)
- "Loading..." (loading message in history-left)
- "Select an order to view details" (orders-details-view placeholder)
- "-- Select a table --" (order-table-select default option)

---

## FILE: admin-reports.html

### Headers (h3)
- h3: "Revenue Report"
- h3: "Busiest Tables"
- h3: "Hourly Revenue"
- h3: "Top Items"
- h3: "Daily Trends"

### Metric Labels (div.metric-label)
- "Total Orders"
- "Total Revenue"
- "Average Bill"
- "Active Sessions"

### Filter Labels (display: block; font-weight: 600)
- "Date Range"
- "Filter by Category"
- "Filter by Waiter"
- "Filter by Table"
- "Filter by Product"

### Select Options
- "Today" (revenue-filter-daterange option)
- "Last 7 Days" (revenue-filter-daterange option)
- "Last 30 Days" (revenue-filter-daterange option)
- "All Time" (revenue-filter-daterange option)
- "All Categories" (revenue-filter-category default option)
- "All Waiters" (revenue-filter-waiter default option)
- "All Tables" (revenue-filter-table default option)
- "All Products" (revenue-filter-product default option)

### Button Labels
- "Daily" (trends-daily-btn)
- "Weekly" (trends-weekly-btn)
- "Monthly" (trends-monthly-btn)

### Messages
- "Loading analytics dashboard..." (reports-loading)
- "Total: —" (modal-session-total fallback)

---

## FILE: admin-menu.html

### Headers (h3, h4)
- h3: "Add Menu Item" (create-item-form-panel header - HAS data-i18n)
- h3: "Variants" (food-item-panel-variants-section - HAS data-i18n)
- h4: "Add/Edit Variant" (food-panel-variant-form)

### Form Labels (HAS data-i18n attributes)
- "Item Name" (data-i18n="admin.item-name")
- "Price (cents)" (data-i18n="admin.price-cents")
- "Category" (data-i18n="admin.category")
- "Description" (data-i18n="admin.description")
- "Food Item Image" (data-i18n="admin.item-image")
- "(Recommended: 400px × 300px)" (data-i18n="admin.recommended-size")

### Button Labels (HAS data-i18n attributes)
- "✓ Create Item" (data-i18n="admin.create-item")
- "✕ Cancel" (data-i18n="admin.cancel-item")

### Form Placeholders
- "e.g., Caesar Salad" (new-item-name placeholder)
- "e.g., 1200" (new-item-price placeholder)
- "-- Select a category --" (data-i18n="admin.select-category")
- "Add a detailed description of the menu item..." (new-item-desc placeholder)

### Image Upload
- "📸 Click to upload image" (upload-placeholder text)
- "Change Image" (food-panel-change-image-btn)

### Variant Form Labels
- "Variant Name" (food-panel-variant-name label)
- "Min Select" (food-panel-variant-min label)
- "Max Select" (food-panel-variant-max label)
- "Required" (food-panel-variant-required label)
- "Options" (variant-options-section label)

### Variant Form Buttons
- "+ Add Option" (startAddVariantOption button)
- "Save" (saveVariantOption button)
- "Cancel" (cancelVariantOptionForm button)
- "Save Variant" (save variant submit button)
- "+ Add" (food-panel-add-variant-btn)

### Variant Option Form
- "Add Option" (h5 in variant-option-form)
- "Option Name" (food-panel-option-name label)
- "Price (cents) - optional" (food-panel-option-price label)
- "e.g., Small, Extra Cheese" (food-panel-option-name placeholder)

### Edit/Save Buttons
- "<img> Edit" (food-panel-edit-btn)
- "✓ Save" (food-panel-save-btn)
- "✕ Cancel" (food-panel-cancel-btn)

### Price Display
- "Price:" (data-i18n="admin.price")

---

## FILE: admin-settings.html

### Settings Cards (h3 headers)
- "Preferences" (data-i18n="admin.preferences")
- "Restaurant Information" (data-i18n="admin.restaurant-info")
- "🔌 POS Integration" (data-i18n="admin.pos-integration")
- "👥 Staff Login Links" (data-i18n="admin.staff-login-links")
- "QR Code Settings" (data-i18n="admin.qr-settings")
- "🎟️ Coupons"
- "📅 Booking Settings"

### Settings Card Descriptions (p tags)
- "Language" (data-i18n="admin.language")
- "Restaurant details" (restaurant-info-preview)
- "Not configured" (pos-status-preview)
- "Share with staff" (data-i18n="admin.share-with-staff")
- "Configure QR modes" (qr-mode-preview)
- "Manage coupons" (data-i18n="admin.manage-coupons")
- "Manage reservations" (booking-settings-preview)

### Preferences Modal
- "Preferences" (data-i18n="admin.preferences")
- "Language" (data-i18n="admin.language")
- "中文" (lang-zh-settings button)
- "English" (lang-en-settings button)
- "🚪 Logout" (data-i18n="admin.logout")

### Restaurant Information Modal
- "Restaurant Information" (data-i18n="admin.restaurant-info")
- "Restaurant Name" (data-i18n="admin.rest-name")
- "e.g., The Italian Kitchen" (restaurant-name placeholder)
- "Phone" (data-i18n="admin.rest-phone")
- "e.g., (555) 123-4567" (restaurant-phone placeholder)
- "Address" (data-i18n="admin.rest-address")
- "e.g., 123 Main St, City, State" (restaurant-address placeholder)
- "Timezone" (data-i18n="admin.rest-timezone")
- "Service Charge (%)" (data-i18n="admin.rest-service-charge")
- "e.g., 15" (serviceChargeInput placeholder)
- "Theme Color" (data-i18n="admin.rest-theme-color")
- "Restaurant Logo" (data-i18n="admin.rest-logo")
- "Menu Background Image"
- "📸 Upload Background" (upload-background-btn)
- "✎ Edit Settings" (data-i18n="admin.edit-settings")
- "✓ Save" (data-i18n="admin.save-settings")
- "Cancel" (data-i18n="admin.cancel-settings")

### Timezone Options
- "UTC (Coordinated Universal Time)"
- "Eastern Time (US & Canada)"
- "Central Time (US & Canada)"
- "Mountain Time (US & Canada)"
- "Pacific Time (US & Canada)"
- "London"
- "Paris"
- "Berlin"
- "Tokyo"
- "Shanghai"
- "Hong Kong"
- "Singapore"
- "Bangkok"
- "India Standard Time"
- "Sydney"
- "Melbourne"
- "Auckland"

### POS Integration Modal
- "🔌 POS Integration" (data-i18n="admin.pos-integration")
- "Webhook URL" (data-i18n="admin.pos-webhook-url")
- "https://your-pos.com/webhook" (pos-webhook-url placeholder)
- "API Key" (data-i18n="admin.pos-api-key")
- "Your POS API Key" (pos-api-key placeholder)
- "POS System Type" (data-i18n="admin.pos-system-type")
- "-- Select POS System --" (pos-system-type default)
- "REST API (Webhook)" (pos-system-type option)
- "Square POS" (pos-system-type option)
- "Toast POS" (pos-system-type option)
- "Lightspeed" (pos-system-type option)
- "Custom Integration" (pos-system-type option)
- "Connection Status" (data-i18n="admin.pos-connection-status")
- "🟢 Not Configured" (pos-connection-status display)
- "✎ Edit" (data-i18n="admin.edit")
- "✓ Save" (data-i18n="admin.save")
- "🧪 Test Connection" (data-i18n="admin.test")
- "Cancel" (data-i18n="admin.cancel")

### Staff Login Links Modal
- "👥 Staff Login Links" (data-i18n="admin.staff-login-links")
- "Share these links with your staff members to allow them to login without admin credentials:" (data-i18n="admin.staff-login-help")
- "Table Staff Login Link" (data-i18n="admin.table-staff-link")
- "📋 Copy" (data-i18n="admin.copy")
- "Kitchen Staff Login Link" (data-i18n="admin.kitchen-staff-link")

### QR Code Settings Modal
- "QR Code Settings" (data-i18n="admin.qr-settings")
- "⚠️ Note:" (warning text)
- "QR Code Mode can only be changed when there are no active sessions. Please close all sessions before making changes." (data-i18n="admin.qr-mode-warning")
- "QR Code Mode" (data-i18n="admin.qr-code-mode")
- "Regenerate QR Code Each Session" (data-i18n="admin.qr-regenerate-option")
- "Static QR Code Per Table (One Session Only)" (data-i18n="admin.qr-static-table-option")
- "Static QR Code Per Seat" (data-i18n="admin.qr-static-seat-option")
- "Regenerate QR Code Each Session:" (data-i18n="admin.qr-regenerate-desc")
- "New QR code generated each time session starts" (data-i18n="admin.qr-regenerate-desc-text")
- "Static QR Code Per Table:" (data-i18n="admin.qr-static-table-desc")
- "One session per table, cannot start new session" (data-i18n="admin.qr-static-table-desc-text")
- "Static QR Code Per Seat:" (data-i18n="admin.qr-static-seat-desc")
- "Each seat has independent QR code and session" (data-i18n="admin.qr-static-seat-desc-text")

### Coupons Modal (in settings)
- "🎟️ Coupons"
- "✎ Edit" (data-i18n="admin.edit")
- "No active coupons" (data-i18n="admin.no-coupons")
- "➕ Add a new coupon" (data-i18n="admin.add-new-coupon")
- "Coupon Code" (data-i18n="admin.coupon-code")
- "Discount Type" (data-i18n="admin.discount-type")
- "Percentage (%)" (data-i18n="admin.percentage")
- "Fixed Amount ($)" (data-i18n="admin.fixed-amount")
- "Discount Value" (data-i18n="admin.discount-value")
- "Minimum Order Value ($)" (data-i18n="admin.min-order-value")
- "Max Uses (leave blank for unlimited)" (data-i18n="admin.max-uses")
- "Valid Until" (data-i18n="admin.valid-until")
- "Description" (data-i18n="admin.coupon-description")
- "e.g., Summer special - 20% off all items" (placeholder)
- "➕ Create Coupon" (data-i18n="admin.create-coupon")
- "Cancel" (data-i18n="admin.cancel")

### Booking Settings Modal
- "📅 Booking Settings"
- "Reservation Time Allowance"
- "How long a reservation is held past the booked time before it expires (in minutes)"
- "minutes"
- "Default: 15 minutes"
- "💾 Save Settings"
- "Cancel"

---

## FILE: admin-staff.html

### Headers (h3, h4)
- h3: "Create/Edit Staff" (data-i18n="admin.create-new-staff")
- h4: "Tab Access Permissions"
- h4: "Food Categories Access"
- h4: "Clock In/Out"
- h3: "Work Hours (Last 30 Days)"
- h3: "Work Log (Last 30 Days)"

### Form Labels (data-i18n attributes)
- "Staff Name" (data-i18n="admin.staff-name")
- "PIN (6 digits)" (data-i18n="admin.pin-6digits")
- "Role"
- "Hourly Rate ($/hr)"

### Form Placeholders
- "e.g., John Smith" (staff-name placeholder)
- "e.g., 123456" (staff-pin placeholder)
- "e.g., 15.50" (staff-hourly-rate placeholder)

### Role & Access Options
- "Staff" (staff-role option)
- "Kitchen" (staff-role option)

### Tab Access Checkboxes (Staff Role)
- "Orders" (access-orders label)
- "Tables" (access-tables label)
- "Menu" (access-menu label)
- "Staff" (access-staff label)
- "Settings" (access-settings label)
- "Bookings" (access-bookings label)

### Kitchen Category Access
- "Food Categories Access" (h4 label - in kitchen-category-access)

### Form Action Buttons
- "➕ Add Staff" (staff-submit-btn)
- "Cancel" (type="button" onclick)

### Error/Success Messages
- Rendered in staff-error and staff-success divs

### Staff Detail Modal
- "Staff Name" (staff-detail-name - dynamic h2)
- "Role" (staff-detail-role label)
- "PIN" (staff-detail-pin label)
- "Hourly Rate" (staff-detail-wage label)
- "Status" (staff-detail-status label)
- "Clock In/Out" (h3 in clock section)
- "▶ Clock In" (staff-clock-in-btn)
- "⏹ Clock Out" (staff-clock-out-btn)
- "Work Hours (Last 30 Days)" (h3)
- "Days Worked" (staff-total-shifts label)
- "Total Hours" (staff-total-hours label)
- "Work Log (Last 30 Days)" (h3)
- "Loading..." (timekeeping-list loading state)
- "✏️ Edit Staff" (edit button)
- "🗑️ Delete Staff" (delete button - with confirm prompt)

### Confirmation Dialog
- JavaScript confirm: "Delete this staff member?"

---

## FILE: admin-tables.html

### Headers
- (None in static HTML - dynamically rendered)

### Labels & Messages (data-i18n attributes)
- "Select a session to view orders" (data-i18n="admin.select-session")
- "📖 View Full Orders" (data-i18n="admin.view-orders")
- "💰 Close Bill" (data-i18n="admin.close-bill")
- "📋 All Orders" (data-i18n="admin.all-orders")
- "Close" (data-i18n="admin.close")

### Modal
- "Total: —" (modal-session-total fallback)

---

## FILE: staff.html

### Header Section
- "Orders" (orders-nav-btn menu-text)
- "Tables" (tables-nav-btn menu-text)
- "Menu" (menu-nav-btn menu-text)
- "Staff" (staff-nav-btn menu-text)
- "Bookings" (bookings-nav-btn menu-text)
- "Settings" (settings-nav-btn menu-text)

### Header Buttons (with icons)
- "<img> Edit" (table-edit-btn)
- "<img> Edit" (menu-edit-btn)
- "<img> History" (orders-history-header-btn)
- "Staff" (admin-menu-btn - with dropdown arrow)

### Admin Dropdown Menu
- "Language" (dropdown label)
- "English" (lang-en dropdown button)
- "中文" (lang-zh dropdown button)
- "🚪 Logout" (logout button)

### Login Screen
- "👨‍💼 Staff Dashboard" (data-i18n="staff.title")
- "Enter PIN to continue" (data-i18n="staff.enter-pin")

### Keypad
- "1" through "9" (button labels)
- "0" (button label)
- "⌫" (clear button)
- "⏎" (enter button)

### Sidebar Footer
- "chuio.io" (trademark)

---

## SUMMARY OF MISSING TRANSLATIONS

### Strings ALREADY with data-i18n attributes (some missing from translations.js):
- admin.add-menu-item
- admin.item-name
- admin.price-cents
- admin.category
- admin.select-category
- admin.description
- admin.item-image
- admin.recommended-size
- admin.create-item
- admin.cancel-item
- admin.variants
- admin.price
- admin.preferences
- admin.language
- admin.restaurant-info
- admin.pos-integration
- admin.staff-login-links
- admin.share-with-staff
- admin.qr-settings
- admin.manage-coupons
- admin.logout
- admin.rest-name
- admin.rest-phone
- admin.rest-address
- admin.rest-timezone
- admin.rest-service-charge
- admin.rest-theme-color
- admin.rest-logo
- admin.edit-settings
- admin.save-settings
- admin.cancel-settings
- admin.pos-webhook-url
- admin.pos-api-key
- admin.pos-system-type
- admin.pos-connection-status
- admin.edit
- admin.save
- admin.test
- admin.cancel
- admin.staff-login-help
- admin.table-staff-link
- admin.kitchen-staff-link
- admin.copy
- admin.qr-mode-warning
- admin.qr-code-mode
- admin.qr-regenerate-option
- admin.qr-static-table-option
- admin.qr-static-seat-option
- admin.qr-regenerate-desc
- admin.qr-regenerate-desc-text
- admin.qr-static-table-desc
- admin.qr-static-table-desc-text
- admin.qr-static-seat-desc
- admin.qr-static-seat-desc-text
- admin.no-coupons
- admin.add-new-coupon
- admin.coupon-code
- admin.discount-type
- admin.percentage
- admin.fixed-amount
- admin.discount-value
- admin.min-order-value
- admin.max-uses
- admin.valid-until
- admin.coupon-description
- admin.create-coupon
- admin.create-new-staff
- admin.staff-name
- admin.pin-6digits
- admin.select-session
- admin.view-orders
- admin.close-bill
- admin.all-orders
- admin.close
- staff.title
- staff.enter-pin

### Strings WITHOUT data-i18n attributes (need to be added):

#### admin-bookings.html
- "📅 Reservations"
- "Bookings for"
- "← Previous"
- "Next →"
- "Today"
- "Guest Name *"
- "Phone"
- "Number of Guests *"
- "Table *"
- "Date *"
- "Time *"
- "Status *"
- "Notes"
- "Enter guest name"
- "Enter phone number"
- "Pax"
- "Select a table"
- "Confirmed"
- "Completed"
- "Cancelled"
- "No Show"
- "Add any special notes or requirements"
- "+ New Booking"
- "Cancel"
- "Delete"
- "Save Booking"
- "No bookings for this date"
- "Confirm Action"
- "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"

#### admin-coupons.html
- "🎫 Coupons & Discounts"
- "Create New Coupon"
- "Coupon Code"
- "Discount Type"
- "Discount Value"
- "Minimum Order Value ($)"
- "Max Uses (leave blank for unlimited)"
- "Valid Until"
- "Description"
- "e.g., SUMMER20"
- "e.g., 20"
- "e.g., 50"
- "e.g., 100"
- "e.g., Summer special - 20% off all items"
- "➕ Create Coupon"

#### admin-orders.html
- "Cart"
- "Order History"
- "Order Details"
- "Edit" (button with image)
- "Add to Table"
- "Order Now"
- "To Go"
- "Select Table:"
- "Submit Order"
- "Status:"
- "Total:"
- "Cart is empty"
- "Loading..."
- "Select an order to view details"
- "-- Select a table --"

#### admin-reports.html
- "Total Orders"
- "Total Revenue"
- "Average Bill"
- "Active Sessions"
- "Revenue Report"
- "Date Range"
- "Filter by Category"
- "Filter by Waiter"
- "Filter by Table"
- "Filter by Product"
- "Today"
- "Last 7 Days"
- "Last 30 Days"
- "All Time"
- "All Categories"
- "All Waiters"
- "All Tables"
- "All Products"
- "Busiest Tables"
- "Hourly Revenue"
- "Top Items"
- "Daily Trends"
- "Daily"
- "Weekly"
- "Monthly"
- "Loading analytics dashboard..."

#### admin-menu.html (excluding those with data-i18n)
- "Add/Edit Variant"
- "Variant Name"
- "Min Select"
- "Max Select"
- "Required"
- "Options"
- "+ Add Option"
- "Save"
- "Cancel"
- "Add Option"
- "Option Name"
- "Price (cents) - optional"
- "e.g., Small, Extra Cheese"
- "Change Image"
- "📸 Click to upload image"
- "✓ Save"
- "✕ Cancel"
- "+ Add"
- "Edit" (button)

#### admin-settings.html (excluding those with data-i18n)
- "Restaurant details"
- "Configure QR modes"
- "Manage reservations"
- "Timezone"
- "e.g., 15"
- "Menu Background Image"
- "Reservation Time Allowance"
- "How long a reservation is held past the booked time before it expires (in minutes)"
- "minutes"
- "Default: 15 minutes"
- "💾 Save Settings"

#### admin-staff.html (excluding those with data-i18n)
- "Tab Access Permissions"
- "Food Categories Access"
- "Orders"
- "Tables"
- "Menu"
- "Staff"
- "Settings"
- "Bookings"
- "Role"
- "Hourly Rate ($/hr)"
- "e.g., John Smith"
- "e.g., 123456"
- "e.g., 15.50"
- "Staff"
- "Kitchen"
- "➕ Add Staff"
- "Cancel"
- "Staff Name" (detail modal)
- "Role" (detail modal)
- "PIN" (detail modal)
- "Hourly Rate" (detail modal)
- "Status"
- "Clock In/Out"
- "▶ Clock In"
- "⏹ Clock Out"
- "Work Hours (Last 30 Days)"
- "Days Worked"
- "Total Hours"
- "Work Log (Last 30 Days)"
- "Loading..."
- "✏️ Edit Staff"
- "🗑️ Delete Staff"
- "Delete this staff member?" (confirm)

#### admin-tables.html
- Mostly uses data-i18n, but check modal footer area

#### staff.html
- "Orders" (nav button)
- "Tables" (nav button)
- "Menu" (nav button)
- "Staff" (nav button)
- "Bookings" (nav button)
- "Settings" (nav button)
- "Language"
- "English"
- "中文"
- "🚪 Logout"
- "chuio.io"

---

## PRIORITY GROUPING

### HIGH PRIORITY (Core UI - appear frequently)
- Button labels: "Save", "Cancel", "Delete", "Edit", "Submit", "Create", "Close"
- Form labels: "Name", "Email", "Phone", "Address", "Status", "Notes"
- Navigation: "Orders", "Tables", "Menu", "Staff", "Settings", "Bookings"
- Status messages: "Loading", "No results", "Success", "Error"

### MEDIUM PRIORITY (Feature-specific)
- Restaurant settings: Timezone, Theme Color, Logo, Background
- POS Integration: Webhook URL, API Key, Connection Status
- QR Settings: Static/Regenerate/Per Seat modes
- Booking: Reservation Time Allowance, Guest Name, etc.
- Coupons: Code, Discount Type, Valid Until
- Staff: Role, PIN, Hourly Rate, Clock In/Out

### LOW PRIORITY (Context-dependent)
- Calendar weekdays: "Sun", "Mon", etc.
- Date/time formats
- Timezone options (may need separate handling)
- Currency symbols
- Placeholders that are examples

---

## RECOMMENDATIONS

1. **Add data-i18n attributes** to all remaining hardcoded English text in HTML files
2. **Create corresponding entries** in translations.js for both English and Chinese (中文)
3. **Use consistent naming convention**: `admin.feature-text` format
4. **Handle dynamic content** that needs translation in JavaScript files
5. **Test all translations** across both English and Chinese UI
6. **Consider RTL languages** if future support needed (Arabic, Hebrew)

