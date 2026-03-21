# Database Query & Payload Fix Summary

## Problem
After implementing persistent Bluetooth sessions, the print API was returning a 500 error:
- Error: `relation "sessions" does not exist`
- Root cause: Backend trying to query non-existent table and fields

## Root Cause Analysis
**Backend Code Issue (printer.routes.ts line 435):**
```javascript
// WRONG:
SELECT pax, created_at FROM sessions WHERE id = $1

// ACTUAL DATABASE STRUCTURE:
- Table name: table_sessions (not sessions)
- Fields: id, table_id, started_at, ended_at (NO pax field)
- NO created_at field (use started_at instead)
```

## Changes Made

### 1. Backend Fix (printer.routes.ts)
**Lines 430-444:**
- Changed table name from `sessions` to `table_sessions`
- Changed SELECT fields from `pax, created_at` to `ts.started_at, t.name`
- Added LEFT JOIN to tables to get table name
- Removed non-existent `pax` field from query

**Lines 467-478:**
- Removed `pax: pax` from qrPayload
- Now only includes: type, restaurantName, tableName, startedTime, qrToken, textAboveQR, textBelowQR

### 2. Frontend Fix (printer-routing.js)
**Lines 97-193:**
- Updated `generateESCPOS()` function signature to accept optional format parameter
- Added conditional logic to handle QR format differently from standard receipts
- QR format now correctly uses: tableName, startedTime, qrToken, textAboveQR, textBelowQR
- Standard format continues to support: orderNumber, items, totals, etc.

## Result
✅ Database query will now succeed (correct table and fields)
✅ QR receipts will print with correct format (Table, Started Time, QR Code, Text)
✅ Bluetooth session persists between prints without errors

## Testing
To verify the fix:
1. Open Printer Settings in admin panel
2. Select a printer and scan for Bluetooth devices
3. Initialize a Bluetooth session
4. Click "Print QR" button in admin-tables.js
5. Verify: ✅ No 500 error, ✅ Print dialog appears or fallback to browser print
