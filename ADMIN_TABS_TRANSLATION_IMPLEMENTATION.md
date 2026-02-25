# ADMIN TABS TRANSLATION - IMPLEMENTATION GUIDE

## Quick Links to Issues by File

### admin-orders.html (2 issues - 18% untranslatable)
- **Line 67**: Change `<p data-i18n="admin.loading">Cart is empty</p>` → `<p data-i18n="admin.cart-is-empty">Cart is empty</p>`
- **Line 77**: Add `<span data-i18n="admin.status-label">Status: </span>` around "Status: " label

### admin-menu.html (15 issues - 40% untranslatable)
- **Lines 62-64**: Add `data-i18n` to Edit/Save/Cancel buttons
- **Line 77**: Add `data-i18n="admin.add-variant"` to+ Add button
- **Lines 82-125**: Add `data-i18n` to all variant form labels and buttons (12 elements)
- **Line 40**: Add `data-i18n="admin.add-variant"` to floating button

### admin-staff.html (20 issues - 52% untranslatable)
- **Lines 8-9**: Message containers not translatable (dynamic content)
- **Lines 13, 16, 23**: Add placeholders with i18n
- **Lines 76-119**: Add i18n to all modal section headers and labels
- **Lines 96-99**: Add i18n to Clock In/Out buttons
- **Lines 125-126**: Add i18n to Edit Staff/Delete Staff buttons and confirmation

### admin-tables.html (1 issue - 25% untranslatable)
- **Line 35**: Add `data-i18n="admin.modal-session-total"` wrapper

### admin-coupons.html (6 issues - 32% untranslatable)
- **Lines 12, 21, 24, 28, 35**: Add placeholder `data-i18n` attributes
- **Lines 7-8**: Dynamic message containers

---

## NEW TRANSLATION KEYS TO ADD (43 total)

### GROUP 1: Menu Variants (11 keys)
```javascript
'admin.add-variant': 'Add Variant',
'admin.variant-form-title': 'Add/Edit Variant',
'admin.variant-name': 'Variant Name',
'admin.variant-name-placeholder': 'e.g., Size, Extras',
'admin.variant-min-select': 'Min Select',
'admin.variant-max-select': 'Max Select',
'admin.variant-required': 'Required',
'admin.variant-options': 'Options',
'admin.add-option': 'Add Option',
'admin.add-option-title': 'Add Option',
'admin.option-name': 'Option Name',
```

### GROUP 2: Menu Variant Options (6 keys)
```javascript
'admin.option-name-placeholder': 'e.g., Small, Extra Cheese',
'admin.option-price-label': 'Price (cents) - optional',
'admin.save-option': 'Save',
'admin.cancel-option': 'Cancel',
'admin.save-variant': 'Save Variant',
'admin.cancel-variant': 'Cancel',
```

### GROUP 3: General Fixes (2 keys)
```javascript
'admin.cart-is-empty': 'Cart is empty',
'admin.status-label': 'Status',
```

### GROUP 4: Tables (1 key)
```javascript
'admin.modal-session-total': 'Total',
```

### GROUP 5: Staff Form Placeholders (3 keys)
```javascript
'admin.staff-name-placeholder': 'e.g., John Smith',
'admin.pin-placeholder': 'e.g., 123456',
'admin.hourly-rate-placeholder': 'e.g., 15.50',
```

### GROUP 6: Staff Modal Labels (4 keys)
```javascript
'admin.detail-role': 'Role',
'admin.detail-pin': 'PIN',
'admin.detail-hourly-rate': 'Hourly Rate',
'admin.detail-status': 'Status',
```

### GROUP 7: Staff Clock & Work (5 keys)
```javascript
'admin.clock-section-title': 'Clock In/Out',
'admin.clock-in': 'Clock In',
'admin.clock-out': 'Clock Out',
'admin.work-hours-title': 'Work Hours (Last 30 Days)',
'admin.days-worked': 'Days Worked',
'admin.total-hours': 'Total Hours',
'admin.work-log-title': 'Work Log (Last 30 Days)',
```

### GROUP 8: Staff Actions (3 keys)
```javascript
'admin.edit-staff': 'Edit Staff',
'admin.delete-staff': 'Delete Staff',
'admin.confirm-delete-staff': 'Delete this staff member?',
```

