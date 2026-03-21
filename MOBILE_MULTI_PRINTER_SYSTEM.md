# Multi-Printer & Auto-Print System Documentation

## Overview

The mobile app now has a comprehensive multi-printer support system that mirrors the web app's architecture with added capabilities for Bluetooth device management, persistent sessions, and auto-printing.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Kitchen Dashboard                        │
│  - Print Order (Manual)                                     │
│  - Auto-Print Subscription (Real-Time)                      │
│  - Connection Status Display                                │
└──────┬──────────────────────────────────────────────────────┘
       │
       ├─→ printerSessionService (Multi-Device Sessions)
       │   └─→ printerDeviceStorageService (AsyncStorage Persistence)
       │
       ├─→ bluetoothService (BLE Connection Management)
       │   └─→ Device Connection Monitoring
       │
       ├─→ printQueueService (Retry Queue)
       │   └─→ Failed Print Job Management
       │
       ├─→ printerAutoConnectService (Exponential Backoff)
       │   └─→ Automatic Reconnection Logic
       │
       ├─→ printerAutoPrintService (Real-Time Orders)
       │   └─→ Kitchen Order Polling (2-3s interval)
       │
       └─→ printerSettingsService (Backend Config)
           └─→ Get Configured Printers by Type
```

## Services

### 1. **printerSessionService.ts** - Multi-Device Session Manager
Maintains in-memory and persistent sessions for each printer type (QR, Bill, Kitchen).

**Features:**
- Multiple devices per printer type
- Persistent device selection to AsyncStorage
- Auto-reconnect trigger on disconnect
- Session diagnostics and status tracking

**Key Methods:**
```typescript
// Initialize and load saved devices
await printerSessionService.loadSavedDevices();

// Store session with multi-device support
await printerSessionService.setSession('kitchen', {
  deviceId: 'AA:BB:CC:DD:EE:FF',
  deviceName: 'Star Printer',
  connected: true,
  lastUsed: Date.now()
});

// Switch between devices
await printerSessionService.switchDevice('kitchen', newDeviceId);

// Get all devices for a printer type
const devices = printerSessionService.getAllDevicesForType('kitchen');

// Mark disconnected (triggers auto-reconnect)
printerSessionService.markDisconnected('kitchen', error);
```

### 2. **printerDeviceStorageService.ts** - Persistent Device Storage
Saves printer device selections to AsyncStorage for recall after app restart.

**Features:**
- Persist device ID and name
- Track last connection time
- Query by printer type
- Remove specific devices
- Clear all devices

**Key Methods:**
```typescript
// Save device selection
await printerDeviceStorageService.savePrinterDevice(
  'kitchen',
  'AA:BB:CC:DD:EE:FF',
  'Star Printer #1'
);

// Get most recently used device
const device = await printerDeviceStorageService.getLastUsedDevice('kitchen');

// Get all devices for type
const devices = await printerDeviceStorageService.getSavedDevicesForType('kitchen');

// Update last connection timestamp
await printerDeviceStorageService.updateLastConnected(deviceId);
```

### 3. **printQueueService.ts** - Print Job Queue
Manages failed print jobs for retry when printer reconnects.

**Features:**
- Queue print jobs with unique IDs
- Configurable retry limits
- Track retry attempts
- Auto-retry on device reconnection
- Queue statistics

**Key Methods:**
```typescript
// Add job to queue
const jobId = printQueueService.addJob(
  'ORDER123',
  'kitchen',
  'AA:BB:CC:DD:EE:FF',
  'ESC/POS command bytes',
  3 // max retries
);

// Get queued jobs
const jobs = printQueueService.getJobsForPrinter('kitchen', deviceId);

// Retry all jobs for printer
const result = await printQueueService.retryJobsForPrinter('kitchen');
// result = {succeeded: 2, failed: 1}

