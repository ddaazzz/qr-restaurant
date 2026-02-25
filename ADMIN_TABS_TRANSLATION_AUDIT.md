# ADMIN TABS TRANSLATION AUDIT
**Date:** February 25, 2026  
**Scope:** Extensive audit of all admin modular tab HTML files to identify UI elements requiring English and Chinese translation keys

---

## EXECUTIVE SUMMARY

This audit identifies **87 translatable elements** across 5 admin tab HTML files that require `data-i18n` attributes and corresponding translation key entries. The elements are categorized by:
- **Priority Level**: CRITICAL, HIGH, MEDIUM, LOW
- **Translation Status**: Missing Both Languages, Missing Chinese Only, Complete
- **Element Type**: Form Labels, Placeholders, Buttons, Headers, Status Indicators, Helper Text

**Key Finding**: Approximately **45% of UI elements lack proper translation infrastructure**, with most issues in form field labels, placeholders, and status indicators.

---

## 1. ADMIN ORDERS (admin-orders.html)

### 1.1 ORDER ITEM ROW CONTENT

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 1 | Line 14 | "Order History" | ✅ HAS i18n | CRITICAL | Header | `admin.order-history` | ✓ | ✗ MISSING |
| 2 | Line 15 | "Loading..." | ✅ HAS i18n | HIGH | Status | `admin.loading` | ✓ | ✗ MISSING |
| 3 | Line 33 | "Cart" | ✅ HAS i18n | CRITICAL | Header | `admin.cart` | ✓ | ✗ MISSING |
| 4 | Line 34 | Cart item count | ❌ NO i18n | HIGH | Display | `admin.cart-count` | ✗ | ✗ |
| 5 | Line 45 | "Cart" | ✅ HAS i18n | CRITICAL | Header | `admin.cart` (reused) | ✓ | ✗ MISSING |
| 6 | Line 47 | "Edit" button text | ✅ HAS i18n | MEDIUM | Button | `admin.edit` | ✓ | ✗ MISSING |
| 7 | Line 65 | "Cart is empty" | ✅ HAS i18n | HIGH | Message | `admin.loading` (MISUSED - should be unique) | ✓ | ✗ |
| 8 | Line 73 | "Total:" | ✅ HAS i18n | CRITICAL | Label | `admin.total` | ✓ | ✗ MISSING |

### 1.2 CART PANEL - ORDER TYPE SELECTION

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 9 | Line 81 | "Add to Table" | ✅ HAS i18n | CRITICAL | Radio Label | `admin.add-to-table` | ✓ | ✗ MISSING |
| 10 | Line 85 | "Order Now" | ✅ HAS i18n | CRITICAL | Radio Label | `admin.order-now` | ✓ | ✗ MISSING |
| 11 | Line 89 | "To Go" | ✅ HAS i18n | CRITICAL | Radio Label | `admin.to-go` | ✓ | ✗ MISSING |
| 12 | Line 94 | "Select Table:" | ✅ HAS i18n | CRITICAL | Label | `admin.select-table` | ✓ | ✗ MISSING |
| 13 | Line 95 | "-- Select a table --" | ✅ HAS i18n | HIGH | Placeholder | `admin.select-table-placeholder` | ✓ | ✗ MISSING |

### 1.3 CART FOOTER - ORDER SUBMISSION

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 14 | Line 77 | "Status: " (label, no i18n) | ❌ NO i18n | HIGH | Label | `admin.status-label` | ✗ | ✗ |
| 15 | Line 100 | "Submit Order" | ✅ HAS i18n | CRITICAL | Button | `admin.submit-order` | ✓ | ✗ MISSING |

### 1.4 ORDER DETAILS VIEW

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 16 | Line 107 | "Order Details" | ✅ HAS i18n | CRITICAL | Header | `admin.order-header` | ✓ | ✗ MISSING |
| 17 | Line 108 | "← Back" | ✅ HAS i18n | MEDIUM | Button | `admin.back` | ✓ | ✗ MISSING |
| 18 | Line 111 | "Select an order to view details" | ✅ HAS i18n | MEDIUM | Message | `admin.select-an-order` | ✓ | ✗ MISSING |

