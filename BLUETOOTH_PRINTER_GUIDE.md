# Bluetooth Receipt Printer Implementation

## Overview
Added support for Bluetooth receipt printers on mobile POS devices. This allows restaurant admins and kitchen staff to connect and print directly to Bluetooth printers using their mobile devices (iPad, tablet, smartphone).

## Architecture

### Client-Side (Frontend)
- **Web Bluetooth API**: Uses native browser Bluetooth support for device discovery and connection
- **Location**: `frontend/admin-settings.html` and `frontend/admin-settings.js`
- **Supported Browsers**:
  - iOS: Safari 13+
  - Android: Chrome, Edge, Samsung Internet
  - Desktop: Chrome, Edge (experimental)

### Server-Side (Backend)
- **Storage**: Bluetooth device ID and name stored in `restaurants.bluetooth_device_id` and `restaurants.bluetooth_device_name` columns
- **Configuration**: Stored via `/restaurants/:restaurantId/printer-settings` endpoint
- **Print Routing**: Bluetooth printers return HTML for client-side thermal printing (same as browser printing)

## How It Works

### Setup Flow
1. Admin navigates to Settings → Printer Settings
2. Selects "Bluetooth Receipt Printer" from printer type dropdown
3. Clicks "🔍 Scan Devices" to trigger Web Bluetooth device discovery
4. Browser shows native Bluetooth device selector
5. Admin selects the receipt printer from the list
6. Device ID is stored in the database
7. Clicks "💾 Save" to persist configuration

### Printing Flow (Auto-Print)
1. Order is created by customer via QR menu
2. If kitchen auto-print is enabled for Bluetooth printer:
   - Server queues print job with Bluetooth device ID
   - Mobile POS fetches print queue
   - Client-side code prints to Bluetooth device using Web Bluetooth API
3. Print job marked as completed

### Files Modified

#### Frontend
- **[admin-settings.html](admin-settings.html)**
  - Added "Bluetooth Receipt Printer" option to printer type selector
  - Added Bluetooth device selection UI with scan button
  - Added device list display area

- **[admin-settings.js](admin-settings.js)**
  - Added `scanBluetoothDevices()`: Discovers nearby Bluetooth devices
  - Added `selectBluetoothDevice()`: Stores selected device ID
  - Added `connectBluetoothDevice()`: Initiates Bluetooth GATT connection
  - Updated `updatePrinterTypeFields()`: Shows/hides Bluetooth UI based on printer type
  - Updated `savePrinterSettings()`: Includes Bluetooth device ID in save request
  - Updated `enterEditModePrinter()`: Handles Bluetooth field visibility

#### Backend
- **[backend/migrations/027_add_bluetooth_printer_support.sql](backend/migrations/027_add_bluetooth_printer_support.sql)**
  - Added `bluetooth_device_id` column to restaurants table
  - Added `bluetooth_device_name` column to restaurants table

- **[backend/src/routes/printer.routes.ts](backend/src/routes/printer.routes.ts)**
  - Updated GET `/restaurants/:restaurantId/printer-settings` to fetch Bluetooth columns
  - Updated PATCH `/restaurants/:restaurantId/printer-settings` to save Bluetooth device info
  - Updated POST `/restaurants/:restaurantId/printer-test` to handle Bluetooth validation
  - Updated POST `/restaurants/:restaurantId/print-order` to include Bluetooth device in payload
  - Added Bluetooth printer handling in print routing logic

## API Endpoints

### Get Printer Settings
```
GET /restaurants/:restaurantId/printer-settings
Returns: printer_type, printer_host, printer_port, bluetooth_device_id, bluetooth_device_name, auto-print flags
```

### Save Printer Settings
```
PATCH /restaurants/:restaurantId/printer-settings
Body: {
  printer_type: "bluetooth",
  bluetooth_device_id: "<device-id>",
  bluetooth_device_name: "<device-name>",
  kitchen_auto_print: true,
  bill_auto_print: true
}
```

### Test Printer Connection
```
POST /restaurants/:restaurantId/printer-test
Returns: { success: true, message: "Bluetooth device configured: <device-name>" }
```

### Print Order (to Bluetooth)
```
POST /restaurants/:restaurantId/print-order
Body: { orderId: "123", orderType: "kitchen", priority: 10 }
Returns: {
  success: true,
  html: "<HTML receipt>",
  bluetoothDevice: { deviceId: "...", deviceName: "..." }
}
```

## Bluetooth Device Scanning

### Device Discovery Process
1. User clicks "🔍 Scan Devices"
2. Browser's native Bluetooth device picker opens
3. User selects receipt printer from list
4. Device ID stored in `bluetooth_device_id` field
5. Device name stored in `bluetooth_device_name` field

### Supported Device Discovery
- Uses Web Bluetooth API with `acceptAllDevices: true`
- Filters for empty device list to show all available devices
- Optional services: `generic_attribute` (for GATT connection)

