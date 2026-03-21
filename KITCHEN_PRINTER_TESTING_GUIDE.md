# Kitchen Order Printer - Quick Testing Guide

## 🚀 Quick Start

### Files Modified
1. **admin-printer.html** - Added kitchen-format-section with multi-printer UI
2. **admin-printer.js** - Updated save/load/status functions for kitchen
3. **admin-printer-kitchen.js** - NEW module with all kitchen logic

### Testing Flow

#### Step 1: Navigate to Printer Settings
```
Admin Dashboard → Printer Settings → Select "Kitchen Order Printing"
```

#### Step 2: Add Kitchen Printers
1. Click "+ Add Printer (Limit: 3)"
2. Enter printer name (e.g., "Main Kitchen")
3. Select type: Network or Bluetooth
4. Enter connection details:
   - **Network**: IP address (e.g., 192.168.1.100)
   - **Bluetooth**: Click "Scan for Devices" button
5. Assign menu categories via checkboxes
6. Add up to 3 printers total

#### Step 3: Save Configuration
1. Click "✓ Save Kitchen Printers" button
2. Should show: "✅ Kitchen Printers saved successfully!"
3. Returns to main printer settings view
4. Status card shows: "✓ Configured - 3 Printers"

#### Step 4: Verify Persistence
1. Reload the page
2. Go back to Kitchen Order Printing
3. All printers should be loaded and displayed

---

## 🔍 Testing Scenarios

### Scenario 1: Basic Configuration
```
1. Add 1 kitchen printer
2. Select Network type
3. Enter IP: 192.168.1.200
4. Assign 2 categories (checkboxes)
5. Save and reload
✅ Expected: Printer persists with categories
```

### Scenario 2: Multiple Printers
```
1. Add Printer 1: Network, categories [1,2]
2. Add Printer 2: Bluetooth, category [3]
3. Add Printer 3: Network, categories [1,3]
4. Save
✅ Expected: All 3 show in status card
✅ Expected: "+ Add Printer" button disabled
```

### Scenario 3: Bluetooth Device
```
1. Add printer with Bluetooth
2. Click "Scan for Devices"
3. Select device from list
4. Device name displays with ✓ checkmark
5. Assign category and save
✅ Expected: Device name persists after reload
```

### Scenario 4: Validation
```
1. Add printer
2. Don't select any categories
3. Click "Save Kitchen Printers"
✅ Expected: Alert shows validation error
✅ Expected: Configuration not saved
```

### Scenario 5: Remove Printer
```
1. Add 2 printers
2. Click "Remove" on first printer
3. Only 1 printer remains
4. Save
✅ Expected: "+ Add Printer" button re-enabled
✅ Expected: Only 1 printer in config
```

---

## 🛠️ Browser Console Debugging

All functions log detailed info to console:

```javascript
// When saving:
[admin-printer.js] saveKitchenPrinterConfiguration payload: {...}
[admin-printer.js] Kitchen API response (raw): {...}

// When loading:
[admin-printer.js] ✓ Loaded 2 kitchen printers into module
[admin-printer-kitchen.js] loadKitchenPrintersFromAPI called with: [...]

// When adding printers:
[admin-printer-kitchen.js] addKitchenPrinter - Current count: 1, Max: 3
[admin-printer-kitchen.js] Updated add printer button

// When saving validation:
[admin-printer-kitchen.js] Validating kitchen printer config...
[admin-printer-kitchen.js] ❌ Validation Error: Printer 1 has no categories assigned
```

### Enable Console Logging
```
Press F12 → Console tab
Perform action in UI
Watch for [admin-printer.js] and [admin-printer-kitchen.js] messages
```

---

## ✅ Validation Checklist

### UI Elements
- [ ] Kitchen-format-section shows when "Kitchen Order Printing" selected
- [ ] " + Add Printer" button visible
- [ ] Multi-printer list container visible
- [ ] Preview shows realistic kitchen ticket format
- [ ] "✓ Save Kitchen Printers" button visible and clickable

### Functionality
- [ ] Can add printers (up to 3)
- [ ] Can remove printers
- [ ] Can select Network or Bluetooth type
- [ ] Network type shows IP input field
- [ ] Bluetooth type shows "Scan for Devices" button
- [ ] Category checkboxes visible for each menu category
- [ ] Multiple categories can be selected per printer
- [ ] Status card updates with printer count after save

### Data Persistence
- [ ] Printers saved to API
- [ ] Printers loaded from API on page reload
- [ ] Device names persist (Bluetooth)
- [ ] IP addresses persist (Network)
- [ ] Category assignments persist

### Error Handling
- [ ] Cannot save without selecting categories
- [ ] Cannot add more than 3 printers
- [ ] Clear error messages displayed
- [ ] Toast/alert for successful save

---

## 🔧 Common Issues & Solutions

### Issue: Printers not showing after reload
**Solution**: 
1. Check browser console for errors
2. Verify API endpoint returns `kitchen_printers` array
3. Check that `loadKitchenPrintersFromAPI()` is called

### Issue: Category checkboxes not appearing
**Solution**:
1. Verify menu categories are loading
2. Check API endpoint: `/restaurants/{id}/categories`
3. Check fallback categories in code (Appetizers, Main Courses, etc.)

### Issue: Bluetooth scanning not working
**Solution**:
1. Must use Chrome, Edge, or Opera (Safari/Firefox don't support Web Bluetooth)
2. Must be HTTPS (except localhost)
3. Device must be Bluetooth-capable

### Issue: Save button not doing anything
**Solution**:
1. Check browser console for JavaScript errors
2. Verify `saveKitchenPrinterConfiguration()` function exists
3. Verify `getKitchenPrinterConfig()` function exists
4. Check network tab for API response

---

## 📊 Expected Data Format

### Saved Printer Object
```javascript
{
  id: "unique-id",
  name: "Main Kitchen Printer",
  type: "network",
  host: "192.168.1.100",
  categories: [1, 3, 5]  // Menu category IDs
}
```

### API Request Payload
```javascript
{
  kitchen_printers: [
    { id, name, type, host, categories },
    { id, name, type, host, bluetoothDevice, categories },
    { id, name, type, host, categories }
  ]
}
```

### API Response (Expected)
```javascript
{
  id: "restaurant-id",
  kitchen_printers: [
    { ... },
    { ... },
    { ... }
  ],
  // ... other settings
}
```

---

## 🚨 API Requirements

Backend needs to support:

1. **GET /restaurants/{id}/printer-settings**
   - Returns configuration including `kitchen_printers` array

2. **PATCH /restaurants/{id}/printer-settings**
   - Accepts `kitchen_printers` field
   - Validates array structure
   - Stores in database
   - Returns updated config

3. **GET /restaurants/{id}/categories**
   - Returns menu categories
   - Format: `[{ id: 1, name: "Appetizers" }, ...]`
   - Used to populate category checkboxes

---

## 📝 Notes

- Kitchen printers are **separate** from QR/Bill printers
- Up to **3 independent printers** per restaurant
- Each printer can serve **multiple categories**
- Orders routed by **menu item category**
- Supports **Network and Bluetooth** connections
- Uses **Web Bluetooth API** (Chrome/Edge/Opera only)

---

## 🎯 Success Criteria

- [ ] Can add/remove kitchen printers in UI
- [ ] Configuration saves to API
- [ ] Configuration loads from API on reload
- [ ] Status card shows printer count
- [ ] Browser console shows no errors
- [ ] Validation prevents invalid saves
- [ ] UI provides clear feedback for actions

---

**Status**: Ready for testing ✅
**Last Updated**: 2024