### Issues Identified in admin-orders.html:
- ❌ "Cart is empty" reuses `admin.loading` key (incorrect)
- ❌ "Status: " label lacks i18n attribute
- ❌ Cart count display not translatable
- ⚠️ All keys missing Chinese translations

---

## 2. ADMIN MENU (admin-menu.html)

### 2.1 CREATE ITEM FORM - Basic Fields

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 19 | Line 6 | "Add Menu Item" | ✅ HAS i18n | CRITICAL | Header | `admin.add-menu-item` | ✓ | ✗ MISSING |
| 20 | Line 10 | Item Name label | ✅ HAS i18n | CRITICAL | Label | `admin.item-name` | ✓ | ✗ MISSING |
| 21 | Line 11 | "e.g., Caesar Salad" | ✅ HAS i18n | MEDIUM | Placeholder | `admin.item-name-placeholder` | ✓ | ✗ MISSING |
| 22 | Line 13 | "Price (cents)" | ✅ HAS i18n | CRITICAL | Label | `admin.price-cents` | ✓ | ✗ MISSING |
| 23 | Line 14 | "e.g., 1200" | ✅ HAS i18n | MEDIUM | Placeholder | `admin.price-placeholder` | ✓ | ✗ MISSING |
| 24 | Line 17 | "Category" | ✅ HAS i18n | CRITICAL | Label | `admin.category` | ✓ | ✗ MISSING |
| 25 | Line 18 | "-- Select a category --" | ✅ HAS i18n | HIGH | Placeholder | `admin.select-category` | ✓ | ✗ MISSING |
| 26 | Line 22 | "Description" | ✅ HAS i18n | CRITICAL | Label | `admin.description` | ✓ | ✗ MISSING |
| 27 | Line 23 | "Add a detailed description..." | ✅ HAS i18n | MEDIUM | Placeholder | `admin.description-placeholder` | ✓ | ✗ MISSING |
| 28 | Line 26 | "Food Item Image" | ✅ HAS i18n | HIGH | Label | `admin.item-image` | ✓ | ✗ MISSING |
| 29 | Line 26 | "(Recommended: 400px × 300px)" | ✅ HAS i18n | LOW | Helper Text | `admin.recommended-size` | ✓ | ✗ MISSING |
| 30 | Line 31 | "📸 Click to upload image" | ✅ HAS i18n | MEDIUM | Placeholder | `admin.upload-image` | ✓ | ✗ MISSING |

### 2.2 CREATE ITEM FORM - Action Buttons

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 31 | Line 37 | "✓ Create Item" | ✅ HAS i18n | CRITICAL | Button | `admin.create-item` | ✓ | ✗ MISSING |
| 32 | Line 38 | "✕ Cancel" | ✅ HAS i18n | MEDIUM | Button | `admin.cancel-item` | ✓ | ✗ MISSING |

### 2.3 FOOD ITEM PANEL - Display & Edit

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 33 | Line 62 | "Edit" button | ❌ NO i18n | MEDIUM | Button | `admin.edit` | ✓ (exists) | ✗ MISSING |
| 34 | Line 63 | "✓ Save" | ❌ NO i18n | MEDIUM | Button | `admin.save` | ✓ (exists) | ✗ MISSING |
| 35 | Line 64 | "✕ Cancel" | ❌ NO i18n | MEDIUM | Button | `admin.cancel` | ✓ (exists) | ✗ MISSING |
| 36 | Line 67 | "Price:" (label) | ✅ HAS i18n | CRITICAL | Label | `admin.price` | ✓ | ✗ MISSING |
| 37 | Line 71 | "Description:" | ✅ HAS i18n | CRITICAL | Label | `admin.description` (reused) | ✓ | ✗ MISSING |
| 38 | Line 75 | "Variants" header | ✅ HAS i18n | CRITICAL | Header | `admin.variants` | ✓ | ✗ MISSING |
| 39 | Line 77 | "+ Add" button | ❌ NO i18n | MEDIUM | Button | `admin.add-variant` | ✗ | ✗ |

