# Mobile App QR Code Printing Format - Complete Implementation

**Date:** March 20, 2026  
**File Location:** `mobile/src/services/thermalPrinterService.ts`  
**Related Screen:** `mobile/src/screens/admin/TablesTab.tsx`

---

## 1. QR Receipt Data Structure

### ReceiptData Interface
The mobile app uses this interface to define QR receipt data:

```typescript
export interface ReceiptData {
  orderNumber?: string;
  tableNumber?: string;
  pax?: number;
  startTime?: string;
  items?: Array<{ name: string; quantity: number; price?: number }>;
  subtotal?: number;
  serviceCharge?: number;
  total?: number;
  timestamp?: string;
  restaurantName?: string;
  qrCode?: string; // QR code data/token to print
  printerPaperWidth?: number; // Paper width in mm (80 for standard, 58 for smaller)
}
```

---

## 2. QR Code Only Receipt Format (No Items)

When the receipt contains a QR code but no items, the layout is:

### Receipt Layout (ESC/POS)
```
[Center] RESTAURANT_NAME (bold)
         Table: TABLE_NAME
         Pax: PAX_COUNT

[Center] [LARGE QR CODE - Main focus]

[Center] Scan to Order
         Time: START_TIME
```

### ESC/POS Code Generation (From thermalPrinterService.ts)

```typescript
if (receipt.qrCode && (!receipt.items || receipt.items.length === 0)) {
  // QR-only layout: minimal header, huge QR code, footer text
  
  // Small header with restaurant/table info
  commands.push(27, 97, 1); // ESC 'a' 1 - Center
  if (receipt.restaurantName && receipt.restaurantName !== 'QR Code') {
    commands.push(27, 33, 8); // ESC '!' 8 - Bold
    this.appendText(commands, receipt.restaurantName);
    commands.push(27, 33, 0); // ESC '!' 0 - Normal
    commands.push(10); // LF
  }
  
  if (receipt.tableNumber) {
    this.appendText(commands, `Table: ${receipt.tableNumber}`);
    commands.push(10);
  }
  
  if (receipt.pax) {
    this.appendText(commands, `Pax: ${receipt.pax}`);
    commands.push(10);
  }
  
  commands.push(10); // LF
  
  // === LARGE QR CODE - Main focus of receipt ===
  commands.push(27, 97, 1); // ESC 'a' 1 - Center
  this.appendQRCode(commands, receipt.qrCode, receipt.printerPaperWidth);
  commands.push(10, 10); // LF x2
  
  // Footer text
  commands.push(27, 97, 1); // ESC 'a' 1 - Center
  this.appendText(commands, 'Scan to Order');
  commands.push(10);
  
  if (receipt.startTime) {
    this.appendText(commands, `Time: ${receipt.startTime}`);
    commands.push(10);
  }
  
  commands.push(10, 10); // LF x2
  
  // Paper feed and cut
  commands.push(27, 100, 5); // ESC d 5 - Feed paper 5 lines
  commands.push(27, 105); // ESC i - Full cut
  
  return new Uint8Array(commands);
}
```

---

## 3. Regular Receipt with Items + QR Code

When items are present, the format is:

### Complete Receipt Layout
```
[Center] RESTAURANT_NAME
[Center] ========================================

[Left]   Table: TABLE_NAME
         Order: ORDER_NUMBER
         Time: TIMESTAMP

[Center] ========================================

[Center] ITEMS
[Left]   Item Name
         x2  Price

[Left]   ========================================
         Subtotal             $XX.XX
         Service Charge       $X.XX
         TOTAL                $XX.XX

[Center] [QR CODE]

[Center] Time: START_TIME
         Scan to Place Order
```

### ESC/POS Code for Regular Receipt with QR

