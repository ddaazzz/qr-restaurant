# Real-Time Auto-Print Setup Guide

## Overview

This implementation enables restaurants to automatically print QR codes when new table sessions are created in PostgreSQL, **without requiring users to be on the tables tab**. The system uses PostgreSQL's LISTEN/NOTIFY mechanism combined with WebSocket for real-time communication.

## Architecture

```
PostgreSQL Event → Backend LISTEN → WebSocket Broadcast → Frontend Auto-Print
   (trigger)      (sessionNotifier)  (webSocketServer)     (autoPrintClient)
```

## Components Implemented

### 1. Database Layer

**File:** `backend/migrations/043_add_session_notification_trigger.sql`

- **Function:** `notify_new_session()` 
  - Triggers on INSERT to `table_sessions`
  - Sends JSON payload with: `id`, `table_id`, `restaurant_id`, `pax`, `created_at`
  - Posts to PostgreSQL channel: `new_session`

- **Trigger:** `session_notification_trigger`
  - Fires AFTER INSERT on `table_sessions`
  - Ensures all new sessions emit notifications

### 2. Backend Services

#### SessionNotifier Service
**File:** `backend/src/services/sessionNotifier.ts`

```typescript
class SessionNotifier extends EventEmitter {
  async start() // Connect to PostgreSQL and LISTEN
  async stop()  // Cleanup on shutdown
  on('new-session', callback) // Event listener
}
```

**Features:**
- Separate PostgreSQL client for listening to NOTIFY events
- Deduplication: Tracks printed sessions to prevent duplicate prints
- Emits `new-session` events with session details
- Graceful shutdown handling

#### WebSocket Server
**File:** `backend/src/services/websocket.ts`

```typescript
class WebSocketServer {
  initialize(httpServer) // Setup Socket.IO on HTTP server
  broadcastSessionEvent(event) // Send to restaurant-specific rooms
}
```

**Features:**
- Uses Socket.IO for real-time communication
- Room-based isolation: Each restaurant has its own room
- Events only broadcast to subscribed clients
- Supports both WebSocket and polling transports

### 3. Server Integration

**File:** `backend/src/server.ts` (Modified)

```javascript
// Initialize on startup
webSocketServer.initialize(server);
await sessionNotifier.start();

// Cleanup on shutdown
process.on("SIGTERM", async () => {
  await sessionNotifier.stop();
  // ... other cleanup
});
```

### 4. Frontend WebSocket Client

**File:** `frontend/auto-print-websocket.js`

```javascript
class AutoPrintWebSocketClient {
  initialize(restaurantId, onNewSession) // Setup connection
  private handleAutoprint(event) // Trigger printing
  disconnect() // Cleanup
}
```

**Features:**
- Automatic reconnection with exponential backoff
- Per-restaurant event filtering via rooms
- Respects `auto_print` printer setting
- Suppresses alerts for silent auto-printing
- Health checks every 30 seconds

### 5. Admin Panel Integration

**File:** `frontend/admin.html` (Modified)

Added script includes:
```html
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
<script src="/auto-print-websocket.js"></script>
```

**File:** `frontend/admin.js` (Modified)

Added initialization in DOMContentLoaded:
```javascript
if (typeof autoPrintClient !== 'undefined' && restaurantId) {
  autoPrintClient.initialize(parseInt(restaurantId));
}
```

## Flow Diagram

1. **Session Creation**
   - User clicks "Start Session" in tables tab
   - API POST `/api/table-sessions` creates session in database
   - PostgreSQL trigger fires automatically

2. **PostgreSQL Notification**
   - `notify_new_session()` function sends JSON to 'new_session' channel
   - Status: NOTIFY sent by database

3. **Backend Reception**
   - SessionNotifier listening on 'new_session' channel
   - Receives notification with session details
   - Emits `new-session` event to WebSocket server

4. **WebSocket Broadcast**
   - WebSocketServer receives event from SessionNotifier
   - Broadcasts to room: `restaurant-{restaurantId}-auto-print`
   - All connected clients for that restaurant receive event

5. **Frontend Processing**
   - AutoPrintWebSocketClient receives `new-session` event
   - Calls `handleAutoprint()` 
   - Fetches printer settings from backend
   - Checks if `auto_print` is enabled
   - Calls `printQR(sessionId, true)` silently (no alerts)

6. **Printing**
   - QR code is generated via backend API
   - Routed to Bluetooth printer via printer-routing.js
   - User receives printed QR code at table

## Configuration

### Enable/Disable Auto-Print

1. Go to Admin Panel → Settings → Printers
2. Find "QR" printer
3. Toggle "Auto Print on New Session" setting
4. Setting is saved to printer's `settings` column in database

### Environment Variables (Optional)

In `.env` or via Render:
```bash
# WebSocket configuration (defaults work in most cases)
# SOCKET_IO_PORT=10000  # Uses same port as backend
# SOCKET_IO_ORIGIN="*"  # Allow all origins (restrict in production)
```

## Installation & Setup

### 1. Install Dependencies

In `backend/package.json`, `socket.io` is already added:

```bash
cd backend
npm install
# or if using render, it installs automatically
```

### 2. Run Migration

Execute migration 043 to create the trigger:

```bash
cd backend
npm run migrate
```

Or manually:
```sql
psql $DATABASE_URL < migrations/043_add_session_notification_trigger.sql
```

### 3. Restart Backend

The server will automatically:
- Initialize WebSocket server
- Start SessionNotifier listening to PostgreSQL

```bash
npm run dev
# or on production, deployment will restart automatically
```

### 4. Test Functionality

