# ADMIN TABS TRANSLATION - IMPLEMENTATION TRACKING CHECKLIST

**Start Date:** [ ] | **Target Completion:** [ ]  
**Assigned To:** [ ] | **Status:** Not Started

---

## PHASE 1: CRITICAL FIXES (30 min)

### admin-orders.html
- [ ] **Line 67**: Fix "Cart is empty" key reuse
  - [ ] Change from `data-i18n="admin.loading"` to `data-i18n="admin.cart-is-empty"`
  - [ ] Verify placeholder text displays correctly
  - Status: _____________ | Completed by: _____________ | Date: _______

- [ ] **Line 77**: Add "Status:" label i18n
  - [ ] Wrap text in `<span data-i18n="admin.status-label">Status:</span>`
  - [ ] Verify label translates in both languages
  - Status: _____________ | Completed by: _____________ | Date: _______

---

## PHASE 2: HTML ATTRIBUTE ADDITIONS (45 min)

### admin-menu.html (15 attributes)

#### Edit/Save/Cancel Buttons (Lines 62-64)
- [ ] **Line 62**: Add `data-i18n="admin.edit"` to edit button
  - Code: `<button id="food-panel-edit-btn" ... data-i18n="admin.edit" ...>Edit</button>`
  - Status: _____________ | Date: _______

- [ ] **Line 63**: Add `data-i18n="admin.save"` to save button
  - Code: `<button id="food-panel-save-btn" ... data-i18n="admin.save" ...>✓ Save</button>`
  - Status: _____________ | Date: _______

- [ ] **Line 64**: Add `data-i18n="admin.cancel"` to cancel button
  - Code: `<button id="food-panel-cancel-btn" ... data-i18n="admin.cancel" ...>✕ Cancel</button>`
  - Status: _____________ | Date: _______

#### Add Variant Button (Line 77)
- [ ] **Line 77**: Add `data-i18n="admin.add-variant"` to + Add button
  - Code: `<button id="food-panel-add-variant-btn" ... data-i18n="admin.add-variant" ...>+ Add</button>`
  - Status: _____________ | Date: _______

#### Variant Form Elements (Lines 82-125)

**Variant Form Header & Labels:**
- [ ] **Line 82**: Add `data-i18n="admin.variant-form-title"` to h4
  - Status: _____________ | Date: _______

- [ ] **Line 84**: Add `data-i18n="admin.variant-name"` to label
  - Status: _____________ | Date: _______

- [ ] **Line 85**: Add `data-i18n="admin.variant-name-placeholder"` to input
  - Status: _____________ | Date: _______

- [ ] **Line 87**: Add `data-i18n="admin.variant-min-select"` to label
  - Status: _____________ | Date: _______

- [ ] **Line 91**: Add `data-i18n="admin.variant-max-select"` to label
  - Status: _____________ | Date: _______

- [ ] **Line 96**: Add `data-i18n="admin.variant-required"` to span
  - Status: _____________ | Date: _______

- [ ] **Line 100**: Add `data-i18n="admin.variant-options"` to label
  - Status: _____________ | Date: _______

- [ ] **Line 101**: Add `data-i18n="admin.add-option"` to button
  - Status: _____________ | Date: _______

**Add Option Form:**
- [ ] **Line 110**: Add `data-i18n="admin.add-option-title"` to h5
  - Status: _____________ | Date: _______

- [ ] **Line 112**: Add `data-i18n="admin.option-name"` to label
  - Status: _____________ | Date: _______

- [ ] **Line 113**: Add `data-i18n="admin.option-name-placeholder"` to input
  - Status: _____________ | Date: _______

- [ ] **Line 115**: Add `data-i18n="admin.option-price-label"` to label
  - Status: _____________ | Date: _______

- [ ] **Line 117**: Add `data-i18n="admin.save-option"` to Save button
  - Status: _____________ | Date: _______

- [ ] **Line 118**: Add `data-i18n="admin.cancel-option"` to Cancel button
  - Status: _____________ | Date: _______

