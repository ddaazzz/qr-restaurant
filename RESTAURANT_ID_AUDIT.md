# Restaurant ID Filtering Audit - Backend SQL Queries

**Date:** February 12, 2026  
**Scope:** Full backend/src/routes directory analysis  
**Summary:** Multi-restaurant data isolation via restaurant_id verification

---

## Executive Summary

### ✅ Status: PARTIALLY COMPLIANT
- **Tables with proper restaurant_id scoping:** 9/14 (64%)
- **Tables missing restaurant_id filtering in some queries:** 5 tables have vulnerabilities
- **Critical Issues:** 3 high-risk queries without restaurant_id validation
- **Medium Issues:** 2 queries with indirect filtering (via joins)

---

## DATABASE SCHEMA - All Tables

| Table Name | Has restaurant_id | Storage Scope | Risk Level |
|------------|------------------|---------------|-----------|
| **restaurants** | PK: id | Global (multi-tenant root) | ✅ SAFE |
| **tables** | ✅ YES | restaurant_id FK | ✅ SAFE |
| **table_categories** | ✅ YES | restaurant_id FK | ✅ SAFE |
| **table_sessions** | ✅ YES | Via table FK | ⚠️ INDIRECT |
| **table_units** | ✅ YES (via table) | Via table FK | ⚠️ INDIRECT |
| **menu_categories** | ✅ YES | restaurant_id FK | ✅ SAFE |
| **menu_items** | ❌ NO | Via category FK | ⚠️ INDIRECT |
| **menu_item_variants** | ❌ NO | Via menu_item FK | ⚠️ INDIRECT |
| **menu_item_variant_options** | ❌ NO | Via variant FK | ⚠️ INDIRECT |
| **orders** | ❌ NO | Via session FK | ⚠️ INDIRECT |
| **order_items** | ❌ NO | Via order FK | ⚠️ INDIRECT |
| **order_item_variants** | ❌ NO | Via order_item FK | ⚠️ INDIRECT |
| **users** | ✅ YES | restaurant_id FK | ✅ SAFE |
| **bill_closures** | ❌ NO | Via session FK | ⚠️ INDIRECT |
| **coupons** | ✅ YES | restaurant_id FK | ✅ SAFE |
| **bookings** | ✅ YES | restaurant_id FK | ✅ SAFE |

---

## CRITICAL FINDINGS BY TABLE

### 1. **ORDERS** Table
**Schema:** `id`, `session_id` (FK→table_sessions), `status`, `created_at`  
**Has direct restaurant_id:** ❌ NO (must traverse: session → table → restaurant_id)

#### ✅ Queries WITH restaurant_id filtering:
- **GET /sessions/:sessionId/orders** [orders.routes.ts:217]
  - Joins: `orders → order_items → table_sessions`
  - Filter: `WHERE t.restaurant_id = $1` ✅
  - Risk: **LOW** - Filters at session level, session→table→restaurant linked

- **GET /restaurants/:restaurantId/active-sessions-with-orders** [staff.routes.ts:122]
  - Filter: `WHERE t.restaurant_id = $1 AND ts.ended_at IS NULL` ✅
  - Joins through table_sessions→tables
  - Risk: **LOW** - Explicit restaurant_id check

#### ❌ Queries WITHOUT restaurant_id filtering:
- **GET /api/kitchen/items** [orders.routes.ts:289]
  - Query: ⚠️ **HAS INDIRECT FILTERING**
  - Uses: `WHERE oi.status != 'served' AND (COALESCE(ts.restaurant_id, mc.restaurant_id) IS NOT NULL)`
  - Issue: **NO explicit restaurant_id parameter** - Returns ALL restaurants' kitchen items!
  - Risk: **CRITICAL** 🔴 Kitchen staff see all restaurants' orders

- **POST /sessions/:sessionId/orders** [orders.routes.ts:8]
  - Query: `INSERT INTO orders (session_id) VALUES ($1)`
  - Validation: ✅ Checks `table_sessions.ended_at IS NULL` before insert
  - Missing: NO explicit restaurant_id validation from request body
  - Risk: **LOW** - Session validation prevents cross-restaurant injection

- **PATCH /order-items/:id** [orders.routes.ts:432]
  - Query: `DELETE FROM order_items WHERE id = $1` / `UPDATE order_items SET quantity = $1 WHERE id = $2`
  - Issue: **NO validation** that order_item belongs to authenticated user's restaurant
  - Risk: **MEDIUM** 🟡 - Customer with order_item_id could modify any restaurant's items

