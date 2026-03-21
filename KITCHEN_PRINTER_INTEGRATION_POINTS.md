# Kitchen Order Printer - Integration Points Reference

## 🔗 Complete Integration Diagram

```
admin-printer.html
    ↓
    ├─→ Loads: admin-printer.js
    │        ├─ selectPrinterType() [Line 48]
    │        ├─ loadPrinterSettings() [Line 1028]
    │        ├─ saveKitchenPrinterConfiguration() [Line 953]
    │        └─ updateStatusCards() [Line 282]
    │
    └─→ Loads: admin-printer-kitchen.js [<script> tag]
             ├─ loadKitchenFormatUI() [Line 30]
             ├─ loadKitchenPrintersFromAPI() [Line 13]
             ├─ addKitchenPrinter() [Line 60]
             ├─ removeKitchenPrinter() [Line 89]
             ├─ renderKitchenPrintersList() [Line 109]
             ├─ togglePrinterCategory() [Line 195]
             ├─ getKitchenPrinterConfig() [Line 275]
             └─ loadMenuCategories() [Line 302]
             
           Mutually Call Each Other
```

---

## 📍 Key Integration Points

### 1. HTML → JavaScript Module Loading

**File**: `admin-printer.html` (Line 280)
```html
<script src="admin-printer-kitchen.js"></script>
```

**Effect**:
- Makes all kitchen module functions globally available
- Initializes `kitchenPrinters` and `availableMenuCategories` state
- Ready for `admin-printer.js` to call kitchen functions

---

### 2. Printer Type Selection

**File**: `admin-printer.js` - `selectPrinterType()` (Line 104-120)

**Code**:
```javascript
const kitchenFormatSection = document.getElementById('kitchen-format-section');
if (kitchenFormatSection) {
  if (type === 'kitchen') {
    kitchenFormatSection.style.display = 'block';
    if (typeof loadKitchenFormatUI === 'function') {
      loadKitchenFormatUI();  // ← Calls kitchen module
    }
  } else {
    kitchenFormatSection.style.display = 'none';
  }
}
```

**Flow**:
1. User selects "Kitchen Order Printing" from dropdown
2. Kitchen format section becomes visible
3. `loadKitchenFormatUI()` is called from kitchen module
4. Module initializes UI and loads menu categories

---

### 3. Saving Kitchen Configuration

**File**: `admin-printer.js` - `saveKitchenPrinterConfiguration()` (Line 953)

**Key Lines**:
```javascript
// Line 973-975: Call kitchen module to get config
if (typeof getKitchenPrinterConfig === 'function') {
  kitchenConfig = getKitchenPrinterConfig();  // ← Gets validated config
}

// Line 983-985: Build API payload
const payload = {
  ...kitchenConfig  // ← Spreads kitchen_printers array
};

// Line 987-993: Send to API
const response = await fetch(
  `${API}/restaurants/${restaurantId}/printer-settings`,
  {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
);

// Line 1011: Update status display
updateStatusCards();
```

**API Payload**:
```javascript
{
  kitchen_printers: [
    { id, name, type, host/bluetoothDevice, categories },
    ...
  ]
}
```

---

### 4. Loading Kitchen Configuration

**File**: `admin-printer.js` - `loadPrinterSettings()` (Line 1028-1115)

**Key Integration Points**:

**Line 1110-1114**: Load kitchen printers into module state
```javascript
if (currentPrinterSettings.kitchen_printers && Array.isArray(currentPrinterSettings.kitchen_printers)) {
  if (typeof loadKitchenPrintersFromAPI === 'function') {
    loadKitchenPrintersFromAPI(currentPrinterSettings.kitchen_printers);
    // ↑ Populates kitchen module's kitchenPrinters[] state
  }
}
```

**Flow**:
1. Page loads, `loadPrinterSettings()` called
2. Fetches from API: `GET /printer-settings`
3. If response includes `kitchen_printers` array
4. Calls `loadKitchenPrintersFromAPI()` to populate module
5. Kitchen module now has saved printers ready to display

---

### 5. Status Card Updates

**File**: `admin-printer.js` - `updateStatusCards()` (Line 309-357)

**Kitchen-Specific Code (Line 318-323)**:
```javascript
'kitchen': {
  element: document.getElementById('kitchen-status'),
  check: () => {
    const kitchenPrinters = settings.kitchen_printers || [];
    const result = Array.isArray(kitchenPrinters) && kitchenPrinters.length > 0;
    return result;  // ← True if array has items
  }
}
```

**Display (Line 338-342)**:
```javascript
if (type === 'kitchen') {
  const kitchenPrinters = settings.kitchen_printers || [];
  if (Array.isArray(kitchenPrinters) && kitchenPrinters.length > 0) {
    deviceDisplay = `${kitchenPrinters.length} Printer${kitchenPrinters.length > 1 ? 's' : ''}`;
  }
}
```