- [ ] **Line 122**: Add `data-i18n="admin.save-variant"` to Save Variant button
  - Status: _____________ | Date: _______

- [ ] **Line 123**: Add `data-i18n="admin.cancel-variant"` to Cancel button (variant form)
  - Status: _____________ | Date: _______

**Verification**: [ ] All attributes added and HTML saves without errors

---

### admin-staff.html (20 attributes)

#### Form Placeholders (Lines 13, 16, 23)
- [ ] **Line 13**: Add `data-i18n="admin.staff-name-placeholder"` to staff name input
  - Status: _____________ | Date: _______

- [ ] **Line 16**: Add `data-i18n="admin.pin-placeholder"` to PIN input
  - Status: _____________ | Date: _______

- [ ] **Line 23**: Add `data-i18n="admin.hourly-rate-placeholder"` to hourly rate input
  - Status: _____________ | Date: _______

#### Modal Info Section (Lines 76-88)
- [ ] **Line 76**: Add `data-i18n="admin.detail-role"` to Role label
  - Status: _____________ | Date: _______

- [ ] **Line 80**: Add `data-i18n="admin.detail-pin"` to PIN label
  - Status: _____________ | Date: _______

- [ ] **Line 84**: Add `data-i18n="admin.detail-hourly-rate"` to Hourly Rate label
  - Status: _____________ | Date: _______

- [ ] **Line 88**: Add `data-i18n="admin.detail-status"` to Status label
  - Status: _____________ | Date: _______

#### Clock In/Out Section (Lines 91-102)
- [ ] **Line 94**: Add `data-i18n="admin.clock-section-title"` to h3
  - Status: _____________ | Date: _______

- [ ] **Line 96**: Add `data-i18n="admin.clock-in"` to Clock In button
  - Status: _____________ | Date: _______

- [ ] **Line 99**: Add `data-i18n="admin.clock-out"` to Clock Out button
  - Status: _____________ | Date: _______

#### Work Hours Section (Lines 106-120)
- [ ] **Line 106**: Add `data-i18n="admin.work-hours-title"` to h3
  - Status: _____________ | Date: _______

- [ ] **Line 108**: Add `data-i18n="admin.days-worked"` to Days Worked label
  - Status: _____________ | Date: _______

- [ ] **Line 112**: Add `data-i18n="admin.total-hours"` to Total Hours label
  - Status: _____________ | Date: _______

- [ ] **Line 117**: Add `data-i18n="admin.work-log-title"` to h3
  - Status: _____________ | Date: _______

#### Modal Action Buttons (Lines 125-126)
- [ ] **Line 125**: Add `data-i18n="admin.edit-staff"` to Edit Staff button
  - Status: _____________ | Date: _______

- [ ] **Line 126**: Add `data-i18n="admin.delete-staff"` to Delete Staff button
  - Status: _____________ | Date: _______

- [ ] **Line 126**: Update confirm dialog to use `getTranslation('admin.confirm-delete-staff')`
  - Old: `confirm('Delete this staff member?')`
  - New: `confirm(getTranslation('admin.confirm-delete-staff'))`
  - Status: _____________ | Date: _______

**Verification**: [ ] All 20 attributes added, no syntax errors

---

### admin-tables.html (1 attribute)

- [ ] **Line 35**: Add `data-i18n="admin.modal-session-total"` wrapper to session total
  - Code: `<span data-i18n="admin.modal-session-total">Total:</span> —`
  - Status: _____________ | Date: _______

**Verification**: [ ] Modal total displays correctly

---

### admin-coupons.html (6 attributes)

- [ ] **Line 12**: Add `data-i18n="admin.coupon-code-placeholder"` to coupon code input
  - Status: _____________ | Date: _______

- [ ] **Line 21**: Add `data-i18n="admin.discount-value-placeholder"` to discount value input
  - Status: _____________ | Date: _______

- [ ] **Line 24**: Add `data-i18n="admin.min-order-value-placeholder"` to min order input
  - Status: _____________ | Date: _______