```typescript
// === HEADER SECTION ===
commands.push(27, 97, 1); // ESC 'a' 1 - Center
if (receipt.restaurantName) {
  this.appendText(commands, receipt.restaurantName);
  commands.push(10); // LF
} else {
  this.appendText(commands, 'RECEIPT');
  commands.push(10);
}

this.appendText(commands, '========================================');
commands.push(10, 10);

// === DETAIL SECTION - LEFT ALIGNED ===
commands.push(27, 97, 0); // ESC 'a' 0 - Left align

if (receipt.tableNumber) {
  this.appendText(commands, `Table: ${receipt.tableNumber}`);
  commands.push(10);
}
if (receipt.orderNumber) {
  this.appendText(commands, `Order: ${receipt.orderNumber}`);
  commands.push(10);
}

if (receipt.timestamp) {
  this.appendText(commands, `Time: ${receipt.timestamp}`);
  commands.push(10);
}

commands.push(10);
this.appendText(commands, '========================================');
commands.push(10, 10);

// === ITEMS SECTION ===
if (receipt.items && receipt.items.length > 0) {
  commands.push(27, 97, 1); // Center
  this.appendText(commands, 'ITEMS');
  commands.push(10);

  commands.push(27, 97, 0); // Left
  commands.push(10);

  for (const item of receipt.items) {
    const qtyStr = `x${item.quantity}`;
    const priceStr = item.price ? `${(item.price / 100).toFixed(2)}` : '';

    this.appendText(commands, item.name);
    commands.push(10);

    if (priceStr) {
      const line = `  ${qtyStr}`.padEnd(20) + priceStr;
      this.appendText(commands, line);
    } else {
      this.appendText(commands, `  ${qtyStr}`);
    }
    commands.push(10);
  }

  commands.push(10);
  this.appendText(commands, '========================================');
  commands.push(10, 10);
}

// === TOTALS SECTION ===
commands.push(27, 97, 0); // Left align

if (receipt.subtotal !== undefined) {
  const subtotalStr = (receipt.subtotal / 100).toFixed(2);
  this.appendText(commands, `Subtotal             ${subtotalStr}`);
  commands.push(10);
}

if (receipt.serviceCharge && receipt.serviceCharge > 0) {
  const chargeStr = (receipt.serviceCharge / 100).toFixed(2);
  this.appendText(commands, `Service Charge       ${chargeStr}`);
  commands.push(10);
}

if (receipt.total !== undefined) {
  commands.push(27, 33, 8); // ESC '!' 8 - Bold on
  const totalStr = (receipt.total / 100).toFixed(2);
  this.appendText(commands, `TOTAL                ${totalStr}`);
  commands.push(10);
  commands.push(27, 33, 0); // ESC '!' 0 - Normal
}

commands.push(10, 10);

// === QR CODE SECTION ===
if (receipt.qrCode) {
  commands.push(27, 97, 1); // ESC 'a' 1 - Center
  this.appendQRCode(commands, receipt.qrCode, receipt.printerPaperWidth);
  commands.push(10, 10);
}

// === FOOTER SECTION ===
commands.push(27, 97, 1); // Center

if (receipt.startTime) {
  this.appendText(commands, `Time: ${receipt.startTime}`);
  commands.push(10);
}

this.appendText(commands, 'Scan to Place Order');
commands.push(10, 10, 10);

// === PAPER FEED BEFORE CUT ===
commands.push(27, 100, 5); // ESC d 5 - Feed paper 5 lines
commands.push(27, 105); // ESC i - Full cut
```

---

## 4. QR Code Generation (GS ( k Format)

### Function: appendQRCode()

