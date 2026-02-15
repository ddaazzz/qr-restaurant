# Frontend Updates Required for Multi-Restaurant Routes

## Critical Changes Needed

The backend routes have been updated to require `restaurantId` validation. The frontend must be updated to pass this parameter to all relevant endpoints.

---

## Files That Need Updates

### 1. **kitchen.js** - CRITICAL UPDATE REQUIRED ⚠️

**Endpoint Changed:** `GET /api/kitchen/items`

**Current Code (BROKEN):**
```javascript
async function loadKitchenOrders() {
  const response = await fetch(`/api/kitchen/items`);
  const orders = await response.json();
  // ...
}
```

**Updated Code (CORRECT):**
```javascript
async function loadKitchenOrders() {
  const restaurantId = localStorage.getItem("restaurantId");
  if (!restaurantId) {
    console.error("No restaurant ID found");
    return;
  }
  
  const response = await fetch(`/api/kitchen/items?restaurantId=${restaurantId}`);
  if (!response.ok) {
    console.error("Failed to load kitchen orders:", response.status);
    return;
  }
  const orders = await response.json();
  // ...
}
```

---

### 2. **admin.js** - Multiple Updates Required

#### A. Order Status Updates
**Endpoint:** `PATCH /api/order-items/:orderItemId/status`

**Current Code (MAY FAIL):**
```javascript
async function updateOrderItemStatus(itemId, status) {
  const response = await fetch(`/api/order-items/${itemId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
}
```

**Updated Code (CORRECT):**
```javascript
async function updateOrderItemStatus(itemId, status) {
  const restaurantId = localStorage.getItem("restaurantId");
  const response = await fetch(`/api/order-items/${itemId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, restaurantId })
  });
  
  if (!response.ok) {
    console.error("Failed to update order status:", response.status);
    return false;
  }
  return true;
}
```

#### B. Menu Operations
**Endpoints:** DELETE, PATCH menu items

**Current Code (MAY FAIL):**
```javascript
async function deleteMenuItem(itemId) {
  const response = await fetch(`/api/menu-items/${itemId}`, {
    method: 'DELETE'
  });
}

async function updateMenuItem(itemId, data) {
  const response = await fetch(`/api/menu-items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}
```

**Updated Code (CORRECT):**
```javascript
async function deleteMenuItem(itemId) {
  const restaurantId = localStorage.getItem("restaurantId");
  const response = await fetch(`/api/menu-items/${itemId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId })
  });
  return response.ok;
}

async function updateMenuItem(itemId, data) {
  const restaurantId = localStorage.getItem("restaurantId");
  const response = await fetch(`/api/menu-items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, restaurantId })
  });
  return response.ok;
}
```

#### C. Table Management
**Endpoints:** UPDATE, DELETE tables

**Updated Code (CORRECT):**
```javascript
async function updateTable(tableId, name, seatCount) {
  const restaurantId = localStorage.getItem("restaurantId");
  const response = await fetch(`/api/tables/${tableId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, seat_count: seatCount, restaurantId })
  });
  return response.ok;
}

async function deleteTable(tableId) {
  const restaurantId = localStorage.getItem("restaurantId");
  const response = await fetch(`/api/tables/${tableId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId })
  });
  return response.ok;
}
```

#### D. Session/Bill Operations
**Endpoint:** `POST /api/sessions/:sessionId/close`

**Updated Code (CORRECT):**
```javascript
async function closeSession(sessionId) {
  const restaurantId = localStorage.getItem("restaurantId");
  const response = await fetch(`/api/sessions/${sessionId}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId })
  });
  return response.ok;
}
```

---

### 3. **admin-menu.js** - Menu Management Updates

**Current Code (MAY FAIL):**
```javascript
async function deleteCategory(categoryId) {
  const response = await fetch(`/api/menu_categories/${categoryId}`, {
    method: 'DELETE'
  });
}
```

**Updated Code (CORRECT):**
```javascript
async function deleteCategory(categoryId) {
  const restaurantId = localStorage.getItem("restaurantId");
  const response = await fetch(`/api/menu_categories/${categoryId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId })
  });
  return response.ok;
}
```

---

### 4. **admin-staff.js** - No Changes Needed
Already correctly scoped by `restaurantId` in URL paths.

---

### 5. **admin-tables.js** - Table Operations

All table operations now need `restaurantId`:

**Updated Code (CORRECT):**
```javascript
// Regenerate QR
async function regenerateTableQR(tableId) {
  const restaurantId = localStorage.getItem("restaurantId");
  const response = await fetch(`/api/tables/${tableId}/regenerate-qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId })
  });
  return response.json();
}

// Update table
async function updateTable(tableId, name, seatCount) {
  const restaurantId = localStorage.getItem("restaurantId");
  const response = await fetch(`/api/tables/${tableId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, seat_count: seatCount, restaurantId })
  });
  return response.json();
}