### 2.4 VARIANT FORM - Inline Editor

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 40 | Line 82 | "Add/Edit Variant" | ❌ NO i18n | MEDIUM | Header | `admin.variant-form-title` | ✗ | ✗ |
| 41 | Line 84 | "Variant Name" | ❌ NO i18n | CRITICAL | Label | `admin.variant-name` | ✗ | ✗ |
| 42 | Line 85 | "e.g., Size, Extras" | ❌ NO i18n | MEDIUM | Placeholder | `admin.variant-name-placeholder` | ✗ | ✗ |
| 43 | Line 87 | "Min Select" | ❌ NO i18n | CRITICAL | Label | `admin.variant-min-select` | ✗ | ✗ |
| 44 | Line 91 | "Max Select" | ❌ NO i18n | CRITICAL | Label | `admin.variant-max-select` | ✗ | ✗ |
| 45 | Line 96 | "Required" | ❌ NO i18n | HIGH | Label | `admin.variant-required` | ✗ | ✗ |

### 2.5 VARIANT OPTIONS SECTION

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 46 | Line 100 | "Options" (label) | ❌ NO i18n | HIGH | Label | `admin.variant-options` | ✗ | ✗ |
| 47 | Line 101 | "+ Add Option" | ❌ NO i18n | MEDIUM | Button | `admin.add-option` | ✗ | ✗ |
| 48 | Line 110 | "Add Option" | ❌ NO i18n | MEDIUM | Header | `admin.add-option-title` | ✗ | ✗ |
| 49 | Line 112 | "Option Name" | ❌ NO i18n | CRITICAL | Label | `admin.option-name` | ✗ | ✗ |
| 50 | Line 113 | "e.g., Small, Extra Cheese" | ❌ NO i18n | MEDIUM | Placeholder | `admin.option-name-placeholder` | ✗ | ✗ |
| 51 | Line 115 | "Price (cents) - optional" | ❌ NO i18n | MEDIUM | Label | `admin.option-price-label` | ✗ | ✗ |
| 52 | Line 117 | "Save" button | ❌ NO i18n | MEDIUM | Button | `admin.save-option` (should be different from `admin.save`) | ✗ | ✗ |
| 53 | Line 118 | "Cancel" button | ❌ NO i18n | MEDIUM | Button | `admin.cancel-option` (should be different from `admin.cancel`) | ✗ | ✗ |
| 54 | Line 122 | "Save Variant" | ❌ NO i18n | MEDIUM | Button | `admin.save-variant` (should be different from `admin.save`) | ✗ | ✗ |
| 55 | Line 123 | "Cancel" button | ❌ NO i18n | MEDIUM | Button | `admin.cancel-variant` (should be different from `admin.cancel`) | ✗ | ✗ |

### Issues Identified in admin-menu.html:
- ❌ **15 elements lack `data-i18n` attributes entirely** (Lines 33-35, 39, 40-55)
- ❌ Many buttons reuse generic keys that should be context-specific
- ⚠️ All variant/option form elements lack translation keys completely
- ⚠️ All keys missing Chinese translations

---

## 3. ADMIN TABLES (admin-tables.html)

### 3.1 SESSION PANEL HEADER

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 56 | Line 10 | "Select a session to view orders" | ✅ HAS i18n | MEDIUM | Message | `admin.select-session` | ✓ | ✗ MISSING |
| 57 | Line 19 | "📖 View Full Orders" | ✅ HAS i18n | MEDIUM | Button | `admin.view-orders` | ✓ | ✗ MISSING |
| 58 | Line 22 | "💰 Close Bill" | ✅ HAS i18n | CRITICAL | Button | `admin.close-bill` | ✓ | ✗ MISSING |

### 3.2 ORDERS MODAL

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 59 | Line 28 | "📋 All Orders" | ✅ HAS i18n | CRITICAL | Header | `admin.all-orders` | ✓ | ✗ MISSING |
| 60 | Line 35 | "Total: —" | ❌ NO i18n (partial) | HIGH | Label | `admin.modal-session-total` | ✗ | ✗ |
| 61 | Line 36 | "Close" button | ✅ HAS i18n | MEDIUM | Button | `admin.close` | ✓ | ✗ MISSING |

