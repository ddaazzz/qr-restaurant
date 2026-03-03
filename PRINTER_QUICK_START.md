# 🖨️ Quick Start: Printer Implementation

## Step-by-Step Implementation

### Phase 1: Browser Print (5 minutes - No Hardware Required)

#### 1.1 Add Print Script to Kitchen HTML

**File:** `frontend/kitchen.html`

Add this before the closing `</body>` tag:

```html
<script src="kitchen-printing.js"></script>
```

#### 1.2 Update Kitchen HTML - Add Print Button

**File:** `frontend/kitchen.html`

Find the kitchen app closing div and add a settings button:

```html
<div class="kitchen-header-right">
  <!-- ... existing buttons ... -->
  <button id="kitchen-settings-btn" class="btn-secondary" onclick="openKitchenPrinterSettings()" style="margin-right: 10px;">
    🖨️ Printer
  </button>
</div>
```

#### 1.3 Update Kitchen to Include Print Actions

**File:** `frontend/kitchen.js`

Find the `renderKitchenOrders()` function around line 200, and update the action buttons to include print:

```javascript
// Find this section around line 217:
${order.items.some(item => item.status === "pending") ? 
  `<button class="btn-action btn-start" onclick="updateAllItemStatus(${JSON.stringify(order.items.filter(i => i.status === 'pending').map(i => i.order_item_id))}, 'preparing')">Start Preparing</button>` 
  : ...}

// Change it to:
${order.items.some(item => item.status === "pending") ? 
  `<button class="btn-action btn-start" onclick="updateAllItemStatus(${JSON.stringify(order.items.filter(i => i.status === 'pending').map(i => i.order_item_id))}, 'preparing')">Start Preparing</button>
  <button class="btn-action btn-print" onclick="kitchenPrinting.print(${JSON.stringify(order)}, '${localStorage.getItem('restaurantName') || 'Restaurant'}')">🖨️ Print</button>` 
  : ...}
```

#### 1.4 Add Print CSS to Kitchen

**File:** `frontend/kitchen.css`

Add at the end:

```css
/* Print Button Styling */
.btn-print {
  background-color: #2563eb;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-left: 5px;
}

.btn-print:hover {
  background-color: #1d4ed8;
}

.btn-print:active {
  transform: scale(0.98);
}
```

#### 1.5 Test Browser Printing

1. Start the backend: `npm run dev` (from backend folder)
2. Open kitchen dashboard at `http://localhost:10000/kitchen.html`
3. Login with kitchen PIN
4. Place an order via admin dashboard
5. Click "🖨️ Print" button on the order in kitchen
6. Verify browser print dialog opens
7. Print to your local printer

---

### Phase 2: Database Setup (For Optional Thermal Printer)

#### 2.1 Run Migration

```bash
cd backend
npm run migrate
```

This creates:
- `printer_type`, `printer_host`, `printer_port` columns in `restaurants`
- `kitchen_auto_print`, `bill_auto_print` flags
- `printer_jobs` audit table

#### 2.2 Verify Migration (Optional)

```bash
# Check PostgreSQL
psql -U postgres -d chuio -c "\d restaurants" | grep printer
```

---

### Phase 3: API Endpoints (For Admin Configuration)

#### 3.1 Add Printer Routes to App

**File:** `backend/src/app.ts`

Find where routes are imported (around line 50) and add:

```typescript
import printerRoutes from "./routes/printer.routes";

// Then add to app setup (after other routes):
app.use("/api", printerRoutes);
```

#### 3.2 Test API Endpoints

```bash
# Get printer settings
curl http://localhost:10000/api/restaurants/1/printer-settings

# Update settings
curl -X PATCH http://localhost:10000/api/restaurants/1/printer-settings \
  -H "Content-Type: application/json" \
  -d '{
    "printer_type": "browser",
    "kitchen_auto_print": true
  }'

# Test printer
curl -X POST http://localhost:10000/api/restaurants/1/printer-test
```

---

### Phase 4: Admin Settings UI (For Configuration)

#### 4.1 Add Printer Settings to Admin

**File:** `frontend/admin.html`

Add these scripts to the `<head>`:

```html
<script src="admin-printer-settings.js"></script>
```