// Delete table
async function deleteTable(tableId) {
  const restaurantId = localStorage.getItem("restaurantId");
  const response = await fetch(`/api/tables/${tableId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId })
  });
  return response.ok;
}
```

---

### 6. **admin-orders.js** - Bill Closure

**Endpoint:** `POST /api/sessions/:sessionId/close-bill`

**Updated Code (CORRECT):**
```javascript
async function closeBill(sessionId, paymentData) {
  const restaurantId = localStorage.getItem("restaurantId");
  const response = await fetch(`/api/sessions/${sessionId}/close-bill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...paymentData,
      restaurantId
    })
  });
  return response.json();
}
```

---

## Helper Function

Create a reusable helper in `frontend/utils.js` or similar:

```javascript
/**
 * Make an authenticated request with restaurantId
 */
async function fetchWithRestaurant(url, options = {}) {
  const restaurantId = localStorage.getItem("restaurantId");
  
  if (!restaurantId && options.requireRestaurant !== false) {
    throw new Error("No restaurant ID found");
  }
  
  const body = options.body ? JSON.parse(options.body) : {};
  if (restaurantId) {
    body.restaurantId = restaurantId;
  }
  
  return fetch(url, {
    ...options,
    body: JSON.stringify(body)
  });
}

// Usage:
const response = await fetchWithRestaurant(`/api/tables/${tableId}`, {
  method: 'DELETE'
});
```

Or for query parameters:

```javascript
function addRestaurantId(url) {
  const restaurantId = localStorage.getItem("restaurantId");
  if (!restaurantId) throw new Error("No restaurant ID");
  
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}restaurantId=${restaurantId}`;
}

// Usage:
const response = await fetch(addRestaurantId('/api/kitchen/items'));
```

---

## Error Handling Pattern

Update error handling to catch new validation errors:

```javascript
async function apiCall(url, options) {
  try {
    const response = await fetch(url, options);
    
    if (response.status === 400) {
      const error = await response.json();
      if (error.error.includes("Restaurant ID")) {
        console.error("Missing restaurant context");
        // Redirect to login or show error
        return null;
      }
    }
    
    if (response.status === 404) {
      const error = await response.json();
      if (error.error.includes("doesn't belong to this restaurant")) {
        console.error("Access denied: Resource belongs to different restaurant");
        return null;
      }
    }
    
    if (!response.ok) {
      console.error(`API Error ${response.status}:`, await response.json());
      return null;
    }
    
    return await response.json();
  } catch (err) {
    console.error("Network error:", err);
    return null;
  }
}
```

---

## Summary of Changes by File

| Frontend File | Changes Needed | Endpoints Affected | Priority |
|---|---|---|---|
| kitchen.js | Add `restaurantId` query param | `GET /api/kitchen/items` | 🔴 CRITICAL |
| admin.js | Add `restaurantId` to body | Multiple | 🔴 CRITICAL |
| admin-menu.js | Add `restaurantId` to body | Menu operations | 🟠 HIGH |
| admin-tables.js | Add `restaurantId` to body | Table operations | 🟠 HIGH |
| admin-orders.js | Add `restaurantId` to body | Bill closure | 🟠 HIGH |
| admin-staff.js | None | Staff operations | ✅ DONE |
| admin-settings.js | Check if needed | Settings | 🟡 LOW |
| menu.js | Add `restaurantId` query | Customer menu | 🟡 LOW |

---

## Testing Checklist

After updating frontend:

- [ ] Kitchen staff can see orders for their restaurant only
- [ ] Admin can update tables for their restaurant
- [ ] Admin can delete menu items with proper validation
- [ ] Admin can close bills
- [ ] Cross-restaurant requests fail with 404
- [ ] Missing `restaurantId` fails with 400
- [ ] Console has no 400/404 errors for valid operations

---

## Deployment Order

1. ✅ Backend routes updated (DONE)
2. ⏳ Update frontend files (IN PROGRESS)
3. ⏳ Test locally
4. ⏳ Deploy to staging
5. ⏳ Deploy to production