### GROUP 9: Coupon Placeholders (6 keys)
```javascript
'admin.coupon-code-placeholder': 'e.g., SUMMER20',
'admin.discount-value-placeholder': 'e.g., 20',
'admin.min-order-value-placeholder': 'e.g., 50',
'admin.max-uses-placeholder': 'e.g., 100',
'admin.coupon-desc-placeholder': 'e.g., Summer special - 20% off all items',
```

---

## CHINESE TRANSLATIONS TO ADD (152 total)

### English → Chinese Reference for All Keys

#### CRITICAL PRIORITY (User Input Labels)

| English Key | English | 中文 |
|--|--|--|
| admin.variant-name | Variant Name | 变体名称 |
| admin.variant-min-select | Min Select | 最小选择 |
| admin.variant-max-select | Max Select | 最大选择 |
| admin.option-name | Option Name | 选项名称 |
| admin.clock-in | Clock In | 打卡进 |
| admin.clock-out | Clock Out | 打卡出 |
| admin.confirm-delete-staff | Delete this staff member? | 删除此员工吗？ |
| admin.cart-is-empty | Cart is empty | 购物车为空 |

#### HIGH PRIORITY (Status & Feedback)

| English Key | English | 中文 |
|--|--|--|
| admin.add-to-table | Add to Table | 添加到餐桌 |
| admin.order-now | Order Now | 立即订购 |
| admin.to-go | To Go | 外卖 |
| admin.variant-required | Required | 必需 |
| admin.variant-options | Options | 选项 |
| admin.status-label | Status | 状态 |
| admin.detail-role | Role | 角色 |
| admin.detail-pin | PIN | PIN号 |

#### MEDIUM PRIORITY (Helper Text & Buttons)

| English Key | English | 中文 |
|--|--|--|
| admin.add-variant | Add Variant | 添加变体 |
| admin.variant-form-title | Add/Edit Variant | 添加/编辑变体 |
| admin.variant-name-placeholder | e.g., Size, Extras | 例如：大小、配料 |
| admin.add-option | Add Option | 添加选项 |
| admin.add-option-title | Add Option | 添加选项 |
| admin.option-name-placeholder | e.g., Small, Extra Cheese | 例如：小、额外奶酪 |
| admin.option-price-label | Price (cents) - optional | 价格（美分）- 可选 |
| admin.save-option | Save | 保存 |
| admin.cancel-option | Cancel | 取消 |
| admin.save-variant | Save Variant | 保存变体 |
| admin.cancel-variant | Cancel | 取消 |
| admin.modal-session-total | Total | 总计 |
| admin.staff-name-placeholder | e.g., John Smith | 例如：John Smith |
| admin.pin-placeholder | e.g., 123456 | 例如：123456 |
| admin.hourly-rate-placeholder | e.g., 15.50 | 例如：15.50 |
| admin.detail-hourly-rate | Hourly Rate | 小时工资 |
| admin.detail-status | Status | 状态 |
| admin.clock-section-title | Clock In/Out | 打卡进/出 |
| admin.work-hours-title | Work Hours (Last 30 Days) | 工作时间（过去30天） |
| admin.days-worked | Days Worked | 工作天数 |
| admin.total-hours | Total Hours | 总时数 |
| admin.work-log-title | Work Log (Last 30 Days) | 工作日志（过去30天） |
| admin.edit-staff | Edit Staff | 编辑员工 |
| admin.delete-staff | Delete Staff | 删除员工 |
| admin.coupon-code-placeholder | e.g., SUMMER20 | 例如：SUMMER20 |
| admin.discount-value-placeholder | e.g., 20 | 例如：20 |
| admin.min-order-value-placeholder | e.g., 50 | 例如：50 |
| admin.max-uses-placeholder | e.g., 100 | 例如：100 |
| admin.coupon-desc-placeholder | e.g., Summer special - 20% off all items | 例如：夏季特价 - 所有商品8折 |

---

## HTML CHANGES REQUIRED

### admin-orders.html