- **DELETE /order-items/:id** [orders.routes.ts:455]
  - Query: `DELETE FROM order_items WHERE id = $1`
  - Issue: **NO restaurant_id validation**
  - Risk: **MEDIUM** 🟡 - Same as above

- **POST /sessions/:sessionId/close** [orders.routes.ts:487]
  - Closes session without verifying restaurant ownership
  - Risk: **MEDIUM** 🟡 - Any sessionId can be closed

---

### 2. **MENU_ITEM_VARIANTS** Table
**Schema:** `id`, `menu_item_id` (FK→menu_items), `name`, `required`, `min_select`, `max_select`  
**Has direct restaurant_id:** ❌ NO

#### ✅ Queries WITH restaurant_id filtering:
- **GET /restaurants/:restaurantId/menu** [menu.routes.ts:188]
  - Filter: `WHERE mc.restaurant_id = $1` ✅
  - Risk: **LOW** - Filters variants via menu_categories.restaurant_id

- **GET /restaurants/:restaurantId/menu/staff** [menu.routes.ts:281]
  - Filter: `WHERE mc.restaurant_id = $1` ✅
  - Risk: **LOW**

#### ❌ Queries WITHOUT restaurant_id filtering:
- **POST /sessions/:sessionId/orders (Variant Validation)** [orders.routes.ts:47]
  - Query: `SELECT id, required, min_select, max_select FROM menu_item_variants WHERE menu_item_id = $1`
  - Issue: Trusts `item.menu_item_id` from request without restaurant validation
  - Risk: **MEDIUM** 🟡 - Customer could pass menu_item_id from another restaurant

- **Variant price lookup** [orders.routes.ts:137]
  - Query: `SELECT COALESCE(SUM(price_cents), 0) AS extra FROM menu_item_variant_options WHERE id = ANY($1::int[])`
  - Issue: **NO menu_item_id validation** - Accepts any variant_option_ids
  - Risk: **HIGH** 🔴 - Could inject pricing from competitor restaurant's variants

---

### 3. **MENU_ITEM_VARIANT_OPTIONS** Table
**Schema:** `id`, `variant_id` (FK→menu_item_variants), `name`, `price_cents`, `is_available`  
**Has direct restaurant_id:** ❌ NO

#### ✅ Queries WITH restaurant_id filtering:
- **GET /restaurants/:restaurantId/menu** [menu.routes.ts:235]
  - Filter: Indirect through variants→menu_items→categories.restaurant_id ✅
  - Risk: **LOW**

#### ❌ Queries WITHOUT restaurant_id filtering:
- **POST /sessions/:sessionId/orders** [orders.routes.ts:60]
  - Query: `SELECT id, variant_id FROM menu_item_variant_options WHERE id = ANY($1::int[])`
  - Issue: **NO validation** that variant_options belong to this restaurant's menu
  - Risk: **HIGH** 🔴 - Accept option IDs from competing restaurant's menu

---

### 4. **TABLE_SESSIONS** Table
**Schema:** `id`, `table_id` (FK→tables), `table_unit_id` (FK→table_units), `pax`, `started_at`, `ended_at`  
**Has direct restaurant_id:** ✅ YES (via table FK)

#### ✅ Queries WITH restaurant_id filtering:
- **GET /restaurants/:restaurantId/table-state** [sessions.routes.ts:138]
  - Filter: `WHERE t.restaurant_id = $1` ✅
  - Risk: **LOW**

- **PATCH /sessions/:sessionId/close** [sessions.routes.ts:336]
  - Query validates session exists, but no restaurant_id check ⚠️
  - Risk: **MEDIUM** 🟡 - Missing explicit restaurant_id validation

#### ⚠️ Queries WITH INDIRECT filtering:
- **POST /tables/:tableId/sessions** [sessions.routes.ts:18]
  - Filter: Loads table by ID, checks restaurant_id from table ✅
  - Query: `SELECT t.id, t.seat_count, t.restaurant_id FROM tables t WHERE t.id = $1` ✅
  - Risk: **LOW** - Validates via table

---

### 5. **TABLES** Table
**Schema:** `id`, `restaurant_id` (FK→restaurants), `name`, `created_at`, `category_id`, `seat_count`  
**Has direct restaurant_id:** ✅ YES

#### ✅ Queries WITH restaurant_id filtering:
- **GET /restaurants/:restaurantId/tables** [tables.routes.ts:32]
  - Filter: `WHERE t.restaurant_id = $1` ✅
  - Risk: **LOW**

- **POST /restaurants/:restaurantId/tables** [tables.routes.ts:113]
  - Filter: `INSERT INTO tables (restaurant_id, name, category_id, seat_count)` ✅
  - Risk: **LOW** - restaurant_id from URL params