#### 4.2 Add Printer Settings Modal

**File:** `frontend/admin-settings.html`

Add this before the closing `</div>`:

```html
<!-- Printer Settings Card -->
<div class="settings-card" onclick="openSettingsModal('printer-settings')">
  <h3>🖨️ Printer Settings</h3>
  <p id="printer-status-preview">Not configured</p>
</div>

<!-- Printer Settings Modal (hidden) -->
<div id="printer-settings-modal" class="settings-modal" style="display: none;">
  <div class="settings-modal-content">
    <div class="modal-header">
      <h2>🖨️ Printer Settings</h2>
      <button class="close-btn" onclick="closeSettingsModal('printer-settings')">&times;</button>
    </div>
    <div class="modal-body">
      
      <!-- Printer Type Selection -->
      <div class="form-group">
        <label for="printer-type" data-i18n="admin.printer-type">Printer Type</label>
        <select id="printer-type" onchange="updatePrinterTypeUI(this.value)">
          <option value="none">No Printer (Browser Print Only)</option>
          <option value="browser">Browser Print</option>
          <option value="network">Network Thermal Printer</option>
          <option value="usb">USB Thermal Printer</option>
        </select>
      </div>

      <!-- Network Printer Settings -->
      <div id="network-printer-config" style="display: none;">
        <div class="form-group">
          <label for="printer-host" data-i18n="admin.printer-host">Printer IP Address</label>
          <input type="text" id="printer-host" placeholder="192.168.1.100" />
        </div>
        <div class="form-group">
          <label for="printer-port" data-i18n="admin.printer-port">Printer Port</label>
          <input type="number" id="printer-port" placeholder="9100" value="9100" />
        </div>
      </div>

      <!-- USB Printer Settings -->
      <div id="usb-printer-config" style="display: none;">
        <div class="form-group">
          <label for="printer-usb-vendor" data-i18n="admin.printer-vendor">USB Vendor ID</label>
          <input type="text" id="printer-usb-vendor" placeholder="0001" />
        </div>
        <div class="form-group">
          <label for="printer-usb-product" data-i18n="admin.printer-product">USB Product ID</label>
          <input type="text" id="printer-usb-product" placeholder="0001" />
        </div>
      </div>

      <!-- Auto-Print Settings -->
      <div id="auto-print-settings" style="display: none;">
        <hr style="margin: 20px 0;">
        <h3 data-i18n="admin.auto-print-settings">Auto-Print Settings</h3>
        
        <div class="form-group">
          <label>
            <input type="checkbox" id="kitchen-auto-print" />
            <span data-i18n="admin.kitchen-auto-print">Auto-print kitchen orders</span>
          </label>
          <small data-i18n="admin.kitchen-auto-print-desc">Orders print automatically when sent to kitchen</small>
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" id="bill-auto-print" />
            <span data-i18n="admin.bill-auto-print">Auto-print bills at checkout</span>
          </label>
          <small data-i18n="admin.bill-auto-print-desc">Bills print automatically when closing table</small>
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" id="print-logo" checked />
            <span data-i18n="admin.print-logo">Include logo on receipts</span>
          </label>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="modal-footer">
        <button onclick="testPrinterConnection()" class="btn-secondary">
          🖨️ <span data-i18n="admin.test-printer">Test Connection</span>
        </button>
        <button onclick="savePrinterSettings()" class="btn-primary">
          ✓ <span data-i18n="admin.save-settings">Save Settings</span>
        </button>
      </div>
    </div>
  </div>
</div>
```

#### 4.3 Add Modal Functions to Admin

**File:** `frontend/admin-settings.js`

Add these functions if not already present:

```javascript
function openSettingsModal(modalId) {
  const modal = document.getElementById(modalId + '-modal');
  if (modal) {
    modal.style.display = 'flex';
    if (modalId === 'printer-settings') {
      window.printerSettings?.load();
    }
  }
}

function closeSettingsModal(modalId) {
  const modal = document.getElementById(modalId + '-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}
```

---

### Phase 5: Translations (Multi-Language Support)

#### 5.1 Add English Translations

**File:** `frontend/translations.js`

Add to the English section:

```javascript
'admin.printer-type': 'Printer Type',
'admin.printer-host': 'Printer IP Address',
'admin.printer-port': 'Port',
'admin.printer-vendor': 'USB Vendor ID',
'admin.printer-product': 'USB Product ID',
'admin.auto-print-settings': 'Auto-Print Settings',
'admin.kitchen-auto-print': 'Auto-print kitchen orders',
'admin.kitchen-auto-print-desc': 'Orders print automatically when sent to kitchen',
'admin.bill-auto-print': 'Auto-print bills',
'admin.bill-auto-print-desc': 'Bills print automatically at checkout',
'admin.print-logo': 'Include logo on receipts',
'admin.test-printer': 'Test Connection',
```

#### 5.2 Add Chinese Translations

**File:** `frontend/translations.js`

Add to the Chinese section (zh):

```javascript
'admin.printer-type': '打印機類型',
'admin.printer-host': '打印機IP地址',
'admin.printer-port': '端口',
'admin.printer-vendor': 'USB供應商ID',
'admin.printer-product': 'USB產品ID',
'admin.auto-print-settings': '自動打印設置',
'admin.kitchen-auto-print': '自動打印廚房訂單',
'admin.kitchen-auto-print-desc': '訂單發送到廚房時自動打印',
'admin.bill-auto-print': '自動打印帳單',
'admin.bill-auto-print-desc': '結帳時自動打印帳單',
'admin.print-logo': '在收據上包含徽標',
'admin.test-printer': '測試連接',
```

---

### Phase 6: Optional - Thermal Printer Support

**Only if you have a thermal printer connected:**

#### 6.1 Install ESC/POS Driver

```bash
cd backend
npm install escpos escpos-network
```

#### 6.2 Configure in Admin

1. Go to Settings → Printer Settings
2. Select "Network Thermal Printer" or "USB Thermal Printer"
3. Enter IP address and port (default: 9100 for network)
4. Click "Test Connection"
5. Enable "Auto-print orders in kitchen"

---

## Testing Checklist

- [ ] Browser print button appears in kitchen dashboard
- [ ] Print dialog opens when button clicked
- [ ] Can successfully print to local printer
- [ ] No JavaScript errors in browser console
- [ ] Kitchen dashboard still loads all orders correctly
- [ ] Print button appears next to "Start Preparing" action
- [ ] Print layout is receipt-sized (80mm width recommended)

---

## Troubleshooting

### Print Dialog Doesn't Open
- Check browser popup blocker settings
- Verify browser console for errors
- Try printing to "Print to File" first

### Thermal Printer Not Found
- Verify printer is connected and powered on
- Check IP address: `ping 192.168.x.x`
- Verify port 9100 is open: `telnet 192.168.x.x 9100`
- Install escpos driver: `npm install escpos escpos-network`

### Translations Not Working
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh (Ctrl+Shift+R)
- Check language is set correctly in localStorage

---

## Files Modified/Created

| File | Purpose |
|------|---------|
| `frontend/kitchen-printing.js` | Kitchen print functions |
| `frontend/admin-printer-settings.js` | Admin configuration UI |
| `frontend/kitchen.html` | Add print script link |
| `frontend/kitchen.js` | Add print button to orders |
| `frontend/kitchen.css` | Print button styling |
| `frontend/admin-settings.html` | Printer settings modal |
| `frontend/admin-settings.js` | Modal open/close functions |
| `frontend/translations.js` | Multi-language support |
| `backend/migrations/023_add_printer_settings.sql` | Database schema |
| `backend/src/services/printerService.ts` | Thermal printer driver |
| `backend/src/routes/printer.routes.ts` | API endpoints |
| `backend/src/app.ts` | Register printer routes |

---

## Next Steps

1. **Start with Phase 1** - Get browser printing working
2. **Test thoroughly** - Verify all orders print correctly
3. **Add Phase 4** - Configure in admin settings
4. **Add Phase 6** - Only if you have a thermal printer

---

## Support

**For thermal printer issues:**
- ESC/POS documentation: https://github.com/song940/escpos
- Thermal printer manuals
- Network printer IP discovery tools

**For browser print issues:**
- Check browser's print preview
- Verify printer driver is installed on server machine
- Test print to PDF first