**Issue 1: Line 67 - Wrong translation key for "Cart is empty"**
```html
<!-- BEFORE -->
<p data-i18n="admin.loading">Cart is empty</p>

<!-- AFTER -->
<p data-i18n="admin.cart-is-empty">Cart is empty</p>
```

**Issue 2: Line 77 - Missing translation for "Status:" label**
```html
<!-- BEFORE -->
<div id="order-status-display">
  <span>Status: </span>
  <span id="order-status-value"></span>
</div>

<!-- AFTER -->
<div id="order-status-display">
  <span data-i18n="admin.status-label">Status:</span>
  <span id="order-status-value"></span>
</div>
```

### admin-menu.html

**Issue 1: Lines 62-64 - Food panel edit/save/cancel buttons**
```html
<!-- BEFORE -->
<button id="food-panel-edit-btn" class="btn-secondary" onclick="toggleFoodItemEdit()"><img src="/uploads/website/pencil.png" alt="edit" style="width: 16px; height: 16px; vertical-align: middle;"> Edit</button>
<button id="food-panel-save-btn" class="btn-primary" onclick="saveFoodItemEdit()" style="display: none; margin-left: 8px;">✓ Save</button>
<button id="food-panel-cancel-btn" class="btn-secondary" onclick="cancelFoodItemEdit()" style="display: none; margin-left: 8px;">✕ Cancel</button>

<!-- AFTER -->
<button id="food-panel-edit-btn" class="btn-secondary" onclick="toggleFoodItemEdit()" data-i18n="admin.edit"><img src="/uploads/website/pencil.png" alt="edit" style="width: 16px; height: 16px; vertical-align: middle;"> Edit</button>
<button id="food-panel-save-btn" class="btn-primary" onclick="saveFoodItemEdit()" data-i18n="admin.save" style="display: none; margin-left: 8px;">✓ Save</button>
<button id="food-panel-cancel-btn" class="btn-secondary" onclick="cancelFoodItemEdit()" data-i18n="admin.cancel" style="display: none; margin-left: 8px;">✕ Cancel</button>
```

**Issue 2: Line 77 - Add variant button**
```html
<!-- BEFORE -->
<button id="food-panel-add-variant-btn" onclick="startAddVariantFromPanel()" style="display: none; padding: 4px 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">+ Add</button>

<!-- AFTER -->
<button id="food-panel-add-variant-btn" onclick="startAddVariantFromPanel()" data-i18n="admin.add-variant" style="display: none; padding: 4px 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">+ Add</button>
```