- [ ] **Line 28**: Add `data-i18n="admin.max-uses-placeholder"` to max uses input
  - Status: _____________ | Date: _______

- [ ] **Line 35**: Add `data-i18n="admin.coupon-desc-placeholder"` to description textarea
  - Status: _____________ | Date: _______

**Verification**: [ ] All 6 placeholders added

---

## PHASE 3: ADD ENGLISH TRANSLATION KEYS (30 min)

### translations.js → English Section

**Status**: [ ] All keys added with correct English text

Add to `en:` section:

#### Menu Variants (11 keys)
- [ ] `'admin.add-variant': 'Add Variant',`
- [ ] `'admin.variant-form-title': 'Add/Edit Variant',`
- [ ] `'admin.variant-name': 'Variant Name',`
- [ ] `'admin.variant-name-placeholder': 'e.g., Size, Extras',`
- [ ] `'admin.variant-min-select': 'Min Select',`
- [ ] `'admin.variant-max-select': 'Max Select',`
- [ ] `'admin.variant-required': 'Required',`
- [ ] `'admin.variant-options': 'Options',`
- [ ] `'admin.add-option': 'Add Option',`
- [ ] `'admin.add-option-title': 'Add Option',`
- [ ] `'admin.option-name': 'Option Name',`

#### Menu Variant Options (6 keys)
- [ ] `'admin.option-name-placeholder': 'e.g., Small, Extra Cheese',`
- [ ] `'admin.option-price-label': 'Price (cents) - optional',`
- [ ] `'admin.save-option': 'Save',`
- [ ] `'admin.cancel-option': 'Cancel',`
- [ ] `'admin.save-variant': 'Save Variant',`
- [ ] `'admin.cancel-variant': 'Cancel',`

#### General Fixes (2 keys)
- [ ] `'admin.cart-is-empty': 'Cart is empty',`
- [ ] `'admin.status-label': 'Status',`

#### Tables (1 key)
- [ ] `'admin.modal-session-total': 'Total',`

#### Staff Form (3 keys)
- [ ] `'admin.staff-name-placeholder': 'e.g., John Smith',`
- [ ] `'admin.pin-placeholder': 'e.g., 123456',`
- [ ] `'admin.hourly-rate-placeholder': 'e.g., 15.50',`

#### Staff Modal (4 keys)
- [ ] `'admin.detail-role': 'Role',`
- [ ] `'admin.detail-pin': 'PIN',`
- [ ] `'admin.detail-hourly-rate': 'Hourly Rate',`
- [ ] `'admin.detail-status': 'Status',`

#### Staff Clock & Work (7 keys)
- [ ] `'admin.clock-section-title': 'Clock In/Out',`
- [ ] `'admin.clock-in': 'Clock In',`
- [ ] `'admin.clock-out': 'Clock Out',`
- [ ] `'admin.work-hours-title': 'Work Hours (Last 30 Days)',`
- [ ] `'admin.days-worked': 'Days Worked',`
- [ ] `'admin.total-hours': 'Total Hours',`
- [ ] `'admin.work-log-title': 'Work Log (Last 30 Days)',`

#### Staff Actions (3 keys)
- [ ] `'admin.edit-staff': 'Edit Staff',`
- [ ] `'admin.delete-staff': 'Delete Staff',`
- [ ] `'admin.confirm-delete-staff': 'Delete this staff member?',`

#### Coupons (5 keys)
- [ ] `'admin.coupon-code-placeholder': 'e.g., SUMMER20',`
- [ ] `'admin.discount-value-placeholder': 'e.g., 20',`
- [ ] `'admin.min-order-value-placeholder': 'e.g., 50',`
- [ ] `'admin.max-uses-placeholder': 'e.g., 100',`
- [ ] `'admin.coupon-desc-placeholder': 'e.g., Summer special - 20% off all items',`

**Verification**: [ ] All 43 keys added with exact English text | Date: _______

---

## PHASE 4: ADD CHINESE TRANSLATIONS (30 min)

### translations.js → Chinese (zh) Section

**Status**: [ ] All Chinese translations added with correct values

