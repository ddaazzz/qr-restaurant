# Frontend-Backend Routes Audit

## Summary
Fixed all incorrect frontend API calls to properly use backend routes.

## Changes Made

### 1. admin-settings.js (6 fixes)
**Issue**: Settings endpoints used `${API}/${restaurantId}/settings` instead of `${API}/restaurants/${restaurantId}/settings`

**Fixed locations**:
- Line 193: `loadPOSIntegrationModal()` GET request
- Line 262: `loadQRSettingsModal()` GET request  
- Line 308: `loadBookingSettingsModal()` GET request
- Line 514: `savePOSIntegrationSettings()` PATCH request
- Line 577: `saveBookingSettings()` PATCH request
- Line 659: `saveQRMode()` PATCH request

**Correct endpoint**: `GET/PATCH /api/restaurants/:restaurantId/settings`

---

### 2. admin-tables.js (1 fix)
**Issue**: `printBill()` function made two fetch calls - one to `/sessions/:sessionId/bill` and another non-existent call to `/sessions/:sessionId` to get session data

**Fixed**: Updated backend `GET /sessions/:sessionId/bill` endpoint to include session data (started_at, order_type, table_id, table_name) in response

**Before**:
```javascript
const res = await fetch(`${API}/sessions/${sessionId}/bill`);
const sessionRes = await fetch(`${API}/sessions/${sessionId}`); // This endpoint doesn't exist
const session = sessionRes.ok ? await sessionRes.json() : null;
```

**After**:
```javascript
const res = await fetch(`${API}/sessions/${sessionId}/bill`);
// Backend now includes session data in bill response
if (bill.session) { 
  startTime = bill.session.started_at;
  // ... use bill.session.order_type, table_id, etc
}
```

**Backend changes**: [sessions.routes.ts](backend/src/routes/sessions.routes.ts#L257-L322)
- Added `ts.started_at, ts.order_type` to SELECT query
- Added `session` object to response JSON

---

## Route Status Summary

✅ **admin-menu.js** - All endpoints correct
- Uses: `/restaurants/{restaurantId}/menu_categories`, `/restaurants/{restaurantId}/menu-items`, `/menu-items/{id}/variants`, etc.

✅ **admin-staff.js** - All endpoints correct
- Uses: `/restaurants/{restaurantId}/staff`, `/restaurants/{restaurantId}/staff/{staffId}`, `/restaurants/{restaurantId}/staff/{staffId}/clock-in`, etc.
- Endpoints located in: [auth.routes.ts](backend/src/routes/auth.routes.ts)

✅ **admin-tables.js** - All endpoints correct (after fix)
- Uses: `/restaurants/{restaurantId}/tables`, `/sessions/{sessionId}/bill`, `/tables/{tableId}/sessions`, etc.

✅ **admin-orders.js** - All endpoints correct
- Uses: `/restaurants/{restaurantId}/orders`, `/sessions/{sessionId}/orders`, `/restaurants/{restaurantId}/counter-order`, `/restaurants/{restaurantId}/to-go-order`

✅ **admin-bookings.js** - All endpoints correct
- Uses: `/restaurants/{restaurantId}/bookings`, `/restaurants/{restaurantId}/tables`

✅ **admin-reports.js** - All endpoints correct  
- Uses: `/restaurants/{restaurantId}/orders?limit=1000`

✅ **admin-settings.js** - Fixed (6 issues resolved)
- Correct: `/restaurants/{restaurantId}/settings`, `/restaurants/{restaurantId}/coupons`, `/restaurants/{restaurantId}/logo`, `/restaurants/{restaurantId}/background`

---

## Endpoint Organization

Backend routes are mounted at `/api` with the following structure:

```
/api
  ├── /restaurants  → routes/restaurants.routes.ts
  │                   (Contains staff management via auth.routes.ts mount)
  ├── /            → auth.routes.ts (staff CRUD: POST /restaurants/:id/staff, etc.)
  ├── /            → tables.routes.ts
  ├── /            → sessions.routes.ts
  ├── /            → menu.routes.ts
  ├── /            → orders.routes.ts
  ├── /            → bookings.routes.ts
  ├── /            → coupons.routes.ts
  ├── /            → settings.routes.ts
  └── /            → scan.routes.ts, waitlist.routes.ts
```

See [backend/src/app.ts](backend/src/app.ts#L74-L85) for route mounting configuration.

---

## Verification

All admin modules now correctly use backend routes:
1. Routes follow `/api/restaurants/:restaurantId/resource` pattern for scoping
2. No hardcoded resource IDs without restaurant context
3. Multi-restaurant isolation maintained through restaurantId parameter
4. All CRUD operations properly use HTTP verbs (GET, POST, PATCH, DELETE)

**Status**: ✅ ALL ROUTES VERIFIED AND CORRECTED