**Issues 3-14: Lines 82-125 - Entire variant form section needs i18n**
```html
<!-- BEFORE -->
<div id="food-panel-variant-form" style="display: none; margin-top: 16px; padding: 12px; background: #f9f9f9; border-radius: 6px; border: 1px solid #ddd;">
  <h4 style="margin-top: 0;">Add/Edit Variant</h4>
  <div style="display: flex; flex-direction: column; gap: 8px;">
    <div>
      <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px;">Variant Name</label>
      <input id="food-panel-variant-name" type="text" placeholder="e.g., Size, Extras" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;" />
    </div>
    <div style="display: flex; gap: 8px;">
      <div style="flex: 1;">
        <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px;">Min Select</label>
        <input id="food-panel-variant-min" type="number" min="0" placeholder="0" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;" />
      </div>
      <div style="flex: 1;">
        <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px;">Max Select</label>
        <input id="food-panel-variant-max" type="number" min="0" placeholder="0" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;" />
      </div>
    </div>
    <div>
      <label style="display: flex; align-items: center; font-size: 12px;">
        <input id="food-panel-variant-required" type="checkbox" style="margin-right: 6px;" />
        <span>Required</span>
      </label>
    </div>
    <!-- Variant Options Section -->
    <div id="food-panel-variant-options-section" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <label style="font-size: 12px; font-weight: 500;">Options</label>
        <button onclick="startAddVariantOption()" style="padding: 2px 8px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">+ Add Option</button>
      </div>
      ...

<!-- AFTER -->
<div id="food-panel-variant-form" style="display: none; margin-top: 16px; padding: 12px; background: #f9f9f9; border-radius: 6px; border: 1px solid #ddd;">
  <h4 data-i18n="admin.variant-form-title" style="margin-top: 0;">Add/Edit Variant</h4>
  <div style="display: flex; flex-direction: column; gap: 8px;">
    <div>
      <label data-i18n="admin.variant-name" style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px;">Variant Name</label>
      <input id="food-panel-variant-name" type="text" data-i18n="admin.variant-name-placeholder" placeholder="e.g., Size, Extras" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;" />
    </div>
    <div style="display: flex; gap: 8px;">
      <div style="flex: 1;">
        <label data-i18n="admin.variant-min-select" style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px;">Min Select</label>
        <input id="food-panel-variant-min" type="number" min="0" placeholder="0" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;" />
      </div>
      <div style="flex: 1;">
        <label data-i18n="admin.variant-max-select" style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px;">Max Select</label>
        <input id="food-panel-variant-max" type="number" min="0" placeholder="0" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;" />
      </div>
    </div>
    <div>
      <label style="display: flex; align-items: center; font-size: 12px;">
        <input id="food-panel-variant-required" type="checkbox" style="margin-right: 6px;" />
        <span data-i18n="admin.variant-required">Required</span>
      </label>
    </div>
    <!-- Variant Options Section -->
    <div id="food-panel-variant-options-section" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <label data-i18n="admin.variant-options" style="font-size: 12px; font-weight: 500;">Options</label>
        <button onclick="startAddVariantOption()" data-i18n="admin.add-option" style="padding: 2px 8px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">+ Add Option</button>
      </div>
      ...

      <!-- Add Option Form -->
      <div id="food-panel-variant-option-form" style="display: none; margin-top: 8px; padding: 8px; background: #fff; border: 1px solid #ddd; border-radius: 4px;">
        <h5 data-i18n="admin.add-option-title" style="margin: 0 0 8px 0; font-size: 12px;">Add Option</h5>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div>
            <label data-i18n="admin.option-name" style="display: block; font-size: 11px; font-weight: 500; margin-bottom: 2px;">Option Name</label>
            <input id="food-panel-option-name" type="text" data-i18n="admin.option-name-placeholder" placeholder="e.g., Small, Extra Cheese" style="width: 100%; padding: 4px; border: 1px solid #ddd; border-radius: 3px; font-size: 11px;" />
          </div>
          <div>
            <label data-i18n="admin.option-price-label" style="display: block; font-size: 11px; font-weight: 500; margin-bottom: 2px;">Price (cents) - optional</label>
            <input id="food-panel-option-price" type="number" placeholder="0" style="width: 100%; padding: 4px; border: 1px solid #ddd; border-radius: 3px; font-size: 11px;" />
          </div>
          <div style="display: flex; gap: 4px;">
            <button onclick="saveVariantOption()" data-i18n="admin.save-option" style="flex: 1; padding: 4px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">Save</button>
            <button onclick="cancelVariantOptionForm()" data-i18n="admin.cancel-option" style="flex: 1; padding: 4px; background: #999; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <div style="display: flex; gap: 6px;">
      <button onclick="if (currentEditingVariantId) saveEditedVariantFromPanel(); else saveNewVariantFromPanel();" data-i18n="admin.save-variant" style="flex: 1; padding: 6px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Save Variant</button>
      <button onclick="cancelVariantForm()" data-i18n="admin.cancel-variant" style="flex: 1; padding: 6px; background: #999; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Cancel</button>
    </div>
  </div>
</div>
```

### admin-tables.html

**Issue 1: Line 35 - Modal session total**
```html
<!-- BEFORE -->
<div id="modal-session-total" class="modal-session-total">
  Total: —
</div>

<!-- AFTER -->
<div id="modal-session-total" class="modal-session-total">
  <span data-i18n="admin.modal-session-total">Total:</span> —
</div>
```

### admin-staff.html

**(Many changes - see detailed HTML sections below)**

**Issue 1: Lines 8-9 - Error/Success messages (marked but dynamic)**

These containers have IDs but content is set dynamically by JS. Mark containers with role for accessibility:

```html
<!-- BEFORE -->
<div id="staff-error" class="error-message" style="display: none;"></div>
<div id="staff-success" class="success-message" style="display: none;"></div>

<!-- AFTER -->
<div id="staff-error" class="error-message" role="alert" style="display: none;"></div>
<div id="staff-success" class="success-message" role="status" style="display: none;"></div>
```