```typescript
private appendQRCode(commands: number[], qrData: string, printerPaperWidth?: number): void {
  // GS ( k for QR code
  // Format: GS ( k pL pH cn fnm m d...
  
  const dataBytes = qrData.split('').map(c => c.charCodeAt(0));
  const dataLength = dataBytes.length;
  
  // Adaptive module size based on printer paper width
  // For QR-only receipts, use maximum module size to fill the paper
  // 80mm printers: module size 12 (~full paper width QR code)
  // 58mm printers: module size 10 (~full paper width QR code)
  let moduleSize = 12; // doubled from 6 for larger QR
  if (printerPaperWidth && printerPaperWidth < 70) {
    moduleSize = 10; // doubled from 5 for larger QR
  }
  
  // Set QR code model: GS ( k pL pH 49 65 50 model (1, 2, or 3)
  // Model 2 is most compatible
  commands.push(29, 40, 107); // GS ( k
  commands.push(4, 0); // pL=4, pH=0 (total 4 bytes)
  commands.push(49, 65); // cn=49, fnm=65
  commands.push(50); // model=50 (Model 2)
  commands.push(0); // extra param
  
  // Set QR code size: GS ( k pL pH 49 67 size
  commands.push(29, 40, 107); // GS ( k
  commands.push(3, 0); // pL=3, pH=0
  commands.push(49, 67); // cn=49, fnm=67
  commands.push(moduleSize); // size in modules
  
  // Set QR code data: GS ( k pL pH 49 80 48 d...
  const pL = (dataLength + 3) & 0xFF;
  const pH = ((dataLength + 3) >> 8) & 0xFF;
  commands.push(29, 40, 107); // GS ( k
  commands.push(pL, pH); // data length
  commands.push(49, 80); // cn=49, fnm=80
  commands.push(48); // fn2=48
  for (const byte of dataBytes) {
    commands.push(byte);
  }
  
  // Print QR code: GS ( k pL pH 49 81 48
  commands.push(29, 40, 107); // GS ( k
  commands.push(3, 0); // pL=3, pH=0
  commands.push(49, 81); // cn=49, fnm=81
  commands.push(48); // fn2=48
}
```

### QR Code Data Format:
- **Data Type:** URL string
- **Example:** `https://chuio.io/abc123xyz`
- **Encoding:** ASCII bytes (character.charCodeAt(0))
- **Length:** Variable (typically 20-50 bytes)

### Module Size (Paper Width Detection):
```
80mm printer → moduleSize = 12
58mm printer → moduleSize = 10
Default      → moduleSize = 12
```

---

## 5. Bluetooth Printer Integration

### Receipt Data Construction (from TablesTab.tsx)

```typescript
const receiptData = {
  restaurantName: restaurantName || 'Restaurant',
  tableNumber: table.name,
  pax: newSession.pax,
  startTime: startTimeStr,  // Formatted as "HH:MM AM/PM"
  qrCode: `https://chuio.io/${qrToken}`,
  printerPaperWidth: printerSettings?.printer_paper_width || 80,
};