### Issues Identified in admin-tables.html:
- ❌ Modal session total label not translatable
- ⚠️ All keys missing Chinese translations

---

## 4. ADMIN STAFF (admin-staff.html)

### 4.1 CREATE/EDIT FORM - Basic Fields

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 62 | Line 5 | "Create/Edit Staff" | ✅ HAS i18n | CRITICAL | Header | `admin.create-new-staff` | ✓ | ✗ MISSING |
| 63 | Line 8 | Error message container | ❌ NO i18n (dynamic) | MEDIUM | Container | `admin.error-message` | ✗ | ✗ |
| 64 | Line 9 | Success message container | ❌ NO i18n (dynamic) | MEDIUM | Container | `admin.success-message` | ✗ | ✗ |
| 65 | Line 12 | "Staff Name" | ✅ HAS i18n | CRITICAL | Label | `admin.staff-name` | ✓ | ✗ MISSING |
| 66 | Line 13 | "e.g., John Smith" | ❌ NO i18n | MEDIUM | Placeholder | `admin.staff-name-placeholder` | ✗ | ✗ |
| 67 | Line 15 | "PIN (6 digits)" | ✅ HAS i18n | CRITICAL | Label | `admin.pin-6digits` | ✓ | ✗ MISSING |
| 68 | Line 16 | "e.g., 123456" | ❌ NO i18n | MEDIUM | Placeholder | `admin.pin-placeholder` | ✗ | ✗ |
| 69 | Line 18 | "Role" | ✅ HAS i18n | CRITICAL | Label | `admin.role` | ✓ | ✗ MISSING |
| 70 | Line 19 | "Staff" (option) | ✅ HAS i18n | HIGH | Select Option | `admin.staff-role` | ✓ | ✗ MISSING |
| 71 | Line 20 | "Kitchen" (option) | ✅ HAS i18n | HIGH | Select Option | `admin.kitchen-role` | ✓ | ✗ MISSING |
| 72 | Line 22 | "Hourly Rate ($/hr)" | ✅ HAS i18n | CRITICAL | Label | `admin.hourly-rate` | ✓ | ✗ MISSING |
| 73 | Line 23 | "e.g., 15.50" | ❌ NO i18n | MEDIUM | Placeholder | `admin.hourly-rate-placeholder` | ✗ | ✗ |

### 4.2 ACCESS RIGHTS SECTION

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 74 | Line 27 | "Tab Access Permissions" | ✅ HAS i18n | HIGH | Header | `admin.access-rights` | ✓ | ✗ MISSING |
| 75 | Line 29 | "Orders" (checkbox) | ✅ HAS i18n | HIGH | Label | `admin.access-orders` | ✓ | ✗ MISSING |
| 76 | Line 32 | "Tables" (checkbox) | ✅ HAS i18n | HIGH | Label | `admin.access-tables` | ✓ | ✗ MISSING |
| 77 | Line 35 | "Menu" (checkbox) | ✅ HAS i18n | HIGH | Label | `admin.access-menu` | ✓ | ✗ MISSING |
| 78 | Line 38 | "Staff" (checkbox) | ✅ HAS i18n | HIGH | Label | `admin.access-staff` | ✓ | ✗ MISSING |
| 79 | Line 41 | "Settings" (checkbox) | ✅ HAS i18n | HIGH | Label | `admin.access-settings` | ✓ | ✗ MISSING |
| 80 | Line 44 | "Bookings" (checkbox) | ✅ HAS i18n | HIGH | Label | `admin.access-bookings` | ✓ | ✗ MISSING |
| 81 | Line 48 | "Food Categories Access" | ✅ HAS i18n | HIGH | Header | `admin.allowed-categories` | ✓ | ✗ MISSING |

### 4.3 FORM ACTION BUTTONS

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 82 | Line 56 | "➕ Add Staff" | ✅ HAS i18n | CRITICAL | Button | `admin.add-staff` | ✓ | ✗ MISSING |
| 83 | Line 57 | "Cancel" | ✅ HAS i18n | MEDIUM | Button | `admin.cancel` | ✓ | ✗ MISSING |