**Issue 2: Lines 13, 16, 23 - Form placeholders**
```html
<!--BEFORE -->
<input id="staff-name" placeholder="e.g., John Smith" required />
<input id="staff-pin" type="text" placeholder="e.g., 123456" maxlength="6" required />
<input id="staff-hourly-rate" type="number" placeholder="e.g., 15.50" step="0.01" min="0" />

<!-- AFTER -->
<input id="staff-name" data-i18n="admin.staff-name-placeholder" placeholder="e.g., John Smith" required />
<input id="staff-pin" type="text" data-i18n="admin.pin-placeholder" placeholder="e.g., 123456" maxlength="6" required />
<input id="staff-hourly-rate" type="number" data-i18n="admin.hourly-rate-placeholder" placeholder="e.g., 15.50" step="0.01" min="0" />
```

**Issue 3: Lines 76-88 - Modal info section labels**
```html
<!-- BEFORE -->
<label style="font-size: 12px; color: #666; font-weight: 500; text-transform: uppercase;">Role</label>
...
<label style="font-size: 12px; color: #666; font-weight: 500; text-transform: uppercase;">PIN</label>
...
<label style="font-size: 12px; color: #666; font-weight: 500; text-transform: uppercase;">Hourly Rate</label>
...
<label style="font-size: 12px; color: #666; font-weight: 500; text-transform: uppercase;">Status</label>

<!-- AFTER -->
<label data-i18n="admin.detail-role" style="font-size: 12px; color: #666; font-weight: 500; text-transform: uppercase;">Role</label>
...
<label data-i18n="admin.detail-pin" style="font-size: 12px; color: #666; font-weight: 500; text-transform: uppercase;">PIN</label>
...
<label data-i18n="admin.detail-hourly-rate" style="font-size: 12px; color: #666; font-weight: 500; text-transform: uppercase;">Hourly Rate</label>
...
<label data-i18n="admin.detail-status" style="font-size: 12px; color: #666; font-weight: 500; text-transform: uppercase;">Status</label>
```

**Issue 4: Lines 91-102 - Clock In/Out section**
```html
<!-- BEFORE -->
<h3 style="margin: 0 0 15px 0; font-size: 16px;">Clock In/Out</h3>
<button id="staff-clock-in-btn" onclick="clockInStaff()" class="btn-primary" style="flex: 1; padding: 12px;">
  ▶ Clock In
</button>
<button id="staff-clock-out-btn" onclick="clockOutStaff()" class="btn-danger" style="flex: 1; padding: 12px; display: none;">
  ⏹ Clock Out
</button>

<!-- AFTER -->
<h3 data-i18n="admin.clock-section-title" style="margin: 0 0 15px 0; font-size: 16px;">Clock In/Out</h3>
<button id="staff-clock-in-btn" onclick="clockInStaff()" data-i18n="admin.clock-in" class="btn-primary" style="flex: 1; padding: 12px;">
  ▶ Clock In
</button>
<button id="staff-clock-out-btn" onclick="clockOutStaff()" data-i18n="admin.clock-out" class="btn-danger" style="flex: 1; padding: 12px; display: none;">
  ⏹ Clock Out
</button>
```

**Issue 5: Lines 105-120 - Work hours and log section**
```html
<!-- BEFORE -->
<h3 style="margin: 0 0 15px 0; font-size: 16px;">Work Hours (Last 30 Days)</h3>
<label style="font-size: 12px; color: #666; font-weight: 500; text-transform: uppercase;">Days Worked</label>
...
<label style="font-size: 12px; color: #666; font-weight: 500; text-transform: uppercase;">Total Hours</label>
...
<h3 style="margin: 0 0 15px 0; font-size: 16px;">Work Log (Last 30 Days)</h3>

<!-- AFTER -->
<h3 data-i18n="admin.work-hours-title" style="margin: 0 0 15px 0; font-size: 16px;">Work Hours (Last 30 Days)</h3>
<label data-i18n="admin.days-worked" style="font-size: 12px; color: #666; font-weight: 500; text-transform: uppercase;">Days Worked</label>
...
<label data-i18n="admin.total-hours" style="font-size: 12px; color: #666; font-weight: 500; text-transform: uppercase;">Total Hours</label>
...
<h3 data-i18n="admin.work-log-title" style="margin: 0 0 15px 0; font-size: 16px;">Work Log (Last 30 Days)</h3>
```

