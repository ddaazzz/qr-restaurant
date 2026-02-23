# Admin Pages Translatable Content Analysis

## Complete List of Text Content Requiring Chinese Translations

### FILE 1: frontend/admin-menu.html

#### Panel Headers & Titles
- **"Add Menu Item"** - Panel header (h3), `data-i18n="admin.add-menu-item"`
- **"Add/Edit Variant"** - Form section title (h4), inline text
- **"Add Option"** - Form section title (h5), inline text

#### Form Labels
- **"Item Name"** - Form label, `data-i18n="admin.item-name"`
- **"Price (cents)"** - Form label, `data-i18n="admin.price-cents"`
- **"Category"** - Form label, `data-i18n="admin.category"`
- **"Description"** - Form label, `data-i18n="admin.description"` (used multiple times)
- **"Food Item Image"** - Form label, `data-i18n="admin.item-image"`
- **"(Recommended: 400px × 300px)"** - Helper text, `data-i18n="admin.recommended-size"`
- **"Price:"** - Display label, `data-i18n="admin.price"`
- **"Variants"** - Section heading, `data-i18n="admin.variants"`
- **"Variant Name"** - Form label, inline text
- **"Min Select"** - Form label, inline text
- **"Max Select"** - Form label, inline text
- **"Required"** - Checkbox label, inline text
- **"Options"** - Form label, inline text
- **"Option Name"** - Form label, inline text
- **"Price (cents) - optional"** - Form label, inline text

#### Form Placeholders
- **"e.g., Caesar Salad"** - Input placeholder, no i18n
- **"e.g., 1200"** - Input placeholder, no i18n
- **"Add a detailed description of the menu item..."** - Textarea placeholder, no i18n
- **"e.g., Size, Extras"** - Input placeholder, no i18n
- **"0"** - Input placeholder, no i18n (Min/Max Select)
- **"e.g., Small, Extra Cheese"** - Input placeholder, no i18n
- **"e.g., Small, Extra Cheese"** - Input placeholder, no i18n

#### Form Options
- **"-- Select a category --"** - Option value, `data-i18n="admin.select-category"`

#### Buttons & Actions
- **"✓ Create Item"** - Primary button, `data-i18n="admin.create-item"`
- **"✕ Cancel"** - Secondary button, `data-i18n="admin.cancel-item"`
- **"Edit"** - Button label, inline text (with pencil icon)
- **"✓ Save"** - Button label, inline text
- **"✕ Cancel"** - Button label, inline text (edit mode)
- **"+ Add"** - Button label, inline text (variants)
- **"+ Add Option"** - Button label, inline text
- **"+ Add Category"** - Button label (generated in JS), inline text
- **"Save"** - Button label (variant option save), inline text
- **"Cancel"** - Button label (variant option cancel), inline text
- **"Save Variant"** - Button label, inline text
- **"Cancel"** - Button label (variant form cancel), inline text
- **"Change Image"** - Button label, inline text

#### Image Upload UI
- **"📸 Click to upload image"** - Upload placeholder text, inline text
- **"No Image"** - SVG fallback text (alt text), inline text

#### Alt Text & Accessibility
- **"Food Item" "edit"** - Image alt attributes, inline text

#### JavaScript-Generated Text (admin-menu.js)
- **"Enter new menu category name (e.g., Appetizers, Mains):"** - Prompt message, line 100
- **"Failed to create category"** - Error message, line 112
- **"Error creating category:"** - Error message, line 117
- **"No items in this category"** - Empty state message, line 141
- **"Add Category"** - Button text (generated), line 93
- **"Available"** - Status button, line 163 (conditional)
- **"Sold Out"** - Status button, line 163 (conditional)
- **"Invalid price"** - Alert message, line 179
- **"Failed to create item"** - Error message, line 195
- **"Error creating item:"** - Error message, line 200
- **"Done"** - Button text (edit mode), line 34
- **"Edit"** - Button text (edit mode), line 37
- **"+ Add Category"** - Button text, line 93

---

### FILE 2: frontend/admin-bookings.html

#### Page Headers & Titles
- **"📅 Reservations"** - Main page header (h1), `data-i18n="admin.reservations"`
- **"Bookings for"** - Section header text (h3/span), `data-i18n="admin.bookings-for"`
- **"New Booking"** - Modal title (h2), inline text
- **"Edit Booking"** - Modal title (dynamic), set in JavaScript
- **"Confirm Action"** - Confirmation modal header (h2), `data-i18n="admin.confirm-action"`

#### Calendar Controls & Navigation
- **"← Previous"** - Previous month button, `data-i18n="admin.prev-month"`
- **"Next →"** - Next month button, `data-i18n="admin.next-month"`
- **"Today"** - Button label, `data-i18n="admin.today"`
- **"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"** - Weekday labels, inline text (hardcoded)

#### Main Buttons
- **"+ New Booking"** - Primary button, `data-i18n="admin.new-booking"`

#### Form Labels (Booking Modal)
- **"Guest Name *"** - Form label, `data-i18n="admin.guest-name"`
- **"Phone"** - Form label, `data-i18n="admin.phone"`
- **"Number of Guests *"** - Form label, `data-i18n="admin.pax"`
- **"Table *"** - Form label, `data-i18n="admin.select-table"`
- **"Date *"** - Form label, `data-i18n="admin.booking-date"`
- **"Time *"** - Form label, `data-i18n="admin.booking-time"`
- **"Status *"** - Form label, `data-i18n="admin.booking-status"`
- **"Notes"** - Form label, `data-i18n="admin.notes"`