## Browser Compatibility & Permissions

### Prerequisites
- **Mobile Device**: iPad (iOS 13+), Android phone/tablet with Bluetooth
- **Browser**: Safari (iOS), Chrome/Edge (Android)
- **Bluetooth Enabled**: Device Bluetooth must be turned on
- **Printer**: Receipt printer in discoverable/pairing mode

### Permission Flow
1. First time: Browser asks for Bluetooth permission
2. User grants permission to website
3. Subsequent scans don't require permission prompt
4. User can revoke permissions in browser settings

### Unsupported Scenarios & Error Handling
- **No Bluetooth Support**: Shows browser compatibility message with device recommendations
- **No Devices Found**: Instructs user to enable printer discoverable mode
- **Permission Denied**: Directs user to browser settings to enable Bluetooth
- **Cancelled Selection**: User can retry with "Scan Devices" again

## Thermal Printing Integration

Once device is selected and stored, the mobile receipt printer can print via:

### Option 1: Using Web Bluetooth API (Advanced)
```javascript
// Client-side thermal printing via Bluetooth
const device = await navigator.bluetooth.requestDevice({...});
const server = await device.gatt.connect();
const service = await server.getPrimaryService(...);
const characteristic = await service.getCharacteristic(...);
await characteristic.writeValue(escposCommands);
```

### Option 2: Using Browser Print API (Current)
Server returns HTML receipt → Client prints via standard browser print dialog with Bluetooth printer selected

## Database Schema

### restaurants table additions
```sql
bluetooth_device_id VARCHAR(255)        -- Web Bluetooth device ID from API
bluetooth_device_name VARCHAR(255)      -- Human-readable device name for display
```

## Testing

### Manual Testing Steps
1. **Setup**: Configure Bluetooth receipt printer on mobile POS
   - Settings → Printer Settings
   - Select "Bluetooth Receipt Printer"
   - Tap "Scan Devices"
   - Select printer from browser dialog
   - Tap "Save"

2. **Verify Storage**: Check that device ID persists
   - Refresh page
   - Device should still show as selected

3. **Auto-Print Test**: Enable kitchen auto-print
   - Create order from QR menu
   - Check if print job appears in queue
   - Mobile POS device should receive print trigger

4. **Connection Test**: Tap "Test" button
   - Should show "Bluetooth device configured: <name>"
   - If not configured: "Bluetooth device not configured"

## Limitations & Future Enhancements

### Current Limitations
- Web Bluetooth API only works on Bluetooth 4.0+ devices
- iOS support limited to Safari (other apps can't access Web Bluetooth)
- Device must be in pairing mode for discovery
- Requires HTTPS in production (localhost allowed for development)

### Future Enhancements
- [ ] Store multiple Bluetooth devices per restaurant (for different zones)
- [ ] Automatic device reconnection logic
- [ ] Advanced thermal printer commands via ESC/POS protocol
- [ ] Print job queue persistence for offline scenarios
- [ ] Device battery level monitoring
- [ ] Bluetooth 5.0+ range optimization
- [ ] Support for BLE beaconing

## Security Notes
- Device IDs stored are Web Bluetooth API identifiers (ephemeral, device-specific)
- No sensitive data transmitted over Bluetooth
- Connection handled client-side in secure context (HTTPS)
- User must explicitly grant browser Bluetooth permission

## Troubleshooting

### Issue: "Bluetooth is not supported"
- **Solution**: Ensure using Safari (iOS 13+) or Chrome/Edge (Android)
- **Check**: Browser version is up to date

### Issue: Bluetooth device not found
- **Solution**: 
  1. Verify printer is powered on
  2. Put printer in pairing/discoverable mode
  3. Check printer is within Bluetooth range
  4. Try scanning again

### Issue: "Permission denied"
- **Solution**: 
  1. Go to browser settings
  2. Find Bluetooth permissions for the site
  3. Enable Bluetooth access
  4. Try scanning again

### Issue: Device shows but won't connect
- **Solution**:
  1. Restart printer (toggle power)
  2. Forget device from system Bluetooth settings
  3. Put printer in pairing mode again
  4. Try scanning and connecting again

## Integration with Existing Features

### Auto-Print Orders to Kitchen
```
Order Created → Check printer_type = "bluetooth" → 
Return HTML with device ID → Mobile client tracks device connection → 
Print via Bluetooth when device ready
```

### Bill Printing
```
Session Closed → Fetch printer config including Bluetooth device → 
Return HTML receipt → Mobile client prints to Bluetooth device
```

### Multi-Zone Routing
```
Bluetooth printers can be assigned zones via printerZones feature  →
Different categories route to different zone printers →
Each Bluetooth device independently handles its zone's orders
```

---

**Last Updated**: March 3, 2026
**Status**: ✅ Implemented and Ready for Testing
