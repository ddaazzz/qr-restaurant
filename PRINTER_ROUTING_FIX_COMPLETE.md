# Printer Routing Fix - API Integration Complete

## Problem Identified
The frontend was calling non-existent backend endpoints:
- `/print-network` ❌
- `/print-bluetooth` ❌  
- `/print-html` ❌

These endpoints don't exist in the backend, causing 404 errors.

## Solution Implemented
Updated the frontend to use the **correct backend endpoints** that already exist and properly handle HTML generation and printer routing:

### Backend Endpoints (Already Implemented)
1. **`POST /api/restaurants/{id}/print-qr`**
   - Generates QR code print HTML internally
   - Handles printer routing (browser, network, bluetooth, queue)
   - Returns pre-formatted HTML matching preview

2. **`POST /api/restaurants/{id}/print-order`**
   - Generates kitchen order/receipt HTML internally
   - Supports `orderType` parameter (kitchen, bill)
   - Handles printer routing
   - Returns pre-formatted HTML or queued job ID

3. **`POST /api/restaurants/{id}/print-bill`**
   - Generates bill/receipt HTML internally
   - Takes `sessionId` and `billData` as parameters
   - Handles printer routing
   - Returns pre-formatted HTML matching preview

## Files Updated

### Frontend Changes
1. **`printer-routing.js`** (Rewrote)
   - New functions that call correct backend endpoints:
     - `printQRCode(restaurantId, sessionId, tableId, tableName, qrToken)`
     - `printOrder(restaurantId, orderId)` 
     - `printBillReceipt(restaurantId, sessionId)`
     - `handleBrowserPrint(htmlContent)` - fallback for browser printing
   - Removed non-existent endpoint calls

2. **`admin-tables.js`**
   - `printQR()` → Now calls `printQRCode()` with proper parameters
   - `printBill()` → Now calls `printBillReceipt()` with session ID
   - Removed local HTML generation (backend handles it now)

3. **`admin-orders.js`**
   - `printReceipt()` → Now calls `printOrder()` with order ID
   - Removed local HTML generation

4. **`admin-settings.js`**
   - `printQRCode()` → Calls `handleBrowserPrint()` for fallback
   - Keeps canvas-based QR in browser print

5. **`kitchen-printing.js`**
   - `printKitchenOrder()` → Now calls `printOrder()`with order ID
   - Removed local HTML generation

### Why This Fix Works
1. **Unified Format** - All print functions now generate consistent HTML format from the backend
2. **Database Integration** - Backend fetches actual data and generates contextually correct HTML
3. **Printer Configuration** - Backend handles printer routing based on restaurant settings
4. **Single Source of Truth** - HTML format is generated server-side, ensuring consistency between web and mobile

## Print Flow (Fixed)
```
1. User clicks "Print" button
2. Frontend calls backend endpoint with required data:
   - printQRCode() → POST /print-qr (sessionId, tableId, tableName, qrToken)
   - printOrder() → POST /print-order (orderId)
   - printBillReceipt() → POST /print-bill (sessionId)
3. Backend:
   - Fetches data from database
   - Generates properly formatted HTML
   - Routes to configured printer (network/bluetooth/browser)
   - Returns result to frontend
4. Frontend:
   - Opens browser print dialog if HTML returned
   - Or shows success message if queued
```

## Consistency Guarantees
✅ **Web and Mobile Print the Same HTML** - Both call same backend endpoints
✅ **Matches Preview Format** - Backend generates consistent formatting
✅ **Proper Data Integration** - Uses actual database values
✅ **Automatic Printer Routing** - Backend handles network/bluetooth routing
✅ **Error Handling** - Backend returns proper error messages

## Testing Checklist
- [ ] QR codes print from table management
- [ ] Bills print from table sessions  
- [ ] Order receipts print from orders page
- [ ] Kitchen orders print correctly
- [ ] Browser fallback works with no printer
- [ ] Network printer routing works
- [ ] Bluetooth requests handled properly
- [ ] Same format on web and mobile (if mobile is available)
- [ ] Preview format matches printed format

## API Contract (Frontend → Backend)

### Print QR Code
```javascript
POST /api/restaurants/{restaurantId}/print-qr
{
  sessionId: number,
  tableId: number,
  tableName: string,
  qrToken: string,
  priority?: number (default: 10)
}

Response:
{
  success: true,
  html?: string,           // For browser printing
  bluetoothPayload?: {},   // For client-side BT printing
  jobId?: string          // For queued printing
}
```

### Print Order/Kitchen
```javascript
POST /api/restaurants/{restaurantId}/print-order
{
  orderId: number,
  orderType?: "kitchen" | "bill" (default: "kitchen"),
  priority?: number (default: 0)
}

Response:
{
  success: true,
  html?: string,      // For browser printing
  jobId?: string     // For queued printing
}
```

### Print Bill
```javascript
POST /api/restaurants/{restaurantId}/print-bill  
{
  sessionId: number,
  billData?: {},  // Optional, backend can fetch from DB
  priority?: number (default: 5)
}

Response:
{
  success: true,
  html?: string,      // For browser printing
  jobId?: string     // For queued printing
}
```

## Next Steps
1. Verify all print functions work with backend endpoints
2. Test network/bluetooth printer routing
3. Ensure no 404 errors in console
4. Verify printed format matches preview
5. Test on mobile app if available
