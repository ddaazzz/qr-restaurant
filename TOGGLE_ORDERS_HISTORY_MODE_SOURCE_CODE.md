# toggleOrdersHistoryMode() - Complete Source Code Extract

## Function: toggleOrdersHistoryMode()

**Location:** [admin-orders.js](admin-orders.js#L746)  
**Lines:** 746-796  
**Type:** Async Function  
**Dependencies:** `loadOrdersHistoryLeftPanel()`

### Complete Function Source

```javascript
// LINE 746
async function toggleOrdersHistoryMode() {
  // LINE 747: Toggle the boolean state
  ORDERS_HISTORY_MODE = !ORDERS_HISTORY_MODE;
  
  // LINES 748-751: Query DOM elements
  const historyView = document.getElementById('orders-history-left-view');
  const detailsView = document.getElementById('orders-details-view');
  const leftColumnWrapper = document.querySelector('.orders-container > .left-column-wrapper');
  const ordersContainer = document.querySelector('.orders-container');
  
  // LINE 753: Check if entering history mode
  if (ORDERS_HISTORY_MODE) {
    // LINE 755: ENTERING HISTORY MODE
    // Show history view
    // LINE 756: Add 'active' class to left panel
    historyView.classList.add('active');
    
    // Show details view
    // LINE 759: Add 'active' class to right panel
    detailsView.classList.add('active');
    
    // Hide the menu/cart section
    // LINE 762-763: Set inline style to hide
    if (leftColumnWrapper) {
      leftColumnWrapper.style.display = 'none';
    }
    
    // Add history mode class to container for CSS layout changes
    // LINE 767-768: ✅ KEY LINE - ADD 'history-mode' CLASS
    if (ordersContainer) {
      ordersContainer.classList.add('history-mode');
    }
    
    // LINE 770: Load history data (async)
    await loadOrdersHistoryLeftPanel();
    
    // LINE 772-775: Set empty state
    const detailsContent = document.getElementById('order-details-content');
    if (detailsContent) {
      detailsContent.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Select an order to view details</p>';
    }
  } else {
    // LINE 777: EXITING HISTORY MODE (else branch)
    // Hide history view
    // LINE 779: Remove 'active' class from left panel
    historyView.classList.remove('active');
    
    // Hide details view
    // LINE 782: Remove 'active' class from right panel
    detailsView.classList.remove('active');
    
    // Restore the menu/cart section
    // LINE 785-786: Set inline style to show
    if (leftColumnWrapper) {
      leftColumnWrapper.style.display = 'flex';
    }
    
    // Remove history mode class from container
    // LINE 790-791: ✅ KEY LINE - REMOVE 'history-mode' CLASS
    if (ordersContainer) {
      ordersContainer.classList.remove('history-mode');
    }
    
    // LINE 794: Clear the tracked order ID
    VIEWING_HISTORICAL_ORDER = null;
  }
}
```

---

## Related Functions

### Function: loadOrdersHistoryLeftPanel()

**Location:** [admin-orders.js](admin-orders.js#L811)  
**Lines:** 811-1020  
**Called by:** `toggleOrdersHistoryMode()` at line 770  
**Purpose:** Fetch and render order history in left panel

**Called By:**
- `toggleOrdersHistoryMode()` - Line 770
- `submitPayNowOrder()` - Line 604
- `submitToGoOrder()` - Line 652
- `setOrderHistoryFilter()` - Line 1029

```javascript
// LINE 811
async function loadOrdersHistoryLeftPanel() {
  const historyListLeft = document.getElementById('orders-history-list-left');
  if (!historyListLeft) return;
  
  historyListLeft.innerHTML = '<p style="color: #999; text-align: center; padding: 12px;">Loading...</p>';
  
  try {
    // If sessions tab is selected, load sessions instead
    if (ORDER_HISTORY_FILTER === 'sessions') {
      // ... session loading code ...
      return;
    }
    
    // Load orders for other tabs
    const response = await fetch(`${API}/restaurants/${restaurantId}/orders?limit=100`);
    if (!response.ok) throw new Error('Failed to load order history');
    
    const orders = await response.json();
    ALL_ORDERS_DATA = orders || [];
    
    // ... render orders in historyListLeft ...
  } catch (err) {
    console.error('Error loading order history:', err);
    historyListLeft.innerHTML = `<p style="color: #ef4444; text-align: center; padding: 12px;">Error loading history</p>`;
  }
}
```

### Function: closeDetailsView()

**Location:** [admin-orders.js](admin-orders.js#L800)  
**Lines:** 800-809  
**Purpose:** Close details panel and show history list

```javascript
// LINE 800
function closeDetailsView() {
  // Hide details and show history instead
  const detailsView = document.getElementById('orders-details-view');
  const historyView = document.getElementById('orders-history-left-view');
  
  if (detailsView) {
    detailsView.classList.remove('active');
  }
  if (historyView) {
    historyView.classList.add('active');
  }
}
```

**Note:** This function only manages the `active` class, NOT the `history-mode` class

---

## Global State Declaration

**Location:** [admin-orders.js](admin-orders.js#L1-L15)

```javascript
// ============= ORDERS MODULE =============
// Order management for staff to place customer orders

// Global state for orders
let ORDERS_CART = [];
let ORDERS_CART_EDIT_MODE = false;
let ORDERS_TABLES = [];
let CURRENT_ORDER_TYPE = null;
let ORDERS_CATEGORIES = [];
let SELECTED_ORDERS_CATEGORY = null;
let ORDER_HISTORY_FILTER = 'all'; // Filter for order history tabs: 'all', 'table', 'order-now', 'to-go', 'sessions'
let ALL_ORDERS_DATA = []; // Store all orders for filtering
let ALL_SESSIONS_DATA = []; // Store all sessions for display
let ORDERS_MENU_ITEMS = [];
let ORDERS_HISTORY_MODE = false;  // ← LINE 15: Toggle state for history mode

// ⚠️ MISSING DECLARATION (should be added):
// let VIEWING_HISTORICAL_ORDER = null;  // Track currently viewed historical order
```

---

## HTML Structure

**Location:** [admin-orders.html](admin-orders.html)

```html
<!-- LINE 3 -->
<div class="orders-container">
  
  <!-- Left column: Menu and Cart (hidden in history mode) -->
  <div class="left-column-wrapper">
    <div class="orders-main-wrapper">
      <div id="orders-menu-items" class="orders-menu-grid">
        <!-- Menu items rendered here -->
      </div>
    </div>
    
    <div class="orders-right-panel">
      <div id="orders-cart-view-container">
        <!-- Cart items -->
      </div>
    </div>
  </div>
  
  <!-- LINE 9: History View (shown only when active + history-mode) -->
  <div id="orders-history-left-view" class="orders-history-view">
    <div id="orders-history-list-left">
      <!-- Order list populated by loadOrdersHistoryLeftPanel() -->
    </div>
  </div>
  
  <!-- LINE 13: Details View (shown only when active + history-mode) -->
  <div id="orders-details-view" class="orders-details-view">
    <div class="orders-details-header">
      <div id="order-details-title"></div>
      <button onclick="closeDetailsView()" class="close-btn">✕</button>
    </div>
    <div id="order-details-content">
      <!-- Order details rendered here -->
    </div>
  </div>
  
</div>
```

---

## CSS Rules

**Location:** [admin-orders.css](admin-orders.css#L1-L43)

```css
/* ============== ORDERS CONTAINER ============== */
/* LINE 5 */
.orders-container {
  display: flex;
  flex-direction: row;
  gap: 0;
  margin-top: 0;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  align-items: stretch;
  position: relative;
  overflow: hidden;
}

/* LINE 20: When history mode is INACTIVE */
.orders-container:not(.history-mode) {
  flex-direction: column;
  gap: 12px;
}

/* LINE 26: When history mode IS ACTIVE */
.orders-container.history-mode {
  flex-direction: row;
  gap: 0;
}

/* LINE 31: History left panel styling (when in history mode) */
.orders-container.history-mode #orders-history-left-view.active {
  flex: 0 0 50%;
  width: 50%;
  margin-left: 0;
  order: 1;
}

/* LINE 38: Details right panel styling (when in history mode) */
.orders-container.history-mode #orders-details-view.active {
  flex: 0 0 50%;
  width: 50%;
  order: 2;
}

/* LINE 43: Left column wrapper (menu/cart area) */
.orders-container > .left-column-wrapper {
    display: flex;
    flex-direction: row;
    gap: 0;
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    margin-top: 0;
    margin-left: 0px;
    position: relative;
  }
```

---

## Execution Trace with Line Numbers

### Entering History Mode (First Call)

```
toggleOrdersHistoryMode() called
│
├─ Line 747: ORDERS_HISTORY_MODE = !false = true ✅
├─ Line 748: historyView = document.getElementById('orders-history-left-view') ✅
├─ Line 749: detailsView = document.getElementById('orders-details-view') ✅
├─ Line 750: leftColumnWrapper = document.querySelector('.orders-container > .left-column-wrapper') ✅
├─ Line 751: ordersContainer = document.querySelector('.orders-container') ✅
├─ Line 753: if (ORDERS_HISTORY_MODE) → TRUE ✓
├─ Line 756: historyView.classList.add('active') ✅
├─ Line 759: detailsView.classList.add('active') ✅
├─ Line 762-763: leftColumnWrapper.style.display = 'none' ✅
├─ Line 767-768: ordersContainer.classList.add('history-mode') ✅ KEY LINE
├─ Line 770: await loadOrdersHistoryLeftPanel() ✅ Async operation
├─ Line 772: detailsContent = document.getElementById('order-details-content') ✅
└─ Line 773: detailsContent.innerHTML = '...' ✅
```

### Exiting History Mode (Second Call)

```
toggleOrdersHistoryMode() called
│
├─ Line 747: ORDERS_HISTORY_MODE = !true = false ✅
├─ Line 748-751: Query elements ✅
├─ Line 753: if (ORDERS_HISTORY_MODE) → FALSE ✗ (else branch)
├─ Line 779: historyView.classList.remove('active') ✅
├─ Line 782: detailsView.classList.remove('active') ✅
├─ Line 785-786: leftColumnWrapper.style.display = 'flex' ✅
├─ Line 790-791: ordersContainer.classList.remove('history-mode') ✅ KEY LINE
└─ Line 794: VIEWING_HISTORICAL_ORDER = null ✅
```

---

## Class & Style Summary

### Classes Added (Entering Mode)

| Line | Element | Action | Class |
|------|---------|--------|-------|
| 756 | `#orders-history-left-view` | add | `active` |
| 759 | `#orders-details-view` | add | `active` |
| 768 | `.orders-container` | add | `history-mode` |

### Classes Removed (Exiting Mode)

| Line | Element | Action | Class |
|------|---------|--------|-------|
| 779 | `#orders-history-left-view` | remove | `active` |
| 782 | `#orders-details-view` | remove | `active` |
| 791 | `.orders-container` | remove | `history-mode` |

### Inline Styles Set

| Line | Element | Property | Enter Value | Exit Value |
|------|---------|----------|------------|-----------|
| 763 | `.left-column-wrapper` | display | `none` | — |
| 786 | `.left-column-wrapper` | display | — | `flex` |

---

## Variables Modified

```
ORDERS_HISTORY_MODE
├─ Initial: false (Line 15)
├─ After 1st call: true (Line 747)
└─ After 2nd call: false (Line 747)

VIEWING_HISTORICAL_ORDER
├─ Initial: undefined (not declared - BUG!)
├─ When selecting order: set to orderId (Line 1298)
└─ When exiting history mode: null (Line 794)
```

---

## DOM State Changes

### Before Any Call

```html
<div class="orders-container">
  <div class="left-column-wrapper"><!-- content --></div>
  <div id="orders-history-left-view"></div>
  <div id="orders-details-view"></div>
</div>
```

### After First Call (Entering History Mode)

```html
<div class="orders-container history-mode">
  <div class="left-column-wrapper" style="display: none;"><!-- content --></div>
  <div id="orders-history-left-view" class="active"><!-- orders list --></div>
  <div id="orders-details-view" class="active"><!-- order details --></div>
</div>
```

### After Second Call (Exiting History Mode)

```html
<div class="orders-container">
  <div class="left-column-wrapper" style="display: flex;"><!-- content --></div>
  <div id="orders-history-left-view"></div>
  <div id="orders-details-view"></div>
</div>
```

---

## Key Lines Reference

| Reference | Line(s) | Description |
|-----------|---------|-------------|
| Function Definition | 746-796 | Complete function |
| Toggle Flag | 747 | `ORDERS_HISTORY_MODE = !ORDERS_HISTORY_MODE` |
| Query Elements | 748-751 | Get DOM elements |
| Conditional Check | 753 | `if (ORDERS_HISTORY_MODE)` |
| Add Active (Left) | 756 | `historyView.classList.add('active')` |
| Add Active (Right) | 759 | `detailsView.classList.add('active')` |
| Hide Menu | 763 | `leftColumnWrapper.style.display = 'none'` |
| **ADD history-mode** | **768** | `ordersContainer.classList.add('history-mode')` ✅ |
| Load History | 770 | `await loadOrdersHistoryLeftPanel()` |
| Set Placeholder | 773 | `detailsContent.innerHTML = ...` |
| Remove Active (Left) | 779 | `historyView.classList.remove('active')` |
| Remove Active (Right) | 782 | `detailsView.classList.remove('active')` |
| Show Menu | 786 | `leftColumnWrapper.style.display = 'flex'` |
| **REMOVE history-mode** | **791** | `ordersContainer.classList.remove('history-mode')` ✅ |
| Clear Variable | 794 | `VIEWING_HISTORICAL_ORDER = null` |

---

## Conclusion

✅ **The function is correctly implemented**
- Line 768: Correctly adds `history-mode` class
- Line 791: Correctly removes `history-mode` class
- No other functions modify this class
- CSS rules work as expected

✅ **No functional issues detected**

⚠️ **One code quality issue:** Missing `let VIEWING_HISTORICAL_ORDER = null;` declaration