### 4.4 STAFF DETAIL MODAL - Info Section

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 84 | Line 70 | Staff name heading | ❌ NO i18n (dynamic) | HIGH | Header | (dynamic content) | ✓ | ✗ MISSING |
| 85 | Line 76 | "Role" (label) | ❌ NO i18n | MEDIUM | Label | `admin.detail-role` | ✗ | ✗ |
| 86 | Line 80 | "PIN" (label) | ❌ NO i18n | MEDIUM | Label | `admin.detail-pin` | ✗ | ✗ |
| 87 | Line 84 | "Hourly Rate" (label) | ❌ NO i18n | MEDIUM | Label | `admin.detail-hourly-rate` | ✗ | ✗ |
| 88 | Line 88 | "Status" (label) | ❌ NO i18n | MEDIUM | Label | `admin.detail-status` | ✗ | ✗ |

### 4.5 CLOCK IN/OUT SECTION

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 89 | Line 94 | "Clock In/Out" | ❌ NO i18n | MEDIUM | Header | `admin.clock-section-title` | ✗ | ✗ |
| 90 | Line 96 | "▶ Clock In" | ❌ NO i18n | CRITICAL | Button | `admin.clock-in` | ✗ | ✗ |
| 91 | Line 99 | "⏹ Clock Out" | ❌ NO i18n | CRITICAL | Button | `admin.clock-out` | ✗ | ✗ |

### 4.6 WORK HOURS & LOG SECTION

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 92 | Line 106 | "Work Hours (Last 30 Days)" | ❌ NO i18n | MEDIUM | Header | `admin.work-hours-title` | ✗ | ✗ |
| 93 | Line 108 | "Days Worked" | ❌ NO i18n | MEDIUM | Label | `admin.days-worked` | ✗ | ✗ |
| 94 | Line 112 | "Total Hours" | ❌ NO i18n | MEDIUM | Label | `admin.total-hours` | ✗ | ✗ |
| 95 | Line 117 | "Work Log (Last 30 Days)" | ❌ NO i18n | MEDIUM | Header | `admin.work-log-title` | ✗ | ✗ |
| 96 | Line 119 | "Loading..." | ❌ NO i18n (but exists) | LOW | Status | `admin.loading` (should reuse) | ✓ | ✗ MISSING |

### 4.7 MODAL ACTION BUTTONS

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 97 | Line 125 | "✏️ Edit Staff" | ❌ NO i18n | MEDIUM | Button | `admin.edit-staff` | ✗ | ✗ |
| 98 | Line 126 | "🗑️ Delete Staff" | ❌ NO i18n | MEDIUM | Button | `admin.delete-staff` | ✗ | ✗ |
| 99 | Line 126 | "Delete this staff member?" | ❌ NO i18n (hardcoded in onclick) | CRITICAL | Confirmation | `admin.confirm-delete-staff` | ✗ | ✗ |

### Issues Identified in admin-staff.html:
- ❌ **21 elements lack `data-i18n` attributes** (placeholders, modal labels, buttons, headers)
- ❌ Clock in/out buttons completely untranslatable
- ❌ Work hours section labels not translatable
- ⚠️ All keys missing Chinese translations

---

## 5. ADMIN COUPONS (admin-coupons.html)

### 5.1 PAGE HEADER

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 100 | Line 3 | "🎫 Coupons & Discounts" | ✅ HAS i18n | CRITICAL | Page Title | `admin.coupons-title` | ✓ | ✗ MISSING |

### 5.2 CREATE COUPON FORM - Header & Messages

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 101 | Line 6 | "Create New Coupon" | ✅ HAS i18n | CRITICAL | Header | `admin.create-coupon` | ✓ | ✗ MISSING |
| 102 | Line 7 | Error message container | ❌ NO i18n (dynamic) | MEDIUM | Container | `admin.coupon-error` | ✗ | ✗ |
| 103 | Line 8 | Success message container | ❌ NO i18n (dynamic) | MEDIUM | Container | `admin.coupon-success` | ✗ | ✗ |

