# Real-Time Auto-Print Implementation - Verification & Setup Checklist

## ✅ Implementation Status

### Files Created
- [x] `backend/migrations/043_add_session_notification_trigger.sql` - PostgreSQL trigger
- [x] `backend/src/services/sessionNotifier.ts` - Database listener service
- [x] `backend/src/services/websocket.ts` - WebSocket broadcast service
- [x] `frontend/auto-print-websocket.js` - Frontend WebSocket client

### Files Modified
- [x] `backend/src/server.ts` - Added WebSocket & SessionNotifier initialization
- [x] `backend/package.json` - Added socket.io dependency
- [x] `frontend/admin.html` - Added Socket.IO library and auto-print-websocket script
- [x] `frontend/admin.js` - Added autoPrintClient initialization

### Documentation
- [x] `REAL_TIME_AUTOPRINT_SETUP.md` - Comprehensive setup guide

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
cd backend
npm install socket.io
```

### Step 2: Run Migration

```bash
# Run all pending migrations (includes 043)
npm run migrate

# Or manually run just migration 043:
psql $DATABASE_URL < migrations/043_add_session_notification_trigger.sql
```

### Step 3: Restart Backend

```bash
npm run dev
# Look for these success messages:
# ✅ WebSocket server initialized
# ✅ Session notifier started (listening to PostgreSQL NOTIFY)
```

### Step 4: Test

1. Open admin panel: `https://localhost:10000/admin.html`
2. Open developer console (F12)
3. Look for `[AutoPrint] WebSocket connected` message
4. Create a new session from tables tab
5. Check console for `[AutoPrint] Received new-session event`
6. QR should automatically print to connected Bluetooth printer

## 🔍 Verification Checklist

### Backend Checklist

```bash
# 1. Verify migration ran successfully
psql $DATABASE_URL -c "SELECT * FROM information_schema.tables WHERE table_name = 'table_sessions';"

# 2. Verify trigger was created
psql $DATABASE_URL -c "SELECT * FROM pg_trigger WHERE tgname = 'session_notification_trigger';"

# 3. Check function exists
psql $DATABASE_URL -c "SELECT * FROM pg_proc WHERE proname = 'notify_new_session';"

# 4. Verify socket.io is installed
cd backend && npm list socket.io
```

### Frontend Checklist

In browser developer console while on admin panel:

```javascript
// 1. Verify Socket.IO is loaded
typeof io !== 'undefined' // Should be 'function'

// 2. Verify auto-print client is loaded
typeof autoPrintClient !== 'undefined' // Should be 'object'

// 3. Check WebSocket connection status
autoPrintClient.isConnected() // Should be true

// 4. Manually trigger test notification
autoPrintClient.testNotification({
  sessionId: 999,
  tableId: 1,
  restaurantId: parseInt(localStorage.getItem('restaurantId')),
  pax: 2,
  createdAt: new Date().toISOString()
});
```

## 📋 Data Flow Verification

### 1. Create Session and Monitor Database

```bash
# Terminal 1: Listen for notifications
psql $DATABASE_URL -c "LISTEN new_session; SELECT 1;" &

# Terminal 2: Create a test session
psql $DATABASE_URL -c "
  INSERT INTO table_sessions (table_id, restaurant_id, pax, created_at)
  VALUES (42, 1, 2, NOW())
  RETURNING *;
"

# You should see the notification in Terminal 1
```

### 2. Monitor Backend Logs

Watch backend output for:
```
[SessionNotifier] New session detected: { id: XXX, table_id: YYY, ... }
[WebSocket] Broadcasting new session to restaurant-1-auto-print: { ... }
```

### 3. Monitor Frontend Console

While on admin panel, create a session and watch for:
```
[AutoPrint] Received new-session event: { sessionId: 123, tableId: 5, ... }
[AutoPrint] Auto-printing QR code for session 123
```

## 🎯 Common Issues & Fixes

### Issue: WebSocket Not Connected

**Symptoms:** `[AutoPrint] WebSocket connected` never appears

**Fix:**
1. Check backend is running: `https://localhost:10000/api/restaurants`
2. Check Socket.IO accessible: `https://localhost:10000/socket.io/`
3. Check CORS: Browser console for CORS errors
4. Restart backend

### Issue: Notifications Not Received

**Symptoms:** Session created but no `[AutoPrint]` log messages

**Fix:**
1. Verify migration ran: `SELECT * FROM pg_trigger WHERE tgname = 'session_notification_trigger'`
2. Verify SessionNotifier started: Check backend logs for success message
3. Verify client is subscribed: Check for `[AutoPrint] Subscribed to restaurant NNN`

### Issue: Auto-Print Not Triggering

**Symptoms:** Notifications received but QR not printing

**Fix:**
1. Check printer setting enabled:
   ```javascript
   fetch('/api/printer-settings/' + localStorage.getItem('restaurantId'))
     .then(r => r.json())
     .then(printers => printers.find(p => p.type === 'QR'))
     .then(qr => console.log('Auto print:', qr?.settings?.auto_print))
   ```
2. Verify QR printer is registered and connected
3. Check blue  Check `[AutoPrint] Auto-printing QR code` message in console

## 📊 Performance Metrics

After implementation, you should see:

| Metric | Expected |
|--------|----------|
| WebSocket connection time | < 100ms |
| PostgreSQL notification latency | < 50ms |
| Backend broadcast delay | < 10ms |
| Frontend auto-print trigger latency | < 200ms |
| Total time from session creation to print | < 500ms |

## 🔒 Security Verification

- [ ] WebSocket only broadcasts to subscribed restaurant rooms
- [ ] Session notifications don't expose menu/pricing data
- [ ] Token-based authentication validated for printer settings access
- [ ] CORS properly configured in production

## 🧪 Test Scenarios

### Scenario 1: Basic Auto-Print
1. Admin on tables tab, QR printer connected, auto-print enabled
2. Create session
3. ✅ QR prints without manual action

### Scenario 2: Cross-Tab Auto-Print
1. Admin tab 1: On settings/menu section
2. Admin tab 2: Create session from tables
3. ✅ Admin tab 1 receives notification and prints QR

### Scenario 3: Multi-Restaurant
1. Two restaurants registered
2. Create session in restaurant A
3. ✅ Only restaurant A's connected clients print
4. ✅ Restaurant B's clients don't receive notification

### Scenario 4: Auto-Print Disabled
1. Disable auto-print in printer settings
2. Create session
3. ✅ No automatic print (notification received but ignored)

### Scenario 5: Connection Resilience
1. Create session with WebSocket connected
2. ✅ Prints automatically
3. Disconnect/reconnect WebSocket
4. Create another session
5. ✅ Prints automatically after reconnect

## 📝 Next Steps

1. Run migration: `npm run migrate` in backend
2. Restart backend: `npm run dev`
3. Test in browser using verification checklist above
4. Monitor logs for 24 hours to ensure stability
5. If issues, check REAL_TIME_AUTOPRINT_SETUP.md troubleshooting section

## ⚠️ Important Notes

- Migration is idempotent (safe to run multiple times)
- SessionNotifier deduplicates prints automatically
- WebSocket connections auto-reconnect on failure
- System degrades gracefully if WebSocket unavailable (manual print still works)
- No data loss on backend restart (database trigger persists)

---

**Last Updated:** [Auto-generated on implementation]
**Status:** ✅ Ready for Integration Testing
