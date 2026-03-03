# 🖨️ Printer Integration Guide - Chuio QR Restaurant

## Overview

This guide provides three approaches to implement automatic order printing in the kitchen and bill printing at checkout:

1. **Browser Print API** (Immediate & Simple) - No additional hardware/server required
2. **Thermal Printer (ESC/POS)** - Network/USB thermal printer integration
3. **POS Webhook Integration** - Send print jobs to existing POS system

---

## Option 1: Browser Print API (Recommended for Quick Start)

### How It Works
- When an order arrives in kitchen, automatically trigger browser print dialog
- Staff hits "Print" to send to their configured printer
- Works with any printer connected to the network

### Implementation

**A. Add print button to kitchen order card**

In `kitchen.js`, update the `renderKitchenOrders()` function to include a print button:

```javascript
// In the order-card actions div (around line 221)
${order.items.some(item => item.status === "pending") ? 
  `<button class="btn-action btn-start" onclick="updateAllItemStatus(${JSON.stringify(order.items.filter(i => i.status === 'pending').map(i => i.order_item_id))}, 'preparing')">Start Preparing</button>
  <button class="btn-action btn-print" onclick="printKitchenOrder(${JSON.stringify(order)})">🖨️ Print</button>` 
  : ...}
```

**B. Add print function to kitchen.js**

```javascript
function printKitchenOrder(order) {
  const printHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Kitchen Order #${order.orderId}</title>
        <style>
          body { font-family: monospace; margin: 0; padding: 10mm; }
          .order-header { text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 5mm; }
          .table-name { font-size: 14px; margin-bottom: 3mm; }
          .order-items { margin: 3mm 0; }
          .item { padding: 2mm 0; border-bottom: 1px dashed #000; }
          .item-details { font-weight: bold; }
          .time { font-size: 10px; margin-top: 3mm; }
          @media print { body { margin: 0; padding: 0; } }
        </style>
      </head>
      <body>
        <div class="order-header">KITCHEN ORDER</div>
        <div class="order-header">#${order.orderId}</div>
        <div class="table-name">${order.table}</div>
        <div class="time">${new Date(order.createdAt).toLocaleTimeString()}</div>
        <div class="order-items">
          ${order.items.map(item => `
            <div class="item">
              <div class="item-details">${item.item_name} x${item.quantity}</div>
              ${item.variants ? `<div style="font-size: 10px;">${item.variants}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </body>
    </html>
  `;
  
  const printWindow = window.open('', '', 'height=600,width=400');
  printWindow.document.write(printHTML);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 250);
}
```

---

## Option 2: Thermal Printer (ESC/POS via Network)

### Setup Requirements
- Thermal printer with network/USB connectivity
- Node.js server-side printer driver
- Printer IP address or USB port

### Step 1: Install Dependencies

```bash
cd backend
npm install escpos escpos-usb escpos-network
npm install --save-dev @types/escpos
```

### Step 2: Create Printer Service

Create `backend/src/services/printerService.ts`:

```typescript
import escpos from "escpos";
import TcpConnection = require("escpos/connection/tcp");
import USBConnection = require("escpos/connection/usb");

interface PrinterConfig {
  type: "network" | "usb";
  host?: string;
  port?: number;
  vendorId?: string;
  productId?: string;
}

interface PrintJobPayload {
  orderNumber: string;
  tableNumber: string;
  items: { name: string; quantity: number; variants?: string }[];
  timestamp: string;
  restaurantName: string;
  type: "kitchen" | "bill";
}

export const printOrder = async (
  config: PrinterConfig,
  payload: PrintJobPayload
): Promise<{ success: boolean; error?: string }> => {
  try {
    let connection;

    if (config.type === "network" && config.host && config.port) {
      connection = new TcpConnection(config.host, config.port);
    } else if (config.type === "usb" && config.vendorId && config.productId) {
      connection = new USBConnection(config.vendorId, config.productId);
    } else {
      throw new Error("Invalid printer configuration");
    }

    const printer = new escpos.Printer(connection);

    await new Promise((resolve) => connection.open(() => resolve(null)));

    // Print header
    printer
      .align("CT")
      .textSize(2, 2)
      .text(payload.restaurantName)
      .textSize(1, 1)
      .text(payload.type.toUpperCase() + " ORDER")
      .text(`Order #${payload.orderNumber}`)
      .text(`Table: ${payload.tableNumber}`)
      .text(payload.timestamp)
      .feed(1)
      .align("LT");

    // Print items
    payload.items.forEach((item) => {
      printer.text(`${item.name.substring(0, 30).padEnd(30)}`);
      printer.text(`x${item.quantity}`);
      if (item.variants) {
        printer.text(`  ${item.variants.substring(0, 28)}`);
      }
    });

    // Print footer
    printer.feed(1).text("---").align("CT").text("Thank you");

    printer.cut().close();

    return { success: true };
  } catch (error) {
    console.error("❌ Printer error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown printer error",
    };
  }
};