### 5.3 CREATE COUPON FORM - Basic Fields

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 104 | Line 11 | "Coupon Code" | ✅ HAS i18n | CRITICAL | Label | `admin.coupon-code` | ✓ | ✗ MISSING |
| 105 | Line 12 | "e.g., SUMMER20" | ❌ NO i18n | MEDIUM | Placeholder | `admin.coupon-code-placeholder` | ✗ | ✗ |
| 106 | Line 14 | "Discount Type" | ✅ HAS i18n | CRITICAL | Label | `admin.discount-type` | ✓ | ✗ MISSING |
| 107 | Line 15 | "Percentage (%)" | ✅ HAS i18n | HIGH | Select Option | `admin.percentage` | ✓ | ✗ MISSING |
| 108 | Line 16 | "Fixed Amount ($)" | ✅ HAS i18n | HIGH | Select Option | `admin.fixed-amount` | ✓ | ✗ MISSING |
| 109 | Line 20 | "Discount Value" | ✅ HAS i18n | CRITICAL | Label | `admin.discount-value` | ✓ | ✗ MISSING |
| 110 | Line 21 | "e.g., 20" | ❌ NO i18n | MEDIUM | Placeholder | `admin.discount-value-placeholder` | ✗ | ✗ |
| 111 | Line 23 | "Minimum Order Value ($)" | ✅ HAS i18n | MEDIUM | Label | `admin.min-order-value` | ✓ | ✗ MISSING |
| 112 | Line 24 | "e.g., 50" | ❌ NO i18n | MEDIUM | Placeholder | `admin.min-order-value-placeholder` | ✗ | ✗ |

### 5.4 CREATE COUPON FORM - Usage & Expiry

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 113 | Line 27 | "Max Uses" | ✅ HAS i18n | MEDIUM | Label (partial) | `admin.max-uses` | ✓ | ✗ MISSING |
| 114 | Line 27 | "(leave blank for unlimited)" | ✅ HAS i18n | MEDIUM | Helper Text | `admin.unlimited` | ✓ | ✗ MISSING |
| 115 | Line 28 | "e.g., 100" | ❌ NO i18n | MEDIUM | Placeholder | `admin.max-uses-placeholder` | ✗ | ✗ |
| 116 | Line 30 | "Valid Until" | ✅ HAS i18n | CRITICAL | Label | `admin.valid-until` | ✓ | ✗ MISSING |

### 5.5 CREATE COUPON FORM - Description & Action

| # | HTML Location | Current Text | Status | Priority | Element Type | Translation Key | EN | ZH |
|---|--|--|--|--|--|--|--|--|
| 117 | Line 34 | "Description" | ✅ HAS i18n | MEDIUM | Label | `admin.coupon-desc` | ✓ | ✗ MISSING |
| 118 | Line 35 | "e.g., Summer special - 20% off all items" | ❌ NO i18n | LOW | Placeholder | `admin.coupon-desc-placeholder` | ✗ | ✗ |
| 119 | Line 39 | "➕ Create Coupon" | ✅ HAS i18n | CRITICAL | Button | `admin.create` | ✓ | ✗ MISSING |

### Issues Identified in admin-coupons.html:
- ❌ **8 elements lack `data-i18n` attributes** (placeholders, messages)
- ⚠️ All keys missing Chinese translations
- ⚠️ Error/Success message containers not translatable

---

## CONSOLIDATED MISSING TRANSLATION KEYS

### New Keys Needed (Not in translations.js)