#### Form Placeholders
- **"Enter guest name"** - Input placeholder, inline text
- **"Enter phone number"** - Input placeholder, inline text
- **"Pax"** - Input placeholder, inline text
- **"Add any special notes or requirements"** - Textarea placeholder, inline text

#### Form Options (Select Dropdowns)
- **"Select a table"** - Option default value, inline text
- **"Confirmed"** - Status option, `data-i18n="admin.confirmed"`
- **"Completed"** - Status option, `data-i18n="admin.completed"`
- **"Cancelled"** - Status option, `data-i18n="admin.cancelled"`
- **"No Show"** - Status option, `data-i18n="admin.no-show"`

#### Modal Buttons
- **"Cancel"** - Secondary button in modal, `data-i18n="admin.cancel"`
- **"Delete"** - Danger button (hidden by default), `data-i18n="admin.delete"`
- **"Save Booking"** - Primary button, `data-i18n="admin.save"`
- **"× "** - Close button (modal close), inline text

#### Confirmation Modal
- **"Cancel"** - Secondary button, `data-i18n="admin.cancel"`
- **"Delete"** - Danger button, `data-i18n="admin.delete"`

#### Empty State Text
- **"No bookings for this date"** - Empty state message, `data-i18n="admin.no-bookings"`

#### JavaScript-Generated Text (admin-bookings.js)
- **"Are you sure you want to delete this booking?"** - Confirmation message, line 42 & 436
- **"Edit Booking"** - Modal title (on edit), line 348
- **"Edit"** - Inline button label, line 320
- **"Delete"** - Inline button label, line 321
- **"select-value"** - Booking table dropdown option text (dynamic with seat count), line 82
- Weekday/Month labels from Intl.DateTimeFormat (dynamic, set in JavaScript)

---

### FILE 3: frontend/admin-coupons.html

#### Page Headers & Titles
- **"🎫 Coupons & Discounts"** - Main page header (h2), `data-i18n="admin.coupons-title"`
- **"Create New Coupon"** - Section title (h3), `data-i18n="admin.create-coupon"`

#### Form Labels
- **"Coupon Code"** - Form label, `data-i18n="admin.coupon-code"`
- **"Discount Type"** - Form label, `data-i18n="admin.discount-type"`
- **"Discount Value"** - Form label, `data-i18n="admin.discount-value"`
- **"Minimum Order Value ($)"** - Form label, `data-i18n="admin.min-order-value"`
- **"Max Uses"** - Form label, `data-i18n="admin.max-uses"`
- **"(leave blank for unlimited)"** - Helper text, `data-i18n="admin.unlimited"`
- **"Valid Until"** - Form label, `data-i18n="admin.valid-until"`
- **"Description"** - Form label, `data-i18n="admin.coupon-desc"`

#### Form Placeholders
- **"e.g., SUMMER20"** - Input placeholder (coupon code), inline text
- **"e.g., 20"** - Input placeholder (discount value), inline text
- **"e.g., 50"** - Input placeholder (min order value), inline text
- **"e.g., 100"** - Input placeholder (max uses), inline text
- **"e.g., Summer special - 20% off all items"** - Textarea placeholder, inline text

#### Form Options (Select Dropdowns)
- **"Percentage (%)"** - Discount type option, `data-i18n="admin.percentage"`
- **"Fixed Amount ($)"** - Discount type option, `data-i18n="admin.fixed-amount"`

#### Buttons
- **"➕ Create Coupon"** - Primary button, `data-i18n="admin.create"`

#### Message Elements (CSS Classes, Set by JavaScript)
- **Error messages container** - `id="coupon-error"` class `error-message`, content set dynamically
- **Success messages container** - `id="coupon-success"` class `success-message`, content set dynamically
- **Coupons list container** - `id="coupons-list"` class `section-card`, content rendered by JavaScript

---

## Summary Statistics

### Total Translatable Content by File:

| File | Element Count | Type Categories |
|------|---|---|
| admin-menu.html | 50+ | Headers, Labels, Placeholders, Buttons, Status Indicators, Form Options |
| admin-bookings.html | 50+ | Headers, Calendar UI, Form Labels, Status Options, Buttons, Messages |
| admin-coupons.html | 30+ | Headers, Form Labels, Placeholders, Dropdown Options, Buttons |

### Content Categories Across All Files:

1. **Page/Panel Titles** - 5 items
2. **Form Labels** - 30+ items
3. **Button Labels** - 25+ items
4. **Form Placeholders** - 20+ items
5. **Select/Dropdown Options** - 15+ items
6. **Status Indicators** - 5+ items
7. **Empty States & Messages** - 10+ items
8. **Modal/Dialog Titles** - 5+ items
9. **Helper/Hint Text** - 5+ items
10. **Calendar UI Elements** - 7 items (days of week)
11. **Error/Confirmation Messages** - 10+ items (JavaScript-generated)
12. **Accessibility Text** - 5+ items (alt attributes, aria-labels)

### Already Marked with data-i18n:
- All major labels and buttons already have `data-i18n` attributes
- Missing translations for:
  - Placeholder text
  - Some inline button text
  - Calendar weekday names (hardcoded in HTML)
  - JavaScript-generated alert messages
  - Dynamic text set in JavaScript

### Key Observations:

1. **Placeholders not marked for translation** - All "e.g.," examples and input placeholders should be translated
2. **Calendar weekday names hardcoded** - Should be generated from `Intl.DateTimeFormat` or i18n
3. **JavaScript text not using i18n** - Error messages, alert prompts, status text generated in JS
4. **Status values** - "Available", "Sold Out", "Confirmed", "Completed", "Cancelled", "No Show" need translations
5. **Dynamic content** - Table dropdown options, booking display text need i18n system