export const testPrinterConnection = async (
  config: PrinterConfig
): Promise<{ success: boolean; error?: string }> => {
  try {
    let connection;

    if (config.type === "network" && config.host && config.port) {
      connection = new TcpConnection(config.host, config.port);
    } else if (config.type === "usb" && config.vendorId && config.productId) {
      connection = new USBConnection(config.vendorId, config.productId);
    } else {
      throw new Error("Invalid printer configuration");
    }

    await new Promise((resolve, reject) => {
      connection.open((error: any) => {
        if (error) reject(error);
        else resolve(null);
      });
    });

    connection.close();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
};
```

### Step 3: Add Database Migration

Create `backend/migrations/023_add_printer_settings.sql`:

```sql
-- Add printer configuration to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS printer_type VARCHAR(20) DEFAULT 'none';
-- 'none', 'network', 'usb', 'browser'

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS printer_host VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS printer_port INTEGER DEFAULT 9100;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS printer_usb_vendor_id VARCHAR(50);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS printer_usb_product_id VARCHAR(50);

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS kitchen_auto_print BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS bill_auto_print BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS print_logo BOOLEAN DEFAULT true;
```

### Step 4: Add API Endpoints

Add to `backend/src/routes/settings.routes.ts`:

```typescript
// Update printer settings
router.patch("/restaurants/:restaurantId/printer-settings", async (req, res) => {
  const { restaurantId } = req.params;
  const {
    printer_type,
    printer_host,
    printer_port,
    kitchen_auto_print,
    bill_auto_print,
  } = req.body;

  try {
    const query = `
      UPDATE restaurants
      SET printer_type = $1, 
          printer_host = $2, 
          printer_port = $3, 
          kitchen_auto_print = $4,
          bill_auto_print = $5
      WHERE id = $6
      RETURNING *;
    `;

    const result = await pool.query(query, [
      printer_type,
      printer_host,
      printer_port,
      kitchen_auto_print,
      bill_auto_print,
      restaurantId,
    ]);

    if (result.rowCount === 0) return res.status(404).json({ error: "Restaurant not found" });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update printer settings" });
  }
});

// Get printer settings
router.get("/restaurants/:restaurantId/printer-settings", async (req, res) => {
  const { restaurantId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, printer_type, printer_host, printer_port, kitchen_auto_print, bill_auto_print 
       FROM restaurants WHERE id = $1`,
      [restaurantId]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: "Restaurant not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch printer settings" });
  }
});

// Test printer connection
router.post("/restaurants/:restaurantId/printer-test", async (req, res) => {
  const { restaurantId } = req.params;

  try {
    const result = await pool.query(
      `SELECT printer_type, printer_host, printer_port FROM restaurants WHERE id = $1`,
      [restaurantId]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: "Restaurant not found" });

    const config = result.rows[0];

    if (config.printer_type === "none") {
      return res.json({ success: false, error: "No printer configured" });
    }

    const { testPrinterConnection } = await import("../services/printerService");

    const testResult = await testPrinterConnection({
      type: config.printer_type,
      host: config.printer_host,
      port: config.printer_port,
    });

    res.json(testResult);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Printer test failed" });
  }
});

// Print order immediately
router.post("/restaurants/:restaurantId/print-order", async (req, res) => {
  const { restaurantId } = req.params;
  const { orderId, orderType } = req.body;

  try {
    // Get restaurant printer config
    const restaurantResult = await pool.query(
      `SELECT printer_type, printer_host, printer_port FROM restaurants WHERE id = $1`,
      [restaurantId]
    );

    if (restaurantResult.rowCount === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const printerConfig = restaurantResult.rows[0];

    if (printerConfig.printer_type === "none") {
      return res.status(400).json({ error: "No printer configured" });
    }

    // Get order details
    const orderResult = await pool.query(
      `SELECT oi.order_id, oi.item_name, oi.quantity, oi.variants, ts.table_name, o.created_at, r.name
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN table_sessions ts ON o.session_id = ts.id
       JOIN restaurants r ON o.restaurant_id = r.id
       WHERE oi.order_id = $1 AND o.restaurant_id = $2
       GROUP BY oi.order_id, oi.item_name, oi.quantity, oi.variants, ts.table_name, o.created_at, r.name`,
      [orderId, restaurantId]
    );

    if (orderResult.rowCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Build print payload
    const items = orderResult.rows;
    const payload = {
      orderNumber: orderId,
      tableNumber: items[0].table_name,
      items: items.map((i) => ({
        name: i.item_name,
        quantity: i.quantity,
        variants: i.variants,
      })),
      timestamp: new Date(items[0].created_at).toLocaleTimeString(),
      restaurantName: items[0].name,
      type: orderType || "kitchen",
    };

    const { printOrder } = await import("../services/printerService");
    const printResult = await printOrder(printerConfig, payload);

    res.json(printResult);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to print order" });
  }
});
```

### Step 5: Update Kitchen Dashboard

In `kitchen.js`, when an order arrives, check if auto-print is enabled:

```javascript
async function loadKitchenOrders() {
  // ... existing code ...

  // After orders loaded, check for auto-print
  if (allowAutoPrintKitchen) {
    for (const order of Object.values(orderMap)) {
      if (order.items.some(i => i.status === "pending")) {
        // Auto-print new pending orders
        await fetch(
          `${API_BASE}/restaurants/${restaurantId}/print-order`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: order.orderId,
              orderType: "kitchen"
            })
          }
        ).catch(err => console.log("Auto-print skipped:", err));
      }
    }
  }

  // ... rest of code ...
}
```

---

## Option 3: Hybrid Approach (Recommended)

### Combine Browser Print + Optional Thermal

Configure in admin settings:
- **Default**: Browser print (no special hardware needed)
- **Optional**: Thermal printer for advanced setup
- **Auto-Print**: Enable/disable auto-print for kitchen and bills

---

## Quick Start Checklist

### For Browser Print Only:
- [ ] Add print button to kitchen.html
- [ ] Add `printKitchenOrder()` function to kitchen.js
- [ ] Test printing from kitchen dashboard

### For Thermal Printer:
- [ ] Run migration: `npm run migrate`
- [ ] Install escpos: `npm install escpos escpos-network`
- [ ] Create printer service (Option 2, Step 2)
- [ ] Add API endpoints for printer settings
- [ ] Configure printer in admin settings
- [ ] Test printer connection

### For Bill Printing:
- [ ] Add print button to bill modal (in admin-tables.js)
- [ ] Apply same printer logic to bill printing
- [ ] Test bill printing flow

---

## Configuration in Admin

Add this section to `admin-settings.html`:

```html
<!-- Printer Settings Modal -->
<div id="printer-settings" class="settings-modal">
  <div class="settings-modal-content">
    <h2>🖨️ Printer Settings</h2>

    <div class="form-group">
      <label>Printer Type</label>
      <select id="printer-type" onchange="updatePrinterType()">
        <option value="none">No Printer (Browser Print Only)</option>
        <option value="network">Network Thermal Printer</option>
        <option value="usb">USB Thermal Printer</option>
      </select>
    </div>

    <div id="network-printer" style="display: none;">
      <div class="form-group">
        <label>Printer IP Address</label>
        <input type="text" id="printer-host" placeholder="192.168.1.100" />
      </div>
      <div class="form-group">
        <label>Printer Port</label>
        <input type="number" id="printer-port" placeholder="9100" value="9100" />
      </div>
    </div>

    <div class="form-group">
      <label>
        <input type="checkbox" id="kitchen-auto-print" />
        Auto-print orders in kitchen
      </label>
    </div>

    <div class="form-group">
      <label>
        <input type="checkbox" id="bill-auto-print" />
        Auto-print bills at checkout
      </label>
    </div>

    <button onclick="savePrinterSettings()" class="btn-primary">Save Settings</button>
    <button onclick="testPrinterConnection()" class="btn-secondary">Test Connection</button>
  </div>
</div>
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Printer not printing | Check network connectivity, verify IP/port, test with admin |
| ESC/POS formatting issues | Adjust character width/height in printerService |
| Browser print too slow | Pre-format HTML, reduce image size |
| Auto-print not triggering | Check `kitchen_auto_print` flag in database |

---

## Summary

- **Start with Option 1** (Browser Print) - Works immediately, no setup
- **Add Option 2** (Thermal) - When ready for automated printing
- **Enable Auto-Print** - For kitchen efficiency

