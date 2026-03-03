# Bluetooth Connected Devices UI Update

## What Changed

The Bluetooth printer configuration UI has been updated to display **already-connected Bluetooth devices** instead of requiring users to scan and pair each time.

## New UX Flow

### 1. **View Connected Devices**
When configuring Bluetooth printer, the admin will see:
- **Available Devices List**: Shows all previously paired Bluetooth devices for this restaurant
- Each device shows:
  - Device name (e.g., "Brother QL-810W")
  - Device ID (first 16 chars)
  - Last used date
  - **Selected** badge if currently selected

### 2. **Select Device**
- Click on any device in the list to select it
- Selected device shows a blue highlight and checkmark
- Device info stored in database for later use

### 3. **Add New Device**
- Click **"🔍 Scan New Device"** button to add a printer not yet in the list
- Browser opens Bluetooth device picker
- Once selected, device is added to the available devices list
- Device is automatically saved to the server for future use

### 4. **Refresh Devices**
- Click **"🔄 Refresh List"** button to reload connected devices from server
- Useful after new device has been added elsewhere

## File Changes

### Frontend

**admin-settings.html**
- Replaced inline device selector with "Available Devices" list UI
- Shows device history with names and last-used dates
- Split into two sections:
  1. "Available Devices" - list of previously paired devices
  2. Actions - "Scan New Device" and "Refresh List" buttons

**admin-settings.js**
- Added `bluetoothDeviceHistory` - stores list of paired devices
- Added `refreshConnectedDevices()` - fetches and displays saved devices from server
- Added `selectBluetoothDeviceFromHistory()` - selects device from history list
- Updated `scanBluetoothDevices()` - adds scanned device to history
- Updated `loadPrinterSettings()` - auto-loads devices when printer settings loaded
- Updated `enterEditModePrinter()` - refreshes device list on entering edit mode

### Backend

**printer.routes.ts**
- Added `GET /restaurants/:restaurantId/bluetooth-devices` - fetch saved devices
- Added `POST /restaurants/:restaurantId/bluetooth-devices` - save new device
- Added `DELETE /restaurants/:restaurantId/bluetooth-devices/:deviceId` - remove device

**Migration: 028_add_bluetooth_devices_table.sql**
- Creates `bluetooth_devices` table with fields:
  - `id` - primary key
  - `restaurant_id` - which restaurant owns this device
  - `device_id` - Web Bluetooth API device identifier
  - `device_name` - human-readable device name
  - `last_connected` - timestamp of last use
  - `created_at` - when device was first added

## How It Works

### Device Discovery & Storage

1. **First Time Setup**
   - Admin scans for Bluetooth device using "Scan New Device"
   - Browser shows native Bluetooth device picker
   - User selects printer
   - Device is saved to `bluetooth_devices` table

2. **Subsequent Visits**
   - Admin goes to Printer Settings
   - System fetches all saved devices for that restaurant
   - Devices displayed in "Available Devices" list
   - Admin simply clicks to select from list (no scanning needed)

3. **Adding Additional Printers**
   - Admin can click "Scan New Device" anytime
   - New device added to both device list and database
   - Can have multiple printers (kitchen + receipt)

4. **Removing Unused Printers**
   - Coming soon: Delete button on each device
   - Removes from available devices list

## API Endpoints

### Get Bluetooth Devices
```bash
GET /restaurants/:restaurantId/bluetooth-devices

Response:
[
  {
    "deviceId": "abc123def456",
    "deviceName": "Brother QL-810W",
    "lastConnected": "2026-03-03T10:30:00.000Z",
    "createdAt": "2026-02-15T14:20:00.000Z"
  },
  {
    "deviceId": "xyz789uvw012",
    "deviceName": "Star Thermal Printer",
    "lastConnected": "2026-03-01T08:15:00.000Z",
    "createdAt": "2026-02-20T11:45:00.000Z"
  }
]
```

### Save Bluetooth Device
```bash
POST /restaurants/:restaurantId/bluetooth-devices
Content-Type: application/json

{
  "deviceId": "abc123def456",
  "deviceName": "Brother QL-810W"
}

Response:
{
  "success": true,
  "device": {
    "deviceId": "abc123def456",
    "deviceName": "Brother QL-810W",
    "lastConnected": "2026-03-03T10:30:00.000Z",
    "createdAt": "2026-02-15T14:20:00.000Z"
  }
}
```

### Delete Bluetooth Device
```bash
DELETE /restaurants/:restaurantId/bluetooth-devices/:deviceId

Response:
{
  "success": true,
  "message": "Device deleted"
}
```

## Device History Features

### Automatic Tracking
- **Last Connected**: Timestamp updates each time device is selected
- **Creation Date**: When device was first paired
- **Device Name**: Stored for consistent display across sessions

### Multi-Device Setup
Restaurants can now have:
- 1 Receipt printer (for customer receipts)
- 1 Kitchen printer (for staff orders)
- Multiple devices per location (for redundancy)

## UI Enhancements

### Visual Feedback
- **Selected Device**: Shows blue highlight + checkmark badge
- **Device Info**: Displays name, ID, and last-used date
- **Empty State**: Clear message when no devices available
- **Loading State**: "Loading connected devices..." while fetching

### Button States
- **Scan New Device**: Disabled while scanning, shows "⏳ Scanning..."
- **Refresh List**: Always available, updates device list
- **Device Selection**: Click to select, automatic highlighting

## Testing Checklist

- [ ] Can see previously paired devices in the list
- [ ] Can click device to select it
- [ ] Selected device shows in blue with checkmark
- [ ] "Scan New Device" adds new printer to list
- [ ] New printer persists after page reload
- [ ] Multiple devices can be added
- [ ] Device name and ID display correctly
- [ ] Last-used date updates when device is selected
- [ ] "Refresh List" reloads devices from server
- [ ] Settings save with selected device

## Browser Compatibility

| Device | Browser | Support |
|--------|---------|---------|
| iOS | Safari 13+ | ✅ Full |
| Android | Chrome/Edge | ✅ Full |
| Desktop | Chrome/Edge | ✅ Experimental |

## Future Enhancements

- [ ] Delete button on each device to remove unused printers
- [ ] Device connection status indicator (connected/disconnected)
- [ ] Automatic reconnection attempts
- [ ] Battery level display for BLE printers
- [ ] Rename device from UI
- [ ] Assign labels (Kitchen/Receipt/Backup)

---

**Status**: ✅ Implementation Complete
**Migration Needed**: Yes - run 028_add_bluetooth_devices_table.sql
**Database Table**: `bluetooth_devices`