- **PATCH /tables/:tableId** [tables.routes.ts:220]
  - Query: `UPDATE tables SET ... WHERE id = $2 AND restaurant_id = $3`
  - Filter: ✅ Checks both table ID and restaurant_id
  - Risk: **LOW**

- **DELETE /tables/:tableId** [tables.routes.ts:577]
  - Query: `DELETE FROM tables WHERE id = $1`
  - Issue: ❌ **NO restaurant_id validation** - Any admin could delete any table
  - Risk: **HIGH** 🔴

#### ❌ Queries WITHOUT restaurant_id filtering:
- **DELETE /tables/:tableId** [tables.routes.ts:577]
  - Missing restaurant_id in WHERE clause
  - Risk: **HIGH** 🔴 - Cross-restaurant data deletion

---

## OTHER KEY TABLES

### 6. **USERS** Table
**Schema:** `id`, `name`, `email`, `password_hash`, `role`, `pin`, `restaurant_id`, `access_rights`  
**Has direct restaurant_id:** ✅ YES

#### Status:
- PIN validation for kitchen staff: `SELECT id FROM users WHERE restaurant_id = $1 AND pin = $2` ✅
- Staff creation: `INSERT INTO users ... restaurant_id = $1` ✅
- Risk: **LOW** - Properly scoped

### 7. **BILL_CLOSURES** Table
**Schema:** `id`, `session_id` (FK→table_sessions), `closed_at`, `closed_by_staff_id`, `payment_method`, `amount_paid`, `discount_applied`, `pos_reference`  
**Has direct restaurant_id:** ❌ NO (via session → table → restaurant)

#### Status:
- Queries rely on session_id filtering ⚠️
- No direct restaurant_id validation in queries found
- Risk: **MEDIUM** 🟡 - Indirect filtering only

### 8. **COUPONS** Table
**Schema:** `id`, `restaurant_id`, `code`, `discount_type`, `discount_value`, `valid_until`, `max_uses`, `is_active`  
**Has direct restaurant_id:** ✅ YES

#### Status:
- **GET /restaurants/:restaurantId/coupons** [coupons.routes.ts:11]
  - Filter: `WHERE restaurant_id = $1` ✅
  
- **POST /restaurants/:restaurantId/coupons** [coupons.routes.ts:20]
  - Filter: `VALUES ($1, ...)` with restaurantId ✅

- **PATCH /coupons/:couponId** [coupons.routes.ts:50]
  - Issue: ❌ **NO restaurant_id validation** - Any admin could modify any coupon
  - Query: `UPDATE coupons SET ... WHERE id = $1`
  - Risk: **HIGH** 🔴

- **DELETE /coupons/:couponId** [coupons.routes.ts:70]
  - Issue: ❌ **NO restaurant_id validation**
  - Risk: **HIGH** 🔴

---

## VULNERABILITY SUMMARY

### 🔴 CRITICAL (Must Fix Immediately)
| Issue | Location | Severity | Fix |
|-------|----------|----------|-----|
| Kitchen sees ALL restaurants' orders | `/api/kitchen/items` | CRITICAL | Add `AND ts.restaurant_id = $1` parameter |
| Variant pricing injection | `POST /sessions/:sessionId/orders` (line 144) | CRITICAL | Validate menu_item_id belongs to restaurant before fetching variants |
| Cross-restaurant table deletion | `DELETE /tables/:tableId` | CRITICAL | Add `AND restaurant_id = $1` to WHERE clause |
| Cross-restaurant coupon modification | `PATCH /coupons/:couponId` | CRITICAL | Add restaurant_id validation before update |
| Cross-restaurant coupon deletion | `DELETE /coupons/:couponId` | CRITICAL | Add restaurant_id validation before delete |

### 🟡 MEDIUM (Should Fix Soon)
| Issue | Location | Risk | Fix |
|-------|----------|------|-----|
| Order item modification without restaurant check | `PATCH /order-items/:id` | MEDIUM | Validate order→session→table→restaurant before update |
| Order item deletion without restaurant check | `DELETE /order-items/:id` | MEDIUM | Validate order→session→table→restaurant before delete |
| Session closure without restaurant verification | `POST /sessions/:sessionId/close` | MEDIUM | Verify session's restaurant matches authenticated user |
| Variant validation trusts client input | `POST /sessions/:sessionId/orders` | MEDIUM | Validate all menu_item_ids belong to requested restaurant |

---

## QUERIES PROPERLY SCOPED (✅ SAFE)

### By Route File:

**menu.routes.ts**
- ✅ GET `/restaurants/:restaurantId/menu_categories` - `WHERE restaurant_id = $1`
- ✅ POST `/restaurants/:restaurantId/menu_categories` - `VALUES ($1, ...)` 
- ✅ GET `/restaurants/:restaurantId/menu` - `WHERE mc.restaurant_id = $1`
- ✅ GET `/restaurants/:restaurantId/menu/staff` - `WHERE mc.restaurant_id = $1`

**tables.routes.ts**
- ✅ GET `/restaurants/:restaurantId/tables` - `WHERE t.restaurant_id = $1`
- ✅ POST `/restaurants/:restaurantId/tables` - Restaurant validation + INSERT
- ✅ PATCH `/tables/:tableId` - `WHERE id = $2 AND restaurant_id = $3` (both checks)
- ✅ GET `/restaurants/:restaurantId/table-categories` - `WHERE restaurant_id = $1`
- ✅ POST `/restaurants/:restaurantId/table-categories` - `VALUES ($1, ...)`

**sessions.routes.ts**
- ✅ GET `/restaurants/:restaurantId/table-state` - `WHERE t.restaurant_id = $1`
- ✅ POST `/tables/:tableId/sessions` - Validates table's restaurant_id

**staff.routes.ts**
- ✅ GET `/restaurants/:restaurantId/active-sessions-with-orders` - `WHERE t.restaurant_id = $1`

**auth.routes.ts**
- ✅ POST `/restaurants/:restaurantId/staff` - PIN unique per restaurant

**coupons.routes.ts**
- ✅ GET `/restaurants/:restaurantId/coupons` - `WHERE restaurant_id = $1`
- ✅ POST `/restaurants/:restaurantId/coupons` - `VALUES ($1, ...)`

**bookings.routes.ts**
- ✅ GET `/restaurants/:restaurantId/bookings` - `WHERE b.restaurant_id = $1`
- ✅ POST `/restaurants/:restaurantId/bookings` - Validates table_id + restaurant_id

---

## RECOMMENDATIONS

### Priority 1 - IMMEDIATE (Next Deploy)
1. **Fix `/api/kitchen/items`** - Add required `restaurantId` query parameter
2. **Fix variant pricing in orders** - Validate menu_item_id's restaurant before accepting options
3. **Fix table deletion** - Add restaurant_id to DELETE WHERE clause
4. **Fix coupon updates/deletes** - Add restaurant_id validation

### Priority 2 - SHORT TERM (This Sprint)
1. Add middleware to validate all resource IDs belong to authenticated user's restaurant
2. Add comprehensive auth tests for cross-restaurant access attempts
3. Implement audit logging for all sensitive mutations

### Priority 3 - LONG TERM (Architecture)
1. Consider adding restaurant_id as a required column on all customer-facing tables (orders, order_items, etc.) for direct filtering
2. Create database trigger to cascade delete sessions when table is deleted
3. Add row-level security policies at DB layer (PostgreSQL POLICIES)

---

## AFFECTED ENDPOINTS REQUIRING FIXES

```
CRITICAL:
PATCH /api/coupons/:couponId              → Add restaurant_id validation
DELETE /api/coupons/:couponId             → Add restaurant_id validation
DELETE /api/tables/:tableId               → Add restaurant_id validation
GET    /api/kitchen/items                 → Require restaurantId parameter

POST   /api/sessions/:sessionId/orders    → Validate menu_item_id ownership
POST   /api/sessions/:sessionId/close     → Validate session restaurant

MEDIUM:
PATCH  /api/order-items/:id               → Add order→session→table validation
DELETE /api/order-items/:id               → Add order→session→table validation
```

---

## TESTING RECOMMENDATIONS

```typescript
// Test: Kitchen staff from Restaurant A shouldn't see Restaurant B's orders
const kitchenAOrders = await GET /api/kitchen/items (as Kitchen-RestaurantA)
assert(kitchenAOrders.every(o => o.restaurant_id === restaurantAId))

// Test: Admin from Restaurant A shouldn't delete Table from Restaurant B
await DELETE /api/tables/:restaurantBTableId (as Admin-RestaurantA)
assert(tableStillExists)

// Test: User from Restaurant A shouldn't apply coupon from Restaurant B
await POST /api/sessions/:sessionId/apply-coupon 
  { coupon_code: "FROM_RESTAURANT_B" } (as Customer-RestaurantA)
assert(responseStatus === 400 || 403)

// Test: Customer shouldn't be able to modify order items from another customer
await PATCH /api/order-items/:otherCustomerOrderItemId 
  { quantity: 0 } (as Customer-A)
assert(orderItemStillExists)
```

---

**End of Report**
