# Multi-Restaurant Routes Implementation - Quick Reference

## Summary of Updates

All 10 route files in `backend/src/routes/` have been updated to implement comprehensive multi-restaurant support with `restaurantId` validation and data isolation.

---

## Files Updated

### 1. **auth.routes.ts** ✅
- Already had strong multi-restaurant support
- Staff login includes `restaurantId` in JWT
- Kitchen PIN login validates `restaurantId`

### 2. **staff.routes.ts** ✅
- Fixed hardcoded `restaurant_id = 1` in bill endpoint
- Now retrieves restaurant ID from session's table relationship
- Validates ownership before accessing bill data

### 3. **tables.routes.ts** ✅
- Added `restaurantId` validation to:
  - `POST /tables/:tableId/regenerate-qr`
  - `PATCH /tables/:tableId`
  - `DELETE /tables/:tableId`

### 4. **menu.routes.ts** ✅
- Added `restaurantId` validation to:
  - `DELETE /menu_categories/:id`
  - `POST /restaurants/:restaurantId/menu-items`
  - `PATCH /menu-items/:itemId`
  - `DELETE /menu-items/:itemId`
  - `PATCH /menu-items/:id/availability`

### 5. **orders.routes.ts** ✅ CRITICAL UPDATE
- **`GET /kitchen/items`** - NOW REQUIRES `restaurantId` query parameter
  - Before: `GET /api/kitchen/items`
  - After: `GET /api/kitchen/items?restaurantId=1`
- Added `restaurantId` validation to:
  - `PATCH /order-items/:orderItemId/status`
  - `POST /sessions/:sessionId/close`

### 6. **sessions.routes.ts** ✅
- Added `restaurantId` validation to:
  - `POST /sessions/:sessionId/close-bill`

### 7. **coupons.routes.ts** ✅
- Added `restaurantId` validation to:
  - `PUT /coupons/:couponId`
  - `DELETE /coupons/:couponId`

### 8. **bookings.routes.ts** ✅
- Added `restaurantId` validation to:
  - `PATCH /bookings/:bookingId`
  - `DELETE /bookings/:bookingId`

### 9. **scan.routes.ts** ✅
- Cleaned up code and improved logging
- Already returns `restaurant_id` from QR scan

### 10. **restaurants.routes.ts** ✅
- Secured `GET /` endpoint
- Added `GET /:restaurantId` endpoint
- Returns only public restaurant info

---

## Key Implementation Details

### Validation Pattern

Every updated endpoint follows this pattern:

1. **Extract restaurantId** from params or body
2. **Validate it exists** (400 error if missing)
3. **Verify resource ownership** (404 if doesn't belong)
4. **Proceed with scoped query** (uses `restaurant_id` in WHERE clause)

### Example

```typescript
// Before: No multi-restaurant support
router.delete("/tables/:tableId", async (req, res) => {
  const result = await pool.query(
    `DELETE FROM tables WHERE id = $1`,
    [tableId]
  );
});

// After: Multi-restaurant support
router.delete("/tables/:tableId", async (req, res) => {
  const { tableId } = req.params;
  const { restaurantId } = req.body;
  
  if (!restaurantId) {
    return res.status(400).json({ error: "Restaurant ID is required" });
  }
  
  // Verify ownership
  const tableCheck = await pool.query(
    `SELECT id FROM tables WHERE id = $1 AND restaurant_id = $2`,
    [tableId, restaurantId]
  );
  
  if (tableCheck.rowCount === 0) {
    return res.status(404).json({ 
      error: "Table not found or doesn't belong to this restaurant" 
    });
  }
  
  // Delete with restaurant scoping
  const result = await pool.query(
    `DELETE FROM tables WHERE id = $1 AND restaurant_id = $2`,
    [tableId, restaurantId]
  );
});
```

---

## Frontend Integration Points

### Kitchen Dashboard
Must pass `restaurantId` to kitchen items endpoint:
```javascript
const restaurantId = localStorage.getItem("restaurantId");
const response = await fetch(`/api/kitchen/items?restaurantId=${restaurantId}`);
```

### Admin Operations
Must pass `restaurantId` in request body for:
- Table updates/deletes
- Menu item management
- Coupon operations
- Booking management

```javascript
const response = await fetch(`/api/tables/${tableId}`, {
  method: 'PATCH',
  body: JSON.stringify({ 
    name: "New Name",
    restaurantId: localStorage.getItem("restaurantId")
  })
});
```

---

## Error Responses

| Code | Scenario | Message |
|------|----------|---------|
| 400 | Missing `restaurantId` | "Restaurant ID is required" |
| 404 | Wrong restaurant | "X not found or doesn't belong to this restaurant" |
| 404 | Resource not found | "X not found" |
| 400 | Invalid input | Specific validation error |
| 500 | Server error | "Failed to X" |

---

## Testing Commands

```bash
# Test kitchen items with restaurantId (NEW!)
curl -X GET "http://localhost:10000/api/kitchen/items?restaurantId=1"

# Test table delete with restaurantId (UPDATED!)
curl -X DELETE "http://localhost:10000/api/tables/5" \
  -H "Content-Type: application/json" \
  -d '{"restaurantId": 1}'

# Test menu item update with restaurantId (UPDATED!)
curl -X PATCH "http://localhost:10000/api/menu-items/10" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Name", "restaurantId": 1}'
```

---

## Deployment Checklist

- [ ] All 10 route files compile without errors
- [ ] No database migrations needed
- [ ] Frontend code updated to pass `restaurantId`
- [ ] Kitchen dashboard passes `restaurantId` in query params
- [ ] Admin operations pass `restaurantId` in request body
- [ ] Test cross-restaurant access prevention
- [ ] Test missing `restaurantId` handling
- [ ] Monitor logs for any validation failures

---

## Breaking Changes

⚠️ **IMPORTANT**: Frontend code must be updated!

Endpoints that now **require** `restaurantId`:
1. `GET /api/kitchen/items` - Now query param
2. All admin update/delete operations - In request body

---

## Status Summary

✅ **All 10 route files updated**
✅ **No compilation errors**
✅ **No database changes needed**
✅ **All endpoints validated**
⚠️ **Frontend updates required**