await thermalPrinterService.sendToBluetooth(
  manager,
  printRes.data.bluetoothPayload.printerConfig.bluetoothDeviceId,
  receiptData,
  30000  // 30 second timeout
);
```

### Bluetooth Transmission:

```typescript
async sendToBluetooth(
  manager: any,
  deviceId: string,
  receiptData: ReceiptData,
  timeout: number = 15000
): Promise<boolean> {
  // 1. Generate ESC/POS commands
  const escposData = this.generateESCPOS(receiptData);

  // 2. Connect to Bluetooth device
  let device = await manager.connectToDevice(deviceId, { timeout });

  // 3. Discover services and characteristics
  await device.discoverAllServicesAndCharacteristics();

  // 4. Authenticate with PIN "0000"
  const isAuthenticated = await this.authenticateWithPrinter(device, '0000');

  // 5. Initialize printer after authentication
  await this.initializePrinterAfterAuth(mainWriteChar);

  // 6. Send data in 20-byte chunks
  const chunkSize = 20;
  for (let i = 0; i < escposData.length; i += chunkSize) {
    const chunk = escposData.slice(i, Math.min(i + chunkSize, escposData.length));
    const chunkBase64 = this.arrayToBase64(Array.from(chunk));
    
    if (writeCharacteristic.isWritableWithoutResponse) {
      await writeCharacteristic.writeWithoutResponse(chunkBase64);
    } else {
      await writeCharacteristic.write(chunkBase64);
    }
    
    // Wait 100ms between chunks
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return true;
}
```

### Authentication Process:

```typescript
private async authenticateWithPrinter(
  device: any,
  pin: string = '0000'
): Promise<boolean> {
  try {
    const chars = await device.characteristicsForService(
      '49535343-fe7d-4ae5-8fa9-9fafd205e455'
    );
    
    for (const char of chars) {
      if (char.isWritableWithoutResponse || char.isWritable) {
        // Send PIN as ASCII bytes WITH newline terminator
        const pinBytes = pin.split('').map(c => c.charCodeAt(0));
        pinBytes.push(13); // Add CR
        pinBytes.push(10); // Add LF
        
        const pinBase64 = this.arrayToBase64(pinBytes);
        
        if (char.isWritableWithoutResponse) {
          await char.writeWithoutResponse(pinBase64);
        } else {
          await char.write(pinBase64);
        }
        
        // Wait 1500ms for authentication to process
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        return true;
      }
    }
  } catch (err: any) {
    console.error('[ThermalPrinter] Authentication error:', err.message);
  }
  
  return true; // Continue anyway
}
```

### Printer Initialization:

```typescript
private async initializePrinterAfterAuth(char: any): Promise<void> {
  try {
    const initCommands: number[] = [];
    
    // DLE EOT - Real-time status query (wakes printer)
    initCommands.push(0x10, 0x04);
    
    // ESC @ - Initialize printer
    initCommands.push(27, 64);
    
    // Line spacing: ESC '3' 30
    initCommands.push(27, 51, 30);
    
    // Font selection: ESC M 0
    initCommands.push(27, 77, 0);
    
    // Alignment: ESC 'a' 1 (center)
    initCommands.push(27, 97, 1);
    
    const initBase64 = this.arrayToBase64(initCommands);
    
    if (char.isWritableWithoutResponse) {
      await char.writeWithoutResponse(initBase64);
    } else {
      await char.write(initBase64);
    }
    
    // Wait 300ms for initialization
    await new Promise(resolve => setTimeout(resolve, 300));
  } catch (e: any) {
    console.warn('[ThermalPrinter] initialization after auth failed:', e.message);
  }
}
```

---

## 6. Browser Printing (HTML Format)

### HTML QR Receipt Template (generateQRHTML function)

For browser and network printers, the mobile app generates HTML:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>QR Code - TABLE_NAME</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: 'Courier New', monospace; 
        padding: 12px; 
        background: #fff; 
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
      }
      .receipt { 
        width: 100%; 
        text-align: center; 
        font-size: 12px; 
        line-height: 1.5; 
        max-width: 80mm; 
        margin: 0 auto; 
      }
      .header { 
        border-bottom: 2px dashed #000; 
        padding-bottom: 8px; 
        margin-bottom: 8px; 
      }
      .restaurant-name { 
        font-weight: bold; 
        font-size: 18px; 
        margin-bottom: 4px; 
      }
      .divider { 
        border-bottom: 1px dashed #000; 
        margin: 8px 0; 
      }
      .info-section { 
        text-align: left; 
        margin: 8px 0; 
        font-size: 11px; 
        line-height: 1.8;
      }
      .info-row { 
        display: flex; 
        justify-content: space-between; 
        margin-bottom: 2px; 
      }
      .info-label { 
        font-weight: bold; 
      }
      #qrcode { 
        display: flex; 
        justify-content: center; 
        margin: 12px 0; 
      }
      #qrcode img { 
        max-width: 100%;
        height: auto;
        width: 200px;
        height: 200px;
      }
      .scan-instruction { 
        font-weight: bold; 
        font-size: 12px; 
        margin: 8px 0; 
      }
      .footer { 
        font-size: 10px; 
        color: #666; 
        margin-top: 8px; 
      }
      @media print { 
        body { margin: 0; padding: 8px; } 
        .receipt { width: 80mm; } 
        #qrcode img { width: 70mm; height: 70mm; }
      }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="header">
        <div class="restaurant-name">RESTAURANT_NAME</div>
      </div>
      
      <div class="info-section">
        <div class="info-row">
          <span class="info-label">Table:</span>
          <span>TABLE_NAME</span>
        </div>
        <div class="info-row">
          <span class="info-label">Pax:</span>
          <span>PAX_COUNT</span>
        </div>
        <div class="info-row">
          <span class="info-label">Started:</span>
          <span>SESSION_START_TIME</span>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <div id="qrcode">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&data=..." alt="QR Code" />
      </div>
      
      <div class="scan-instruction">Scan to Order</div>
      
      <div class="footer">
        <p style="margin-top: 8px;">Let us know how we did!</p>
      </div>
    </div>
    <script>
      window.onload = () => { setTimeout(() => window.print(), 500); };
      window.onafterprint = () => window.close();
    </script>
  </body>
</html>
```

### QR Code Image Generation:

```typescript
const qrDataUrl = `https://chuio.io/${qrToken}`;
const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&data=${encodeURIComponent(qrDataUrl)}`;
```

---

## 7. Fields Included in Mobile QR Receipt

### QR Receipt Includes:
- ✅ **Restaurant Name** - Bold, centered header
- ✅ **Table Number/Name** - Left-aligned or centered in header
- ✅ **Pax Count** - Number of guests
- ✅ **Start Time** - Session start time (formatted as HH:MM AM/PM)
- ✅ **QR Code** - URL pointing to ordering system
- ✅ **QR Code Text Above** - "Scan to Order" (customizable)
- ✅ **QR Code Text Below** - "Let us know how we did!" (customizable)
- ✅ **Paper Width** - Auto-detected (80mm or 58mm)

### Regular Receipt with QR Includes:
- ✅ Restaurant Name
- ✅ Table Number
- ✅ Order Number
- ✅ Timestamp
- ✅ Item List (name, quantity, price)
- ✅ Subtotal
- ✅ Service Charge
- ✅ Total (bold)
- ✅ QR Code (centered section)
- ✅ Scan to Place Order text
- ✅ Start Time

---

## 8. Comparison: Mobile vs Web App QR Printing

| Feature | Mobile | Web |
|---------|--------|-----|
| **Method** | Bluetooth + ESC/POS | Web Bluetooth + ESC/POS |
| **Authentication** | PIN "0000" with 1500ms wait | No PIN required |
| **Chunk Size** | 20 bytes | Larger chunks |
| **Paper Sizes** | 80mm, 58mm detection | Fixed 80mm |
| **Module Size** | 12 (80mm), 10 (58mm) | Fixed module size |
| **QR Data** | URL string (https://chuio.io/{token}) | Same |
| **Fields** | Table, Pax, Time, QR, Text | Same |
| **Printer Types** | Bluetooth, Network, Browser | Bluetooth, Network, Browser |
| **Data Encoding** | Base64 (react-native-ble-plx) | Raw bytes (Web API) |
| **Header Info** | Restaurant, Table, Pax | Same |
| **Footer Text** | Can customize via settings | Can customize via settings |

---

## 9. Key Implementation Details

### Critical Settings:
- **QR Auto-Print:** Enabled via `printerSettings.qr_auto_print`
- **Printer Type:** `qr_printer_type` (bluetooth | network | browser)
- **Paper Width:** `printer_paper_width` (80 | 58)
- **QR Text:** Custom from `qr_text_above` and `qr_text_below`
- **Bluetooth Device ID:** From printer configuration

### Timing:
- Authentication wait: **1500ms**
- Initialization wait: **300ms**
- Chunk send delay: **100ms** between chunks
- Total connection timeout: **15000-30000ms**

### Error Handling:
- Falls back to browser print if printer unavailable
- Continues if authentication fails
- Supports multiple printer types seamlessly
- Validates device connectivity before sending

---

## 10. File References

- **QR Printing Service:** `mobile/src/services/thermalPrinterService.ts`
- **Screen Implementation:** `mobile/src/screens/admin/TablesTab.tsx` (lines 650-750, 920-1100)
- **Printer Settings Service:** `mobile/src/services/printerSettingsService.ts`
- **Bluetooth Service:** `mobile/src/services/bluetoothService.ts`