**Result**: Status card shows "✓ Configured - 3 Printers"

---

## 🔄 Complete Flow - User Perspective

### Adding a Kitchen Printer

```
User clicks "Kitchen Order Printing"
           ↓
selectPrinterType('kitchen') called
           ↓
Kitchen format section shown (display: block)
           ↓
loadKitchenFormatUI() called
           ↓
loadMenuCategories() fetches categories from API
           ↓
renderKitchenPrintersList() displays form
           ↓
User enters printer name, selects type, assigns categories
           ↓
addKitchenPrinter() adds to kitchenPrinters[]
           ↓
renderKitchenPrintersList() re-renders with new printer
```

### Saving Kitchen Configuration

```
User clicks "✓ Save Kitchen Printers"
           ↓
saveKitchenPrinterConfiguration() called
           ↓
getKitchenPrinterConfig() validates data
           ↓
If validation fails → Show error alert & exit
           ↓
Build payload with kitchen_printers array
           ↓
Send PATCH to /printer-settings
           ↓
API returns updated settings
           ↓
updateStatusCards() updates display
           ↓
Show "✅ Kitchen Printers saved successfully!"
           ↓
backToSelection() returns to main view
```

### Loading Saved Configuration

```
Page loads
           ↓
loadPrinterSettings() called
           ↓
Fetch GET /printer-settings
           ↓
If response includes kitchen_printers
           ↓
loadKitchenPrintersFromAPI(array) populates module
           ↓
kitchenPrinters[] state now has saved printers
           ↓
updateStatusCards() shows "✓ Configured - N Printers"
           ↓
User clicks "Kitchen Order Printing"
           ↓
kitchenPrinters[] is already populated & displayed
```

---

## 📤 Function Call Chain

### When Kitchen Selected
```
User Action: Select "Kitchen Order Printing"
      ↓
selectPrinterType('kitchen')
      ├─→ Show kitchen-format-section
      ├─→ Check: typeof loadKitchenFormatUI === 'function'
      └─→ Call: loadKitchenFormatUI()
            ├─→ Call: loadMenuCategories()
            │         ├─→ Fetch /categories
            │         └─→ Set availableMenuCategories[]
            ├─→ Call: renderKitchenPrintersList()
            │         └─→ Update DOM with printer form
            └─→ Call: updateAddPrinterButton()
                      └─→ Enable/disable "+ Add Printer"
```

### When Adding Printer
```
User Action: Click "+ Add Printer"
      ↓
addKitchenPrinter()
      ├─→ Check: kitchenPrinters.length < 3
      ├─→ Create new printer object with ID
      ├─→ Push to kitchenPrinters[]
      ├─→ Call: renderKitchenPrintersList()
      │         └─→ Re-render all printers with new one
      └─→ Call: updateAddPrinterButton()
                └─→ Disable button if count === 3
```

### When Saving
```
User Action: Click "✓ Save Kitchen Printers"
      ↓
saveKitchenPrinterConfiguration()
      ├─→ Check: Get restaurantId from localStorage
      ├─→ Call: getKitchenPrinterConfig()
      │         ├─→ Validate kitchen_printers array
      │         ├─→ Check: each printer has categories
      │         ├─→ Return: { kitchen_printers: [...] }
      │         └─→ Throw error if validation fails
      ├─→ Build PATCH payload
      ├─→ Fetch PATCH /printer-settings
      ├─→ If success:
      │         ├─→ Call: updateStatusCards()
      │         ├─→ Show success message
      │         └─→ Call: backToSelection()
      └─→ If error:
              └─→ Show error message
```

---

## 🔌 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Database/API                          │
└─────────────┬───────────────────────────────┬───────────────┘
              │                               │
         GET /printer-settings         PATCH /printer-settings
              │                               │
              └──────────────┬────────────────┘
                             │
                    ┌────────▼─────────┐
                    │ currentPrinter    │
                    │ Settings JSON     │
                    │                   │
                    │ {                 │
                    │   kitchen_printers│◄──┐
                    │   : [...]         │   │
                    │ }                 │   │
                    └─────┬──────┬──────┘   │
                          │      │         │
                    ┌─────▼──┐   │    ┌────▼─────────┐
                    │ Admin  │   │    │ Kitchen      │
                    │Printer │   └───►│ Module State │
                    │JS      │        │              │
                    │        │        │ kitchen      │
                    │Functions        │ Printers []  │
                    └────────┘        └──────────────┘
                          │
                    ┌─────▼──────────────┐
                    │  HTML              │
                    │  (kitchen-format   │
                    │   section)         │
                    │                    │
                    │  ◄───────────────  │
                    │  (re-renders       │
                    │   from module)     │
                    └────────────────────┘