**Issue 6: Lines 125-126 - Modal action buttons**
```html
<!-- BEFORE -->
<button onclick="if(CURRENT_STAFF_ID) { const id = CURRENT_STAFF_ID; closeStaffDetailModal(); editStaff(id); }" class="btn-secondary" style="flex: 1; min-width: 120px;">✏️ Edit Staff</button>
<button onclick="if(CURRENT_STAFF_ID && confirm('Delete this staff member?')) { const id = CURRENT_STAFF_ID; closeStaffDetailModal(); deleteStaff(id); }" class="btn-danger" style="flex: 1; min-width: 120px;">🗑️ Delete Staff</button>

<!-- AFTER -->
<button onclick="if(CURRENT_STAFF_ID) { const id = CURRENT_STAFF_ID; closeStaffDetailModal(); editStaff(id); }" data-i18n="admin.edit-staff" class="btn-secondary" style="flex: 1; min-width: 120px;">✏️ Edit Staff</button>
<button onclick="if(CURRENT_STAFF_ID && confirm(getTranslation('admin.confirm-delete-staff'))) { const id = CURRENT_STAFF_ID; closeStaffDetailModal(); deleteStaff(id); }" data-i18n="admin.delete-staff" class="btn-danger" style="flex: 1; min-width: 120px;">🗑️ Delete Staff</button>
```

### admin-coupons.html

**Issue 1: Lines 12, 21, 24, 28, 35 - Placeholders**
```html
<!-- BEFORE -->
<input id="new-coupon-code" placeholder="e.g., SUMMER20" maxlength="50" style="text-transform: uppercase;" />
<input id="new-coupon-value" type="number" placeholder="e.g., 20" step="0.01" />
<input id="new-coupon-min-order" type="number" placeholder="e.g., 50" step="0.01" value="0" />
<input id="new-coupon-max-uses" type="number" placeholder="e.g., 100" />
<textarea id="new-coupon-description" placeholder="e.g., Summer special - 20% off all items"></textarea>

<!-- AFTER -->
<input id="new-coupon-code" data-i18n="admin.coupon-code-placeholder" placeholder="e.g., SUMMER20" maxlength="50" style="text-transform: uppercase;" />
<input id="new-coupon-value" type="number" data-i18n="admin.discount-value-placeholder" placeholder="e.g., 20" step="0.01" />
<input id="new-coupon-min-order" type="number" data-i18n="admin.min-order-value-placeholder" placeholder="e.g., 50" step="0.01" value="0" />
<input id="new-coupon-max-uses" type="number" data-i18n="admin.max-uses-placeholder" placeholder="e.g., 100" />
<textarea id="new-coupon-description" data-i18n="admin.coupon-desc-placeholder" placeholder="e.g., Summer special - 20% off all items"></textarea>
```

---

## TRANSLATIONS.JS CHANGES REQUIRED

Add to the `en` section of translations.js:

```javascript
// === NEW TRANSLATION KEYS FOR ADMIN TABS ===

// Menu Management - Variants (11 keys)
'admin.add-variant': 'Add Variant',
'admin.variant-form-title': 'Add/Edit Variant',
'admin.variant-name': 'Variant Name',
'admin.variant-name-placeholder': 'e.g., Size, Extras',
'admin.variant-min-select': 'Min Select',
'admin.variant-max-select': 'Max Select',
'admin.variant-required': 'Required',
'admin.variant-options': 'Options',
'admin.add-option': 'Add Option',
'admin.add-option-title': 'Add Option',

// Menu Management - Variant Options (6 keys)
'admin.option-name': 'Option Name',
'admin.option-name-placeholder': 'e.g., Small, Extra Cheese',
'admin.option-price-label': 'Price (cents) - optional',
'admin.save-option': 'Save',
'admin.cancel-option': 'Cancel',
'admin.save-variant': 'Save Variant',

// Order Management (1 key)
'admin.cart-is-empty': 'Cart is empty',
'admin.status-label': 'Status',

// Tables (1 key)
'admin.modal-session-total': 'Total',

// Staff Management - Form (3 keys)
'admin.staff-name-placeholder': 'e.g., John Smith',
'admin.pin-placeholder': 'e.g., 123456',
'admin.hourly-rate-placeholder': 'e.g., 15.50',

// Staff Management - Modal (4 keys)
'admin.detail-role': 'Role',
'admin.detail-pin': 'PIN',
'admin.detail-hourly-rate': 'Hourly Rate',
'admin.detail-status': 'Status',

// Staff Management - Clock & Work (7 keys)
'admin.clock-section-title': 'Clock In/Out',
'admin.clock-in': 'Clock In',
'admin.clock-out': 'Clock Out',
'admin.work-hours-title': 'Work Hours (Last 30 Days)',
'admin.days-worked': 'Days Worked',
'admin.total-hours': 'Total Hours',
'admin.work-log-title': 'Work Log (Last 30 Days)',

// Staff Management - Actions (3 keys)
'admin.edit-staff': 'Edit Staff',
'admin.delete-staff': 'Delete Staff',
'admin.confirm-delete-staff': 'Delete this staff member?',

// Coupons (5 keys)
'admin.coupon-code-placeholder': 'e.g., SUMMER20',
'admin.discount-value-placeholder': 'e.g., 20',
'admin.min-order-value-placeholder': 'e.g., 50',
'admin.max-uses-placeholder': 'e.g., 100',
'admin.coupon-desc-placeholder': 'e.g., Summer special - 20% off all items',
```

Add to the `zh` section of translations.js (after the `en` section block):

