# API Routes Audit - Multi-Restaurant Data Isolation

## CRITICAL: Routes That MUST Filter by restaurant_id

### ❌ HIGHEST PRIORITY - Kitchen Dashboard
**File**: `backend/src/routes/kitchen.routes.ts`

```typescript
// CURRENT (LEAKS DATA TO ALL RESTAURANTS):
router.get("/items", async (req, res) => {
  const result = await pool.query(`
    SELECT * FROM orders 
    WHERE status = 'pending'
  `);
  // ❌ Returns orders from ALL restaurants!
});

// MUST BE (RESTAURANT-ISOLATED):
router.get("/items", authenticate, async (req, res) => {
  const { restaurantId } = req.user; // From JWT
  const result = await pool.query(`
    SELECT * FROM orders 
    WHERE restaurant_id = $1 AND status = 'pending'
  `, [restaurantId]);
  // ✅ Only returns this restaurant's orders
});
```

**Impact**: 🔴 CRITICAL SECURITY ISSUE
- Kitchen staff from Restaurant A can see orders from Restaurant B
- Data breach across restaurants

---

### ❌ Orders Routes
**File**: `backend/src/routes/orders.routes.ts`

#### Check These Endpoints:

1. **POST /sessions/:sessionId/orders** - Create Order
```typescript
// Must verify session.restaurant_id matches user.restaurant_id
// Must set order.restaurant_id when creating
const restaurantId = req.user.restaurant_id;
const orderRes = await pool.query(`
  INSERT INTO orders (session_id, restaurant_id) 
  VALUES ($1, $2)
`, [sessionId, restaurantId]);
```

2. **GET /orders/:orderId** - Get Order Details
```typescript
// Must filter by restaurant_id
const restaurantId = req.user.restaurant_id;
const result = await pool.query(`
  SELECT * FROM orders 
  WHERE id = $1 AND restaurant_id = $2
`, [orderId, restaurantId]);
```

3. **PATCH /orders/:orderId/status** - Update Order Status
```typescript
// Must verify restaurant ownership before updating
const restaurantId = req.user.restaurant_id;
const result = await pool.query(`
  UPDATE orders 
  SET status = $1 
  WHERE id = $2 AND restaurant_id = $3
`, [newStatus, orderId, restaurantId]);
```

4. **DELETE /orders/:orderId** - Delete Order
```typescript
// Must verify restaurant ownership
const restaurantId = req.user.restaurant_id;
```

---

### ❌ Sessions Routes
**File**: `backend/src/routes/sessions.routes.ts`

1. **GET /api/sessions** - List Sessions
```typescript
// WRONG: No restaurant filter
SELECT * FROM table_sessions;

// CORRECT: Filter by restaurant
SELECT * FROM table_sessions WHERE restaurant_id = $1;
```

2. **PATCH /sessions/:id/close** - Close Session
```typescript
// Must:
// 1. Verify session.restaurant_id == user.restaurant_id
// 2. Send webhook to correct restaurant's POS
const session = await pool.query(`
  SELECT * FROM table_sessions 
  WHERE id = $1 AND restaurant_id = $2
`, [sessionId, restaurantId]);
```

---

### ❌ Variant & Menu Item Routes
**File**: `backend/src/routes/menu.routes.ts`

1. **GET /menu-items/:id/variants** - Get Variants
```typescript
// Should work (variants are restaurant-scoped via foreign key)
// But verify query uses restaurant_id for extra security
SELECT miv.* FROM menu_item_variants miv
WHERE miv.menu_item_id = $1 
  AND miv.restaurant_id = $2;
```

2. **POST /restaurants/:id/menu/items** - Create Menu Item
```typescript
// Must set restaurant_id through category:
// menu_items -> category -> restaurant_id
```

3. **PATCH /restaurants/:id/menu/items/:itemId** - Update Menu Item
```typescript
// Verify restaurant ownership through category
```

---

### ❌ Coupons Routes
**File**: `backend/src/routes/coupons.routes.ts`

1. **GET /restaurants/:restaurantId/coupons**
```typescript
// WRONG (missing validation):
SELECT * FROM coupons WHERE code = $1;

// CORRECT:
SELECT * FROM coupons 
WHERE code = $1 AND restaurant_id = $2;
```

2. **PATCH /coupons/:id**
```typescript
// Must verify coupon belongs to restaurant:
UPDATE coupons 
SET ... 
WHERE id = $1 AND restaurant_id = $2;
```

3. **DELETE /coupons/:id**
```typescript
// Must verify restaurant ownership:
DELETE FROM coupons 
WHERE id = $1 AND restaurant_id = $2;
```

---

### ❌ Staff/Users Routes
**File**: `backend/src/routes/staff.routes.ts`

1. **GET /restaurants/:restaurantId/staff**
```typescript
// Should already filter, but verify:
SELECT * FROM users 
WHERE restaurant_id = $1 AND role IN ('staff', 'kitchen');
```

2. **POST /restaurants/:restaurantId/staff** - Create Staff
```typescript
// Must set restaurant_id:
INSERT INTO users (restaurant_id, ...) 
VALUES ($1, ...);
```

---

## Audit Checklist

Use this grep to find potential issues:

```bash
# Find queries without restaurant_id filter
grep -n "SELECT.*FROM orders" backend/src/routes/*.ts | grep -v restaurant_id
grep -n "SELECT.*FROM order_items" backend/src/routes/*.ts | grep -v restaurant_id
grep -n "SELECT.*FROM table_sessions" backend/src/routes/*.ts | grep -v restaurant_id
grep -n "SELECT.*FROM menu_item_variants" backend/src/routes/*.ts | grep -v restaurant_id
grep -n "SELECT.*FROM coupons" backend/src/routes/*.ts | grep -v restaurant_id
```

---

## Common Patterns to Fix

### Pattern 1: Missing Restaurant Filter
```typescript
// ❌ WRONG
const result = await pool.query(`SELECT * FROM orders WHERE id = $1`, [id]);

// ✅ CORRECT
const restaurantId = req.user.restaurant_id;
const result = await pool.query(
  `SELECT * FROM orders WHERE id = $1 AND restaurant_id = $2`,
  [id, restaurantId]
);
```

### Pattern 2: Missing Verification on Create
```typescript
// ❌ WRONG
INSERT INTO orders (session_id) VALUES ($1);

// ✅ CORRECT
const restaurantId = req.user.restaurant_id;
// Verify session belongs to this restaurant first
const sessionCheck = await pool.query(
  `SELECT 1 FROM table_sessions WHERE id = $1 AND restaurant_id = $2`,
  [sessionId, restaurantId]
);
if (sessionCheck.rowCount === 0) return res.status(403).json({error: "Unauthorized"});

// Then create with restaurant_id
INSERT INTO orders (session_id, restaurant_id) VALUES ($1, $2);
```

### Pattern 3: Missing Verification on Update
```typescript
// ❌ WRONG
UPDATE orders SET status = $1 WHERE id = $2;

// ✅ CORRECT
const restaurantId = req.user.restaurant_id;
const result = await pool.query(
  `UPDATE orders SET status = $1 WHERE id = $2 AND restaurant_id = $3`,
  [newStatus, orderId, restaurantId]
);
if (result.rowCount === 0) return res.status(403).json({error: "Unauthorized"});
```

### Pattern 4: Missing Verification on Delete
```typescript
// ❌ WRONG
DELETE FROM coupons WHERE id = $1;

// ✅ CORRECT
const restaurantId = req.user.restaurant_id;
const result = await pool.query(
  `DELETE FROM coupons WHERE id = $1 AND restaurant_id = $2`,
  [couponId, restaurantId]
);
if (result.rowCount === 0) return res.status(403).json({error: "Unauthorized"});
```

---

## Priority Order for Fixes

### 🔴 CRITICAL (Do First)
1. **Kitchen Dashboard** - Currently leaks ALL orders to all restaurants
2. **Order Creation** - Must set restaurant_id
3. **Variant Endpoints** - Prevents cross-restaurant variant injection

### 🟠 HIGH (Do Second)
4. **Session Management** - Close/update must verify ownership
5. **Coupon Management** - Currently missing restaurant validation
6. **Staff Management** - Ensure staff can't access other restaurants

### 🟡 MEDIUM (Do Third)
7. **Reports/Analytics** - Filter by restaurant
8. **Menu Endpoints** - Add extra restaurant_id checks
9. **Booking Management** - Verify restaurant ownership

---

## Testing After Fixes

For each endpoint, test:

```bash
# 1. Create data in Restaurant 1
curl -X POST http://localhost:10000/api/orders \
  -H "Authorization: Bearer TOKEN_RESTAURANT_1" \
  -d '...'

# 2. Try to access from Restaurant 2 (should fail)
curl -X GET http://localhost:10000/api/orders/1 \
  -H "Authorization: Bearer TOKEN_RESTAURANT_2"
# Expected: 403 Forbidden or 404 Not Found

# 3. Access from Restaurant 1 (should succeed)
curl -X GET http://localhost:10000/api/orders/1 \
  -H "Authorization: Bearer TOKEN_RESTAURANT_1"
# Expected: 200 OK with order data
```

---

## SQL Verification After Updates

```sql
-- Verify no order can be accessed without restaurant_id check
-- (This should return empty if all routes are properly secured)
SELECT COUNT(*) FROM orders WHERE restaurant_id IS NULL;

-- Test variant isolation
-- Restaurant 1's variant options should not be used in Restaurant 2's orders
SELECT COUNT(*) as cross_restaurant_variants
FROM order_item_variants oiv
JOIN order_items oi ON oiv.order_item_id = oi.id
JOIN menu_item_variant_options mivo ON oiv.variant_option_id = mivo.id
WHERE oi.restaurant_id != mivo.restaurant_id;
-- Should return: 0
```

---

## Files to Update

1. ✅ `backend/src/routes/orders.routes.ts` - Add restaurant_id filtering
2. ✅ `backend/src/routes/sessions.routes.ts` - Verify restaurant ownership
3. ✅ `backend/src/routes/kitchen.routes.ts` - Filter orders by restaurant (CRITICAL!)
4. ✅ `backend/src/routes/coupons.routes.ts` - Add restaurant validation
5. ✅ `backend/src/routes/staff.routes.ts` - Verify staff belongs to restaurant
6. ✅ `backend/src/routes/menu.routes.ts` - Add restaurant_id to variant queries

---

## Estimated Time

- 🔴 Critical fixes: 30-45 minutes
- 🟠 High priority: 45-60 minutes
- 🟡 Medium priority: 30-45 minutes
- Testing: 60+ minutes

**Total: 3-4 hours for complete implementation**