#### Existing Keys - Add Chinese (46 keys)

**Orders Tab** (14 keys):
- [ ] `'admin.order-history': '订单历史',`
- [ ] `'admin.loading': '加载中...',`
- [ ] `'admin.cart': '购物车',`
- [ ] `'admin.edit': '编辑',`
- [ ] `'admin.total': '总计',`
- [ ] `'admin.add-to-table': '添加到餐桌',`
- [ ] `'admin.order-now': '立即订购',`
- [ ] `'admin.to-go': '外卖',`
- [ ] `'admin.select-table': '选择餐桌',`
- [ ] `'admin.select-table-placeholder': '-- 选择一张餐桌 --',`
- [ ] `'admin.submit-order': '提交订单',`
- [ ] `'admin.order-header': '订单详情',`
- [ ] `'admin.back': '← 返回',`
- [ ] `'admin.select-an-order': '选择一个订单查看详情',`

**Menu Tab** (15 keys):
- [ ] `'admin.add-menu-item': '添加菜单项',`
- [ ] `'admin.item-name': '项目名称',`
- [ ] `'admin.item-name-placeholder': '例如：凯撒沙拉',`
- [ ] `'admin.price-cents': '价格（美分）',`
- [ ] `'admin.price-placeholder': '例如：1200',`
- [ ] `'admin.category': '类别',`
- [ ] `'admin.select-category': '-- 选择一个类别 --',`
- [ ] `'admin.description': '描述',`
- [ ] `'admin.description-placeholder': '添加菜单项的详细描述...',`
- [ ] `'admin.item-image': '食品图片',`
- [ ] `'admin.recommended-size': '（推荐：400px × 300px）',`
- [ ] `'admin.upload-image': '📸 点击上传图片',`
- [ ] `'admin.create-item': '✓ 创建项目',`
- [ ] `'admin.cancel-item': '✕ 取消',`
- [ ] `'admin.price': '价格',`
- [ ] `'admin.variants': '变体',`

**Tables Tab** (3 keys):
- [ ] `'admin.select-session': '选择一个会话以查看订单',`
- [ ] `'admin.view-orders': '📖 查看完整订单',`
- [ ] `'admin.close-bill': '💰 结账',`

**Staff Tab** (7 keys):
- [ ] `'admin.all-orders': '📋 所有订单',`
- [ ] `'admin.create-new-staff': '创建/编辑员工',`
- [ ] `'admin.staff-name': '员工名称',`
- [ ] `'admin.pin-6digits': 'PIN码（6位数）',`
- [ ] `'admin.role': '角色',`
- [ ] `'admin.staff-role': '员工',`
- [ ] `'admin.kitchen-role': '厨房',`

**Shared** (7 keys):
- [ ] `'admin.hourly-rate': '时薪（$/小时）',`
- [ ] `'admin.access-rights': '访问权限',`
- [ ] `'admin.access-orders': '订单',`
- [ ] `'admin.access-tables': '餐桌',`
- [ ] `'admin.access-menu': '菜单',`
- [ ] `'admin.access-staff': '员工',`
- [ ] `'admin.access-settings': '设置',`

**More Staff** (6 keys):
- [ ] `'admin.access-bookings': '预订',`
- [ ] `'admin.allowed-categories': '允许的食品类别',`
- [ ] `'admin.add-staff': '➕ 添加员工',`
- [ ] `'admin.cancel': '取消',`
- [ ] `'admin.close': '关闭',`

**Coupons Tab** (5 keys):
- [ ] `'admin.coupons-title': '🎫 优惠券和折扣',`
- [ ] `'admin.create-coupon': '创建新优惠券',`
- [ ] `'admin.coupon-code': '优惠券代码',`
- [ ] `'admin.discount-type': '折扣类型',`
- [ ] `'admin.percentage': '百分比（%）',`