```javascript
zh: {
    // === EXISTING KEYS NOW WITH CHINESE ===
    
    // --- Orders Tab ---
    'admin.order-history': '订单历史',
    'admin.loading': '加载中...',
    'admin.cart': '购物车',
    'admin.cart-is-empty': '购物车为空',
    'admin.edit': '编辑',
    'admin.total': '总计',
    'admin.add-to-table': '添加到餐桌',
    'admin.order-now': '立即订购',
    'admin.to-go': '外卖',
    'admin.select-table': '选择餐桌',
    'admin.select-table-placeholder': '-- 选择一张餐桌 --',
    'admin.submit-order': '提交订单',
    'admin.order-header': '订单详情',
    'admin.back': '← 返回',
    'admin.select-an-order': '选择一个订单查看详情',
    'admin.status-label': '状态',

    // --- Menu Tab ---
    'admin.add-menu-item': '添加菜单项',
    'admin.item-name': '项目名称',
    'admin.item-name-placeholder': '例如：凯撒沙拉',
    'admin.price-cents': '价格（美分）',
    'admin.price-placeholder': '例如：1200',
    'admin.category': '类别',
    'admin.select-category': '-- 选择一个类别 --',
    'admin.description': '描述',
    'admin.description-placeholder': '添加菜单项的详细描述...',
    'admin.item-image': '食品图片',
    'admin.recommended-size': '（推荐：400px × 300px）',
    'admin.upload-image': '📸 点击上传图片',
    'admin.create-item': '✓ 创建项目',
    'admin.cancel-item': '✕ 取消',
    'admin.price': '价格',
    'admin.variants': '变体',
    'admin.add-variant': '添加变体',
    'admin.variant-form-title': '添加/编辑变体',
    'admin.variant-name': '变体名称',
    'admin.variant-name-placeholder': '例如：大小、配料',
    'admin.variant-min-select': '最小选择',
    'admin.variant-max-select': '最大选择',
    'admin.variant-required': '必需',
    'admin.variant-options': '选项',
    'admin.add-option': '添加选项',
    'admin.add-option-title': '添加选项',
    'admin.option-name': '选项名称',
    'admin.option-name-placeholder': '例如：小、额外奶酪',
    'admin.option-price-label': '价格（美分）- 可选',
    'admin.save-option': '保存',
    'admin.cancel-option': '取消',
    'admin.save-variant': '保存变体',
    'admin.cancel-variant': '取消',

    // --- Tables Tab ---
    'admin.select-session': '选择一个会话以查看订单',
    'admin.view-orders': '📖 查看完整订单',
    'admin.close-bill': '💰 结账',
    'admin.all-orders': '📋 所有订单',
    'admin.close': '关闭',
    'admin.modal-session-total': '总计',

    // --- Staff Tab ---
    'admin.create-new-staff': '创建/编辑员工',
    'admin.staff-name': '员工名称',
    'admin.staff-name-placeholder': '例如：John Smith',
    'admin.pin-6digits': 'PIN码（6位数）',
    'admin.pin-placeholder': '例如：123456',
    'admin.role': '角色',
    'admin.staff-role': '员工',
    'admin.kitchen-role': '厨房',
    'admin.hourly-rate': '时薪（$/小时）',
    'admin.hourly-rate-placeholder': '例如：15.50',
    'admin.access-rights': '访问权限',
    'admin.access-orders': '订单',
    'admin.access-tables': '餐桌',
    'admin.access-menu': '菜单',
    'admin.access-staff': '员工',
    'admin.access-settings': '设置',
    'admin.access-bookings': '预订',
    'admin.allowed-categories': '允许的食品类别',
    'admin.add-staff': '➕ 添加员工',
    'admin.cancel': '取消',
    'admin.detail-role': '角色',
    'admin.detail-pin': 'PIN码',
    'admin.detail-hourly-rate': '时薪',
    'admin.detail-status': '状态',
    'admin.clock-section-title': '打卡进/出',
    'admin.clock-in': '▶ 打卡进',
    'admin.clock-out': '⏹ 打卡出',
    'admin.work-hours-title': '工作时间（过去30天）',
    'admin.days-worked': '工作天数',
    'admin.total-hours': '总时数',
    'admin.work-log-title': '工作日志（过去30天）',
    'admin.edit-staff': '✏️ 编辑员工',
    'admin.delete-staff': '🗑️ 删除员工',
    'admin.confirm-delete-staff': '删除此员工吗？',

    // --- Coupons Tab ---
    'admin.coupons-title': '🎫 优惠券和折扣',
    'admin.create-coupon': '创建新优惠券',
    'admin.coupon-code': '优惠券代码',
    'admin.coupon-code-placeholder': '例如：SUMMER20',
    'admin.discount-type': '折扣类型',
    'admin.percentage': '百分比（%）',
    'admin.fixed-amount': '固定金额（$）',
    'admin.discount-value': '折扣值',
    'admin.discount-value-placeholder': '例如：20',
    'admin.min-order-value': '最小订单金额（$）',
    'admin.min-order-value-placeholder': '例如：50',
    'admin.max-uses': '最大用途',
    'admin.unlimited': '（留空表示无限制）',
    'admin.max-uses-placeholder': '例如：100',
    'admin.valid-until': '有效期至',
    'admin.coupon-desc': '描述',
    'admin.coupon-desc-placeholder': '例如：夏季特价 - 所有商品8折',
    'admin.create': '➕ 创建',

    // ... rest of Chinese translations ...
}
```

---

## VALIDATION CHECKLIST

After implementation, verify:

- [ ] All 48 `data-i18n` attributes added to HTML files
- [ ] All 43 new translation keys added to `translations.js` in `en` section
- [ ] All 46 existing keys now have Chinese translations
- [ ] No hardcoded text visible in admin UI forno test with browser/dev tools
- [ ] English mode displays English text correctly (via `data-i18n` attributes)
- [ ] Chinese mode displays Chinese text correctly
- [ ] Placeholder text updates when language is switched
- [ ] Form labels all translate properly
- [ ] Button text all translates properly
- [ ] Confirmation dialogs use `getTranslation()` function
- [ ] Modal headers and footer text translate
- [ ] Table/order/staff status indicators translate

---

## Testing Steps

1. **Browser DevTools**: Open any admin tab, set `localStorage.setItem('language', 'en')` then `localStorage.setItem('language', 'zh')`, refresh
2. **Visual Inspection**: All UI elements should switch between English and Chinese
3. **Form Submission**: Placeholders should translate, submit forms to ensure functionality works with translations
4. **Modal**: Open staff detail modal, verify all labels translate
5. **Clock In/Out**: Test with both languages
6. **Variant Creation**: Test full variant form creation in both languages