```

---

## 🧩 Module Interface

### Kitchen Module Exports (Global Functions)

```javascript
// Initialization
loadKitchenFormatUI()              // Called by selectPrinterType()
loadKitchenPrintersFromAPI(array)  // Called by loadPrinterSettings()

// UI Rendering  
renderKitchenPrintersList()        // Called internally & by renderMenu functions
updateAddPrinterButton()           // Called internally

// Data Management
getKitchenPrinterConfig()          // Called by saveKitchenPrinterConfiguration()
loadMenuCategories()               // Called by loadKitchenFormatUI()

// User Actions
addKitchenPrinter()                // Called by onclick="addKitchenPrinter()"
removeKitchenPrinter(id)           // Called by onclick="removeKitchenPrinter(...)"
togglePrinterCategory(id, catId)   // Called by onclick="togglePrinterCategory(...)"
updatePrinterName(id, value)       // Called by onchange events
updatePrinterType(id, value)       // Called by onchange events
updatePrinterHost(id, value)       // Called by onchange events
scanBluetoothDeviceForKitchen(id)  // Called by onclick="scanBluetoothDeviceForKitchen(...)"
```

### Data Structures Exposed

```javascript
// Global state (in kitchen module)
kitchenPrinters = [
  { id, name, type, host/bluetoothDevice, categories },
  ...
]

availableMenuCategories = [
  { id, name },
  ...
]
```

### Main JS Variables (in admin-printer.js)

```javascript
// Global state (in main admin-printer.js)
currentPrinterSettings = {
  kitchen_printers: [
    { id, name, type, host/bluetoothDevice, categories },
    ...
  ],
  // ... other settings
}
```

---

## ✅ Integration Completeness Checklist

| Connection Point | Status | Verified |
|------------------|--------|----------|
| HTML loads kitchen module | ✅ | Line 280 |
| selectPrinterType calls loadKitchenFormatUI | ✅ | Line 115 |
| loadKitchenFormatUI initializes | ✅ | Line 30-42 |
| addKitchenPrinter called from HTML | ✅ | onclick="addKitchenPrinter()" |
| removeKitchenPrinter called from HTML | ✅ | onclick="removeKitchenPrinter(...)" |
| togglePrinterCategory called from HTML | ✅ | onclick="togglePrinterCategory(...)" |
| saveKitchenPrinterConfiguration calls getKitchenPrinterConfig | ✅ | Line 973-975 |
| Save function sends to API | ✅ | Line 987-992 |
| loadPrinterSettings loads kitchen_printers | ✅ | Line 1100-1114 |
| loadPrinterSettings calls loadKitchenPrintersFromAPI | ✅ | Line 1111 |
| updateStatusCards handles kitchen | ✅ | Line 318-357 |
| Status card updates after save | ✅ | Line 1009 |

---

## 🐛 Debugging Guide

To trace the flow when something isn't working:

### 1. Check Console Logs
```javascript
// Look for these prefixes:
[admin-printer.js] - Main file logs
[admin-printer-kitchen.js] - Kitchen module logs
```

### 2. Trace Order of Operations
1. Open browser console (F12)
2. Trigger action (select kitchen, add printer, save)
3. Look for console logs in order
4. Compare actual order with expected order above

### 3. Check Function Availability
```javascript
// Paste in console:
console.log(typeof loadKitchenFormatUI)  // Should be 'function'
console.log(typeof getKitchenPrinterConfig)  // Should be 'function'
console.log(typeof saveKitchenPrinterConfiguration)  // Should be 'function'
```

### 4. Check State Values
```javascript
// Paste in console:
console.log(currentPrinterSettings)  // From admin-printer.js
console.log(kitchenPrinters)  // From kitchen module
console.log(availableMenuCategories)  // From kitchen module
```

### 5. Check API Exchange
```javascript
// In Network tab, look for:
GET /restaurants/{id}/printer-settings  // Load
PATCH /restaurants/{id}/printer-settings  // Save
GET /restaurants/{id}/categories  // Categories
```

---

## 📚 Reference Map

Find what you need:

| Need | Location |
|------|----------|
| Understand flow | This file (flow sections) |
| Test kitchen feature | KITCHEN_PRINTER_TESTING_GUIDE.md |
| Implement on mobile | MOBILE_KITCHEN_PRINTING_IMPLEMENTATION.md |
| Overall summary | KITCHEN_PRINTER_INTEGRATION_SUMMARY.md |
| Technical verification | KITCHEN_PRINTER_VERIFICATION.md |
| Add new kitchen function | admin-printer-kitchen.js |
| Connect to save flow | admin-printer.js saveKitchenPrinterConfiguration() |
| See kitchen UI | admin-printer.html kitchen-format-section |

---

**Integration Status**: ✅ COMPLETE AND VERIFIED