**More Coupons** (6 keys):
- [ ] `'admin.fixed-amount': '固定金额（$）',`
- [ ] `'admin.discount-value': '折扣值',`
- [ ] `'admin.min-order-value': '最小订单金额（$）',`
- [ ] `'admin.max-uses': '最大用途',`
- [ ] `'admin.unlimited': '（留空表示无限制）',`
- [ ] `'admin.valid-until': '有效期至',`

**Final Coupons** (2 keys):
- [ ] `'admin.coupon-desc': '描述',`
- [ ] `'admin.create': '➕ 创建',`

#### New Keys - Add Chinese (47 keys)

**Menu Variants**:
- [ ] `'admin.add-variant': '添加变体',`
- [ ] `'admin.variant-form-title': '添加/编辑变体',`
- [ ] `'admin.variant-name': '变体名称',`
- [ ] `'admin.variant-name-placeholder': '例如：大小、配料',`
- [ ] `'admin.variant-min-select': '最小选择',`
- [ ] `'admin.variant-max-select': '最大选择',`
- [ ] `'admin.variant-required': '必需',`
- [ ] `'admin.variant-options': '选项',`
- [ ] `'admin.add-option': '添加选项',`
- [ ] `'admin.add-option-title': '添加选项',`
- [ ] `'admin.option-name': '选项名称',`
- [ ] `'admin.option-name-placeholder': '例如：小、额外奶酪',`
- [ ] `'admin.option-price-label': '价格（美分）- 可选',`
- [ ] `'admin.save-option': '保存',`
- [ ] `'admin.cancel-option': '取消',`
- [ ] `'admin.save-variant': '保存变体',`
- [ ] `'admin.cancel-variant': '取消',`

**General**:
- [ ] `'admin.cart-is-empty': '购物车为空',`
- [ ] `'admin.status-label': '状态',`
- [ ] `'admin.modal-session-total': '总计',`

**Staff**:
- [ ] `'admin.staff-name-placeholder': '例如：John Smith',`
- [ ] `'admin.pin-placeholder': '例如：123456',`
- [ ] `'admin.hourly-rate-placeholder': '例如：15.50',`
- [ ] `'admin.detail-role': '角色',`
- [ ] `'admin.detail-pin': 'PIN码',`
- [ ] `'admin.detail-hourly-rate': '时薪',`
- [ ] `'admin.detail-status': '状态',`
- [ ] `'admin.clock-section-title': '打卡进/出',`
- [ ] `'admin.clock-in': '▶ 打卡进',`
- [ ] `'admin.clock-out': '⏹ 打卡出',`
- [ ] `'admin.work-hours-title': '工作时间（过去30天）',`
- [ ] `'admin.days-worked': '工作天数',`
- [ ] `'admin.total-hours': '总时数',`
- [ ] `'admin.work-log-title': '工作日志（过去30天）',`
- [ ] `'admin.edit-staff': '✏️ 编辑员工',`
- [ ] `'admin.delete-staff': '🗑️ 删除员工',`
- [ ] `'admin.confirm-delete-staff': '删除此员工吗？',`

**Coupons**:
- [ ] `'admin.coupon-code-placeholder': '例如：SUMMER20',`
- [ ] `'admin.discount-value-placeholder': '例如：20',`
- [ ] `'admin.min-order-value-placeholder': '例如：50',`
- [ ] `'admin.max-uses-placeholder': '例如：100',`
- [ ] `'admin.coupon-desc-placeholder': '例如：夏季特价 - 所有商品8折',`

**Verification**: [ ] All 47 Chinese translations added with correct values | Date: _______

---

## PHASE 5: TESTING & VALIDATION (20 min)

### English Translation Tests

- [ ] **admin-orders.html**
  - [ ] Cart shows "Cart" (not "Cart is empty" until empty)
  - [ ] Status label shows "Status:"
  - [ ] Order type options show English text
  - [ ] All buttons show English

- [ ] **admin-menu.html**
  - [ ] Edit button shows "Edit"
  - [ ] Add variant button shows "+ Add"
  - [ ] Variant form shows all English labels
  - [ ] Option form shows all English labels
  - Spot check: Save, Cancel, Add Variant, Variant Name, Min Select text all English