1. Open Admin Panel in browser A (will connect WebSocket)
2. Open Tables section in Admin Panel in browser B
3. Create a new session in browser B
4. **Expected:** Browser A receives `new-session` event and prints QR code
5. **Verify:** Check browser console for `[AutoPrint]` messages

## Monitoring & Debugging

### Backend Logs

When enabled, you'll see:

```
[WebSocket] Server initialized
[SessionNotifier] Connected to PostgreSQL
[SessionNotifier] Listening for new_session notifications
[SessionNotifier] New session detected: { id: 123, table_id: 5, ... }
[WebSocket] Broadcasting new session to restaurant-42-auto-print: { ... }
```

### Frontend Console

Look for `[AutoPrint]` prefixed messages:

```javascript
[AutoPrint] Connecting to WebSocket at https://localhost:10000
[AutoPrint] WebSocket connected
[AutoPrint] Subscribed to restaurant 42
[AutoPrint] Received new-session event: { sessionId: 123, ... }
[AutoPrint] Auto-printing QR code for session 123
```

### Test Notifications

In browser console while on admin panel:

```javascript
// Manually trigger a test notification
autoPrintClient.testNotification({
  sessionId: 999,
  tableId: 5,
  restaurantId: 42,
  pax: 2,
  createdAt: new Date().toISOString()
});
```

## Troubleshooting

### WebSocket Connection Fails

**Error:** `[AutoPrint] Connecting to WebSocket at ... (fails silently)`

**Check:**
1. Backend is running: `https://localhost:10000` accessible?
2. Socket.IO library loaded: Check if `io` is defined in console
3. CORS settings: Check `webSocketServer.initialize()` in server.ts

**Fix:**
```javascript
// In websocket.ts, ensure cors origin allows frontend
cors: {
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
}
```

### PostgreSQL Notification Not Received

**Error:** `[SessionNotifier] Not connected` or no notifications logged

**Check:**
1. Migration 043 applied: `psql $DATABASE_URL -c "SELECT * FROM pg_trigger WHERE tgname = 'session_notification_trigger';"`
2. SessionNotifier service started: Check server logs for `[SessionNotifier] Listening...`
3. Database connection string correct: `DATABASE_URL` env var set

**Fix:**
```bash
# Re-run migration
psql $DATABASE_URL < backend/migrations/043_add_session_notification_trigger.sql

# Restart backend
npm run dev
```

### Auto-Print Enabled but QR Not Printing

**Check:**
1. Printer setting is enabled:
   ```javascript
   // In admin console:
   fetch('/api/printer-settings/42').then(r => r.json()).then(console.log)
   // Look for QR printer with settings.auto_print: 'true'
   ```

2. QR printer connected and registered
3. `printQR()` function available: `typeof printQR === 'function'`

**Fix:** Ensure printer settings are saved and QR printer is configured

### Duplicate Prints

**Issue:** Same QR code prints multiple times

**Cause:** SessionNotifier deduplication isn't working

**Fix:** Check that `markPrinted()` is being called

```javascript
// In WebSocket handler, after successful print:
sessionNotifier.markPrinted(eventData.sessionId);
```

## Performance Considerations

### Scalability

- **WebSocket:** Scales to thousands of concurrent connections
- **PostgreSQL LISTEN:** Broadcasts within single database instance
- **Room-based filtering:** Reduces message overhead per restaurant

### Memory Usage

- SessionNotifier tracks printed sessions (grows over time)
- **Cleanup:** Implement periodic clearing for long-running servers

```javascript
// Optional: Clear old printed sessions daily
setInterval(() => {
  sessionNotifier.clearPrinted();
  console.log('[SessionNotifier] Cleared printed sessions cache');
}, 24 * 60 * 60 * 1000); // Daily
```

## Multi-Restaurant Support

The system automatically handles multiple restaurants:

1. Each WebSocket client subscribes to its restaurant ID room
2. Notifications filtered by `restaurant_id` in trigger payload
3. Only clients subscribed to that restaurant receive the notification
4. Each printer has independent `auto_print` setting per restaurant

## Security Considerations

1. **Authentication:** WebSocket events respect user's `restaurantId` token
2. **CORS:** Configure specific origins in production:
   ```typescript
   cors: {
     origin: process.env.FRONTEND_URLS?.split(','),
     credentials: true
   }
   ```
3. **Data:** Notification payloads don't include sensitive info beyond session/table/restaurant IDs

## Future Enhancements

1. **Bill Auto-Print:** Extend for automatic bill printing on payment
2. **Kitchen Notifications:** Alert kitchen staff of new orders via WebSocket
3. **Queue Management:** Show real-time session queue without tab switch
4. **Audit Trail:** Log all auto-print events with timestamps
5. **Analytics Dashboard:** Track auto-print success rates

## Rollback Instructions

If issues occur, rollback is simple:

1. **Disable PostgreSQL Trigger:**
   ```sql
   DROP TRIGGER session_notification_trigger ON table_sessions;
   ```

2. **Remove WebSocket Initialization:** Comment out in server.ts
3. **Disable Frontend WebSocket:** Remove script tag from admin.html
4. Auto-print falls back to original behavior (manual print button only)

## Summary

The real-time auto-print system successfully decouples the printing action from the UI tab requirement. Users can now:

✅ Create sessions from any interface (tables tab, API, etc.)
✅ Printers automatically receive QR codes without manual action
✅ Admin can be on different section (orders, menu, settings) and still auto-print
✅ Works across multiple browser tabs/windows simultaneously
✅ Respects per-restaurant printer settings
✅ Maintains session history without duplicate prints

---

**Contact:** For issues or feature requests, check the conversation summary or backend logs.