// Get statistics
const stats = printQueueService.getStats();
// {totalJobs: 5, byPrinterType: {kitchen: 3, qr: 2}}
```

### 4. **printerAutoConnectService.ts** - Auto-Reconnection
Manages automatic reconnection attempts with exponential backoff.

**Features:**
- Exponential backoff (1s → 2s → 4s → 8s → 16s → 30s cap)
- Configurable retry limits (default: 5)
- Tracks reconnection attempts
- Callback-based reconnect logic
- Automatic cleanup when successful

**Key Methods:**
```typescript
// Start auto-reconnect for device
printerAutoConnectService.startReconnect(
  'AA:BB:CC:DD:EE:FF',
  'kitchen',
  'Connection timeout'
);

// Register reconnect callback
printerAutoConnectService.onReconnect(async (deviceId, printerType) => {
  const connected = await bluetoothService.connectToPrinter(deviceId);
  return connected;
});

// Get all pending reconnection attempts
const pending = printerAutoConnectService.getAllPendingReconnects();

// Cancel reconnection for device
printerAutoConnectService.cancelReconnect(deviceId, 'kitchen');
```

### 5. **printerAutoPrintService.ts** - Real-Time Order Subscription
Polls backend for new kitchen orders and triggers auto-printing.

**Features:**
- Real-time order polling (configurable interval)
- Category-based printer routing
- Automatic fallback to manual print on failure
- Subscription lifecycle management

**Key Methods:**
```typescript
// Subscribe to kitchen orders
await printerAutoPrintService.subscribeToOrders(restaurantId, 2000);

// Register order callback
printerAutoPrintService.onOrder(async (order) => {
  console.log('New order:', order);
  // Handle auto-print
});

// Check subscription status
const status = printerAutoPrintService.getStatus();
// {isSubscribed: true, restaurantId: '1', callbackCount: 1}

// Unsubscribe
printerAutoPrintService.unsubscribeFromOrders();
```

### 6. **bluetoothService.ts** - Enhanced (Updated)
Now includes device state monitoring and disconnection detection.

**New Methods:**
```typescript
// Subscribe to device disconnection
const unsubscribe = bluetoothService.subscribeToDeviceState(
  deviceId,
  (error) => {
    console.log('Device disconnected:', error);
    printerSessionService.markDisconnected('kitchen');
  }
);