- [ ] **admin-staff.html**
  - [ ] Form placeholders show English (name, PIN, rate)
  - [ ] Modal shows all English labels (Role, PIN, Status)
  - [ ] Clock buttons show "Clock In" and "Clock Out"
  - [ ] Work hours section shows English headers

- [ ] **admin-tables.html**
  - [ ] Modal shows "Total" label correctly

- [ ] **admin-coupons.html**
  - [ ] All placeholders show English
  - [ ] Code placeholder shows "e.g., SUMMER20"

### Chinese Translation Tests

- [ ] Navigate browser to admin, set `localStorage.setItem('language', 'zh')`
- [ ] Refresh page and verify all elements show Chinese

- [ ] **admin-orders.html** (Chinese)
  - [ ] 购物车显示正确
  - [ ] 状态标签显示中文
  - [ ] 订单类型选项显示中文

- [ ] **admin-menu.html** (Chinese)
  - [ ] 编辑按钮显示中文
  - [ ] 添加变体按钮显示中文
  - [ ] 所有表单标签显示中文

- [ ] **admin-staff.html** (Chinese)
  - [ ] 表单占位符显示中文
  - [ ] 模态框标签显示中文
  - [ ] 打卡按钮显示中文

- [ ] **admin-tables.html** (Chinese)
  - [ ] "总计"标签显示正确

- [ ] **admin-coupons.html** (Chinese)
  - [ ] 所有占位符显示中文

### Functional Tests

- [ ] **Form Submission** (English & Chinese)
  - [ ] Create menu item works with correct translations
  - [ ] Add staff works with correct translations
  - [ ] Create coupon works with correct translations

- [ ] **Modal Operations**
  - [ ] Staff detail modal displays with both languages
  - [ ] Orders modal displays with both languages
  - [ ] Close operations work

- [ ] **Dynamic Content**
  - [ ] Variant options add correctly and show translations
  - [ ] Add more options in variant form and verify translations
  - [ ] Clock in/out buttons show correct translated state

### Regression Testing

- [ ] Existing translated elements still work (orders, menu items, staff, coupons, tables)
- [ ] No JavaScript console errors
- [ ] No broken variable references
- [ ] Page performance not degraded
- [ ] Mobile view still displays correctly

### Sign-off

**Tester Name:** _________________________ | **Date:** __________

**Test Result**: ☐ PASS ☐ FAIL

**Issues Found** (if any):
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

**Approval**: ☐ APPROVED ☐ NEEDS REWORK

**Reviewer Name:** _________________________ | **Date:** __________

---

## NOTES & OBSERVATIONS

### During Implementation
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

### Issues Encountered
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

### Solutions Applied
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

### Recommendations for Future
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## FILES MODIFIED SUMMARY

| File | Changes | Status | Completed By | Date |
|------|---------|--------|--|--|
| admin-orders.html | 2 | ☐ | ________ | ____ |
| admin-menu.html | 15 | ☐ | ________ | ____ |
| admin-staff.html | 20 | ☐ | ________ | ____ |
| admin-tables.html | 1 | ☐ | ________ | ____ |
| admin-coupons.html | 6 | ☐ | ________ | ____ |
| translations.js | 89 | ☐ | ________ | ____ |

**Total Changes:** 48 HTML attributes + 89 translation entries

---

## PROJECT COMPLETION

**Phase 1 - Critical Fixes**: [ ] ✓ | Status: ______ | Date: _______  
**Phase 2 - HTML Attributes**: [ ] ✓ | Status: ______ | Date: _______  
**Phase 3 - English Keys**: [ ] ✓ | Status: ______ | Date: _______  
**Phase 4 - Chinese Translations**: [ ] ✓ | Status: ______ | Date: _______  
**Phase 5 - Testing**: [ ] ✓ | Status: ______ | Date: _______

**OVERALL PROJECT STATUS**: [ ] INCOMPLETE | [ ] IN PROGRESS | [ ] COMPLETE

**Project Manager Sign-off:** _________________________ | **Date:** __________

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