| Key | English | Chinese | Category | Priority |
|--|--|--|--|--|
| `admin.cart-is-empty` | Cart is empty | 购物车为空 | Message | HIGH |
| `admin.status-label` | Status | 状态 | Label | HIGH |
| `admin.add-variant` | + Add | +添加 | Button | MEDIUM |
| `admin.variant-form-title` | Add/Edit Variant | 添加/编辑变体 | Header | MEDIUM |
| `admin.variant-name` | Variant Name | 变体名称 | Label | CRITICAL |
| `admin.variant-name-placeholder` | e.g., Size, Extras | 例如：大小、配料 | Placeholder | MEDIUM |
| `admin.variant-min-select` | Min Select | 最小选择 | Label | CRITICAL |
| `admin.variant-max-select` | Max Select | 最大选择 | Label | CRITICAL |
| `admin.variant-required` | Required | 必需 | Label | HIGH |
| `admin.variant-options` | Options | 选项 | Label | HIGH |
| `admin.add-option` | + Add Option | +添加选项 | Button | MEDIUM |
| `admin.add-option-title` | Add Option | 添加选项 | Header | MEDIUM |
| `admin.option-name` | Option Name | 选项名称 | Label | CRITICAL |
| `admin.option-name-placeholder` | e.g., Small, Extra Cheese | 例如：小号、额外奶酪 | Placeholder | MEDIUM |
| `admin.option-price-label` | Price (cents) - optional | 价格（美分）- 可选 | Label | MEDIUM |
| `admin.save-option` | Save | 保存 | Button | MEDIUM |
| `admin.cancel-option` | Cancel | 取消 | Button | MEDIUM |
| `admin.save-variant` | Save Variant | 保存变体 | Button | MEDIUM |
| `admin.cancel-variant` | Cancel | 取消 | Button | MEDIUM |
| `admin.modal-session-total` | Total | 总计 | Label | HIGH |
| `admin.staff-name-placeholder` | e.g., John Smith | 例如：John Smith | Placeholder | MEDIUM |
| `admin.pin-placeholder` | e.g., 123456 | 例如：123456 | Placeholder | MEDIUM |
| `admin.hourly-rate-placeholder` | e.g., 15.50 | 例如：15.50 | Placeholder | MEDIUM |
| `admin.detail-role` | Role | 角色 | Label | MEDIUM |
| `admin.detail-pin` | PIN | PIN | Label | MEDIUM |
| `admin.detail-hourly-rate` | Hourly Rate | 小时工资 | Label | MEDIUM |
| `admin.detail-status` | Status | 状态 | Label | MEDIUM |
| `admin.clock-section-title` | Clock In/Out | 打卡进/出 | Header | MEDIUM |
| `admin.clock-in` | ▶ Clock In | ▶ 打卡进 | Button | CRITICAL |
| `admin.clock-out` | ⏹ Clock Out | ⏹ 打卡出 | Button | CRITICAL |
| `admin.work-hours-title` | Work Hours (Last 30 Days) | 工作时间（过去30天） | Header | MEDIUM |
| `admin.days-worked` | Days Worked | 工作天数 | Label | MEDIUM |
| `admin.total-hours` | Total Hours | 总时数 | Label | MEDIUM |
| `admin.work-log-title` | Work Log (Last 30 Days) | 工作日志（过去30天） | Header | MEDIUM |
| `admin.edit-staff` | ✏️ Edit Staff | ✏️ 编辑员工 | Button | MEDIUM |
| `admin.delete-staff` | 🗑️ Delete Staff | 🗑️ 删除员工 | Button | MEDIUM |
| `admin.confirm-delete-staff` | Delete this staff member? | 删除此员工吗？ | Confirmation | CRITICAL |
| `admin.coupon-code-placeholder` | e.g., SUMMER20 | 例如：SUMMER20 | Placeholder | MEDIUM |
| `admin.discount-value-placeholder` | e.g., 20 | 例如：20 | Placeholder | MEDIUM |
| `admin.min-order-value-placeholder` | e.g., 50 | 例如：50 | Placeholder | MEDIUM |
| `admin.max-uses-placeholder` | e.g., 100 | 例如：100 | Placeholder | MEDIUM |
| `admin.coupon-desc-placeholder` | e.g., Summer special - 20% off all items | 例如：夏季特价 - 所有商品8折 | Placeholder | LOW |

### Existing Keys Missing Chinese Translations (38 keys)

All of the following keys already exist in translations.js but lack Chinese translations:

1. `admin.order-history` 
2. `admin.loading` 
3. `admin.cart` 
4. `admin.edit` 
5. `admin.total` 
6. `admin.add-to-table` 
7. `admin.order-now` 
8. `admin.to-go` 
9. `admin.select-table` 
10. `admin.select-table-placeholder` 
11. `admin.submit-order` 
12. `admin.order-header` 
13. `admin.back` 
14. `admin.select-an-order` 
15. `admin.add-menu-item` 
16. `admin.item-name` 
17. `admin.item-name-placeholder` 
18. `admin.price-cents` 
19. `admin.price-placeholder` 
20. `admin.category` 
21. `admin.select-category` 
22. `admin.description` 
23. `admin.description-placeholder` 
24. `admin.item-image` 
25. `admin.recommended-size` 
26. `admin.upload-image` 
27. `admin.create-item` 
28. `admin.cancel-item` 
29. `admin.price` 
30. `admin.variants` 
31. `admin.select-session` 
32. `admin.view-orders` 
33. `admin.close-bill` 
34. `admin.all-orders` 
35. `admin.close` 
36. `admin.create-new-staff` 
37. `admin.staff-name` 
38. `admin.pin-6digits` 

(+ 8 more access rights keys)

---

## SUMMARY BY FILE

| File | Total Elements | With i18n | Missing i18n | Missing Chinese | Action Required |
|--|--|--|--|--|--|
| admin-orders.html | 18 | 16 (89%) | 2 (11%) | 16 (89%) | Fix cart-empty key reuse; Add Chinese |
| admin-menu.html | 37 | 18 (49%) | 19 (51%) | 37 (100%) | Add 19 i18n attrs; Add Chinese |
| admin-tables.html | 4 | 3 (75%) | 1 (25%) | 4 (100%) | Add 1 i18n attr; Add Chinese |
| admin-staff.html | 38 | 18 (47%) | 20 (53%) | 38 (100%) | Add 20 i18n attrs; Add Chinese |
| admin-coupons.html | 19 | 13 (68%) | 6 (32%) | 19 (100%) | Add 6 i18n attrs; Add Chinese |
| **TOTAL** | **116** | **68 (59%)** | **48 (41%)** | **114 (98%)** | **Add 48 i18n attrs; 152 Chinese translations** |

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Add Missing `data-i18n` Attributes (48 items)

- [ ] **admin-menu.html** (15 items)
  - [ ] Edit button (line 62)
  - [ ] Save button (line 63)
  - [ ] Cancel button (line 64)
  - [ ] Add variant button (line 77)
  - [ ] Variant form elements (lines 82-125)
  - [ ] Variant options form elements (lines 100-123)

- [ ] **admin-staff.html** (20 items)
  - [ ] Staff name placeholder (line 13)
  - [ ] PIN placeholder (line 16)
  - [ ] Hourly rate placeholder (line 23)
  - [ ] Error/Success message containers (lines 8-9)
  - [ ] Modal section headers (lines 75-88)
  - [ ] Clock in/out buttons (lines 96-99)
  - [ ] Work hours section (lines 92-119)
  - [ ] Modal action buttons (lines 125-126)

- [ ] **admin-coupons.html** (6 items)
  - [ ] Coupon code placeholder (line 12)
  - [ ] Error/Success containers (lines 7-8)
  - [ ] Discount value placeholder (line 21)
  - [ ] Min order value placeholder (line 24)
  - [ ] Max uses placeholder (line 28)
  - [ ] Coupon description placeholder (line 35)

- [ ] **admin-orders.html** (2 items)
  - [ ] Status label (line 77)
  - [ ] Fix "Cart is empty" key reuse (line 67)

- [ ] **admin-tables.html** (1 item)
  - [ ] Modal session total (line 35)

### Phase 2: Add New Translation Keys to translations.js (43 new keys)

### Phase 3: Add Chinese Translations (152 total keys)

---

## RECOMMENDATION PRIORITY ORDER

1. **URGENT** - Fix existing key misuse (`admin.loading` for "Cart is empty")
2. **HIGH** - Add all CRITICAL priority elements with both languages
3. **MEDIUM** - Add all HIGH priority elements with both languages
4. **NORMAL** - Add placeholder and LOW priority elements

**Estimated Implementation Time:** 2-3 hours total
**Breaking Changes:** None (backward compatible)
**Testing Required:** Visual inspection of all 5 admin tabs for translation keys displaying correctly in English and Chinese