// Get all discovered devices
const devices = bluetoothService.getDiscoveredDevices();
```

## Workflow Examples

### Scenario 1: Manual Print with Auto-Queue

```typescript
// User taps "Print" button for order
handlePrintOrder(order) {
  1. Route order to appropriate printer(s) by category
  2. For each printer:
     a. Check if session exists and is connected
     b. If not connected, attempt to connect
     c. If connection fails, queue job for later
     d. If connected, send print request
     e. Save device selection to AsyncStorage
}
```

### Scenario 2: Auto-Print with Real-Time Polling

```typescript
// Kitchen Dashboard starts up
useEffect(() => {
  1. Load saved devices from AsyncStorage
  2. Create sessions for previously used devices
  3. Subscribe to backend kitchen orders
  4. For each new order:
     - Find matching printers by category
     - Attempt to print (queue if fails)
     - Use auto-reconnect for temporary failures
}
```

### Scenario 3: Bluetooth Disconnection & Recovery

```typescript
// Mid-print, Bluetooth printer disconnects
bluetoothService detects disconnect:
  1. Calls subscribeToDeviceState callback
  2. printerSessionService.markDisconnected() called
  3. This triggers printerAutoConnectService.startReconnect()
  4. Service schedules retry: 1s wait, then retry
  5. Connection succeeds or fails
  6. If success: printerSessionService.markConnected()
  7. If failure: Schedule next retry (2s wait)
```

### Scenario 4: Multiple Printers with Category Routing

```typescript
// Restaurant configured with 3 kitchen printers:
// - Grill Printer: Categories [1, 2] (Meat, Seafood)
// - Fryer Printer: Categories [3] (Appetizers)
// - Beverage Printer: Categories [4] (Drinks)

Order arrives for Meat (Category 1):
  1. System finds Grill Printer
  2. Attempts connection
  3. Sends print
  4. Saves this device selection

Next Meat order:
  1. System finds Grill Printer again
  2. Uses existing session (no reconnect needed)
  3. Prints immediately
```

## Device Selection Persistence

When a user successfully prints to a device, it's automatically saved:

```typescript
// After successful print
await printerDeviceStorageService.savePrinterDevice(
  'kitchen',
  'AA:BB:CC:DD:EE:FF',
  'Star Printer'
);

// On app restart
await printerSessionService.loadSavedDevices();
// Session restored with last-used device
```

## Connection Status Display

Kitchen Dashboard header shows real-time printer status:

```
✅ Connected: Star Printer       → Green (fully ready)
🔄 Reconnecting: Star...        → Orange (retrying)
⚠️ Not connected                → Red (needs manual action)
```

## Error Handling & Fallbacks

1. **Single Device Failure**: Queued for automatic retry
2. **Multiple Device Failure**: Attempt next matching printer
3. **All Devices Fail**: Manual print option available
4. **Network Failure**: Queue persists until reconnected
5. **Bluetooth Power Off**: Auto-reconnect waits for re-enable

## Configuration

### Auto-Connect Backoff (Exponential)

```typescript
// In printerAutoConnectService constructor:
{
  maxRetries: 5,              // After 5 failures, stop
  initialDelayMs: 1000,       // Start with 1 second
  maxDelayMs: 30000,          // Cap at 30 seconds
  backoffMultiplier: 2        // Double each retry
}

// Sequence:
1. Fail immediately → Now
2. Fail → Wait 1s
3. Fail → Wait 2s
4. Fail → Wait 4s
5. Fail → Wait 8s
6. Fail → Wait 16s
7. Fail → Wait 30s (capped)
8. Give up
```

### Auto-Print Polling Interval

Default: 2000ms (2 seconds) between polling

Adjust in `KitchenDashboardScreen`:
```typescript
await printerAutoPrintService.subscribeToOrders(restaurantId, 3000); // 3s interval
```

## Monitoring & Diagnostics

Get complete system diagnostics:

```typescript
// Overall system status
const diag = printerSessionService.getDiagnostics();
// {
//   sessions: [
//     { printerType: 'kitchen', activeDeviceId: 'AA:...', connected: true, ... },
//     { printerType: 'qr', activeDeviceId: null, connected: false, ... }
//   ],
//   isInitialized: true,
//   autoConnectPending: 2
// }

// Print queue status
const stats = printQueueService.getStats();
// { totalJobs: 3, byPrinterType: { kitchen: 3 } }

// Auto-print subscription
const autoPrintStatus = printerAutoPrintService.getStatus();
// { isSubscribed: true, restaurantId: '1', callbackCount: 1 }
```

## Integration with Backend

The mobile app sends print requests to:
```
POST /api/restaurants/{restaurantId}/print-order
{
  orderId: "ORDER123",
  orderType: "kitchen",
  printerName: "Star Printer",  // Device name
  priority: 10
}
```

Backend receives this and:
1. Looks up configured printer in database
2. Connects to printer (network or Bluetooth)
3. Generates ESC/POS from order
4. Sends to physical printer
5. Logs result

## Testing Checklist

- [ ] App starts: Saved devices loaded from AsyncStorage
- [ ] Manual print: Device selection saved on success
- [ ] Device switch: Can select different device for same printer type
- [ ] Auto-print: New orders printed automatically (if polling working)
- [ ] Disconnect: Auto-reconnect initiates on failure
- [ ] Queue: Failed prints queued and retried
- [ ] Status: Kitchen header shows connection status
- [ ] Network printer: Can print to network IP:port
- [ ] Bluetooth: Can scan, connect, and print to BLE devices
- [ ] Recovery: Temp disconnect recovers automatically
- [ ] App restart: Resumes printing with saved device

## Future Enhancements

1. **WebSocket Instead of Polling**: Real-time order delivery vs 2s polling
2. **Persistent Queue Storage**: Queue survives app restart
3. **Print History**: Track all print jobs and results
4. **Device Firmware Updates**: OTA updates for connected printers
5. **Thermal Receipt Preview**: Show print layout before sending
6. **Per-Category Device Assignment**: UI to assign printers to menu categories
7. **Print Statistics Dashboard**: Success rate, avg print time, errors
