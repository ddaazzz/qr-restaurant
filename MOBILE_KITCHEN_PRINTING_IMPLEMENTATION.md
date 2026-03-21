# Mobile Kitchen Order Printing Implementation Guide

## 📱 Overview

This guide outlines how to implement kitchen order printing on mobile apps (both React Native/Expo and web-based mobile).

---

## 🏗️ Architecture

### Mobile Implementation Strategy

```
Mobile App Kitchen Flow:
1. Load Kitchen Settings from API
   ↓
2. When Order Ready to Print
   ↓
3. Determine Item Categories
   ↓
4. Match Categories to Printer Assignment
   ↓
5. Format Order for Thermal Printer
   ↓
6. Send Print Job via Bluetooth/Network
   ↓
7. Confirm Printing Status
```

---

## 📋 Phase 1: Kitchen Settings Screen

### What to Display
```
Kitchen Printers
├─ Printer 1: "Main Kitchen" [Network: 192.168.1.100] → [Appetizers, Main Courses]
├─ Printer 2: "Salad Station" [Bluetooth: BT_PRINTER_001] → [Salads, Vegetables]
└─ Printer 3: "Desert Station" [Network: 192.168.1.101] → [Desserts, Beverages]
```

### UI Components Needed
1. **List Screen**: Show all configured kitchen printers
   - Printer name
   - Connection type & details
   - Assigned categories
   - Edit/Delete buttons

2. **Detail Screen**: Show printer configuration
   - Edit printer properties
   - Update category assignments
   - Test print functionality

3. **Settings Integration**: 
   - Link from Main Settings
   - Similar to QR/Bill printer settings

### Code Location
- Webapp: `frontend/admin-printer.html` & `admin-printer.js`
- Mobile: `mobile/src/screens/admin/SettingsTab.tsx` (add new component)

---

## 🖨️ Phase 2: Kitchen Order Printing Logic

### When to Print
Kitchen orders should print when:
1. Customer places order
2. Order contains kitchen items (not all items are for display only)
3. Restaurant has kitchen printers configured

### Printing Flow

```javascript
async function printKitchenOrder(orderId) {
  // 1. Get order details
  const order = await getOrder(orderId);
  
  // 2. Get kitchen printer configuration
  const printerSettings = await loadKitchenPrinterSettings();
  
  // 3. Determine routing
  const routes = determineKitchenRoutes(order.items, printerSettings.kitchen_printers);
  
  // 4. Format and print
  for (const route of routes) {
    const formatted = formatKitchenTicket(order, route.items, route.printer);
    await sendToPrinter(route.printer, formatted);
  }
  
  // 5. Update order status
  await markAsKitchenPrinted(orderId);
}
```

### Determine Routes Function

```javascript
function determineKitchenRoutes(orderItems, kitchenPrinters) {
  const routes = {};
  
  // Group items by category
  for (const item of orderItems) {
    const category = item.category_id;
    
    // Find printers that handle this category
    const printers = kitchenPrinters.filter(p => 
      p.categories.includes(category)
    );
    
    // If item maps to multiple printers, might send to all
    // or let restaurant decide via settings
    for (const printer of printers) {
      if (!routes[printer.id]) {
        routes[printer.id] = {
          printer: printer,
          items: []
        };
      }
      routes[printer.id].items.push(item);
    }
  }
  
  return Object.values(routes);
}
```

---

## 🎟️ Phase 3: Kitchen Ticket Formatting

### Thermal Printer Format

```
┌─────────────────────────────────┐
│    LA CAVE RESTAURANT           │
│         KITCHEN TICKET          │
├─────────────────────────────────┤
│ TABLE: T02                       │
│ TIME: 8:30 PM                    │
│ ORDER #1234                      │
├─────────────────────────────────┤
│ Pad Thai                         │
│ No garlic, extra vegetables      │
│ Qty: 2                           │
│                                  │
│ Green Curry                      │
│ Medium spicy                     │
│ Qty: 1                           │
├─────────────────────────────────┤
│ SPECIAL NOTES:                   │
│ - Customer is vegetarian         │
│ - Has nut allergy                │
└─────────────────────────────────┘
```

### Formatting Function

```javascript
function formatKitchenTicket(order, itemsForThisPrinter, printer) {
  const timestamp = new Date(order.created_at);
  const timeStr = timestamp.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  });
  
  let ticket = "=".repeat(32) + "\n";
  ticket += "LA CAVE RESTAURANT\n";
  ticket += "KITCHEN TICKET\n";
  ticket += "=".repeat(32) + "\n";
  
  ticket += `TABLE: ${order.table_number}\n`;
  ticket += `TIME: ${timeStr}\n`;
  ticket += `ORDER #${order.id}\n`;
  ticket += "-".repeat(32) + "\n";
  
  // Items for this printer
  for (const item of itemsForThisPrinter) {
    ticket += item.name + "\n";
    if (item.variants?.length > 0) {
      for (const variant of item.variants) {
        ticket += `  ${variant.option}: ${variant.value}\n`;
      }
    }
    ticket += `  Qty: ${item.quantity}\n`;
    ticket += "\n";
  }
  
  // Special notes if any
  if (order.special_notes) {
    ticket += "-".repeat(32) + "\n";
    ticket += "SPECIAL NOTES:\n";
    ticket += order.special_notes + "\n";
  }
  
  ticket += "=".repeat(32) + "\n";
  
  return ticket;
}
```

---

## 🔌 Phase 4: Printer Communication

### Network Printer (ESC/POS Protocol)

```javascript
async function sendToNetworkPrinter(printerIP, ticketContent) {
  try {
    // Convert ticket text to ESC/POS format
    const escposData = convertToESCPOS(ticketContent);
    
    // Send to printer via HTTP/Raw socket
    const response = await fetch(`http://${printerIP}:9100`, {
      method: 'POST',
      body: escposData
    });
    
    return response.ok;
  } catch (err) {
    console.error('Network print failed:', err);
    throw err;
  }
}

function convertToESCPOS(text) {
  const ESC = "\x1B";
  let data = "";
  
  // Initialize printer
  data += ESC + "@"; // Reset
  data += ESC + "E" + "\x01"; // Bold on
  data += text;
  data += ESC + "E" + "\x00"; // Bold off
  data += ESC + "d" + "\x03"; // Cut paper
  
  return data;
}
```

### Bluetooth Printer (Mobile Apps)

#### React Native / Expo
```javascript
import * as Print from 'expo-print';
import RNBluetoothClassic from '@react-native-bluetooth-classic/react-native-bluetooth-classic';

async function sendToBluetoothPrinter(deviceName, ticketHTML) {
  try {
    // Option 1: Using Expo Print (iOS/Android)
    const html = convertTicketToHTML(ticketHTML);
    await Print.printAsync({
      html: html,
      margins: {
        left: 10,
        top: 10,
        right: 10,
        bottom: 10
      }
    });
    
    // Option 2: Direct Bluetooth (requires more setup)
    // const device = await RNBluetoothClassic.getBluetoothDevice(deviceName);
    // await device.connect();
    // await device.write(convertToESCPOS(ticketHTML));
    
  } catch (err) {
    console.error('Bluetooth print failed:', err);
    throw err;
  }
}

function convertTicketToHTML(ticketText) {
  return `
    <html>
      <head>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 10px; }
          pre { white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <pre>${ticketText}</pre>
      </body>
    </html>
  `;
}
```

#### Web-Based Mobile App
```javascript
async function sendToBluetoothPrinterWeb(device, ticketContent) {
  try {
    // Use Web Bluetooth API (Chrome/Edge/Opera)
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(PRINTER_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(PRINTER_CHARACTERISTIC_UUID);
    
    const escposData = convertToESCPOS(ticketContent);
    
    // Send in chunks (BLE has packet size limits)
    const chunkSize = 20;
    for (let i = 0; i < escposData.length; i += chunkSize) {
      const chunk = escposData.slice(i, i + chunkSize);
      await characteristic.writeValue(new TextEncoder().encode(chunk));
      await new Promise(r => setTimeout(r, 100)); // Small delay between chunks
    }
    
    return true;
  } catch (err) {
    console.error('Bluetooth print failed:', err);
    throw err;
  }
}
```

---

## 📲 Phase 5: Mobile UI Implementation

### Kitchen Settings Screen (React Native Example)

```typescript
// mobile/src/screens/admin/KitchenPrinterSettings.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';

export function KitchenPrinterSettings() {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadKitchenPrinters();
  }, []);
  
  async function loadKitchenPrinters() {
    try {
      const restaurantId = await getRestaurantId();
      const response = await fetch(
        `/restaurants/${restaurantId}/printer-settings`
      );
      const settings = await response.json();
      setPrinters(settings.kitchen_printers || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to load kitchen printers');
    } finally {
      setLoading(false);
    }
  }
  
  function renderPrinter(printer) {
    return (
      <View style={styles.printerCard}>
        <Text style={styles.printerName}>{printer.name}</Text>
        <Text style={styles.printerType}>
          {printer.type === 'network' ? '🌐' : '🔵'} {printer.host || printer.bluetoothDevice}
        </Text>
        <Text style={styles.categories}>
          Categories: {printer.categories.join(', ')}
        </Text>
        <TouchableOpacity onPress={() => editPrinter(printer)}>
          <Text style={styles.editBtn}>Edit</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kitchen Printers</Text>
      <FlatList
        data={printers}
        renderItem={({ item }) => renderPrinter(item)}
        keyExtractor={p => p.id}
        ListEmptyComponent={<Text>No kitchen printers configured</Text>}
      />
      <TouchableOpacity style={styles.addBtn} onPress={() => addPrinter()}>
        <Text style={styles.addBtnText}>+ Add Printer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  printerCard: { 
    padding: 12, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#e5e7eb',
    marginBottom: 12 
  },
  printerName: { fontSize: 16, fontWeight: '600' },
  printerType: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  categories: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  editBtn: { color: '#007AFF', marginTop: 8, fontWeight: '600' },
  addBtn: { 
    backgroundColor: '#007AFF', 
    padding: 12, 
    borderRadius: 8,
    marginTop: 16
  },
  addBtnText: { color: 'white', fontWeight: '600', textAlign: 'center' }
};
```

### Kitchen Order Print Dialog (React Native/Expo)

```typescript
// When order is ready to print, show this screen

export function KitchenOrderPrintDialog({ order, onComplete }) {
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [printing, setPrinting] = useState(false);
  
  async function handlePrint() {
    try {
      setPrinting(true);
      
      // Determine routing
      const routes = determineKitchenRoutes(order.items, printers);
      
      // Print to each printer
      for (const route of routes) {
        const ticket = formatKitchenTicket(order, route.items, route.printer);
        
        if (route.printer.type === 'network') {
          await sendToNetworkPrinter(route.printer.host, ticket);
        } else {
          // Bluetooth - use native print dialog
          await Print.printAsync({
            html: convertTicketToHTML(ticket)
          });
        }
      }
      
      Alert.alert('Success', 'Order sent to kitchen printers');
      onComplete();
    } catch (err) {
      Alert.alert('Error', 'Failed to print: ' + err.message);
    } finally {
      setPrinting(false);
    }
  }
  
  return (
    <View style={styles.dialog}>
      <Text style={styles.title}>Print Kitchen Order</Text>
      <Text style={styles.orderInfo}>Order #{order.id}</Text>
      
      <FlatList
        data={printers}
        renderItem={({ item }) => (
          <TouchableOpacity 
            onPress={() => setSelectedPrinter(item.id)}
            style={[
              styles.printerOption,
              selectedPrinter === item.id && styles.printerSelected
            ]}
          >
            <Text>{item.name} - {item.type}</Text>
          </TouchableOpacity>
        )}
        keyExtractor={p => p.id}
      />
      
      <TouchableOpacity 
        style={styles.printBtn} 
        onPress={handlePrint}
        disabled={printing}
      >
        <Text style={styles.printBtnText}>
          {printing ? 'Printing...' : 'Print Order'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## 🔧 Integration Checklist

### Backend Requirements
- [ ] Kitchen printer settings endpoint supports `kitchen_printers` array
- [ ] Categories endpoint exists `/restaurants/{id}/categories`
- [ ] Order endpoint includes `category_id` for each item
- [ ] Can mark orders as "printed_to_kitchen"

### Mobile App Requirements
- [ ] Kitchen settings screen created
- [ ] Kitchen printer loading implemented
- [ ] Order routing logic implemented
- [ ] Ticket formatting implemented
- [ ] Network printer communication implemented
- [ ] Bluetooth printer communication implemented (if needed)
- [ ] Print status tracking added
- [ ] Error handling for printer failures

### Testing Requirements
- [ ] Test with configured kitchen printers
- [ ] Test network printing
- [ ] Test Bluetooth printing (if applicable)
- [ ] Test with multiple printers
- [ ] Test category routing
- [ ] Test special notes display
- [ ] Test failure scenarios (printer offline, etc.)

---

## 📊 Recommended Approach

### Phase 1 (MVP)
1. Load kitchen settings from API
2. Display printer list in settings
3. Manual print trigger with printer selection
4. Network printer support only

### Phase 2 (Enhancement)
1. Automatic category-based routing
2. Bluetooth printer support
3. Print status indicators
4. Test print functionality

### Phase 3 (Advanced)
1. Print queue management
2. Re-print functionality
3. Print job history
4. Multiple order batching

---

## 🐛 Common Issues & Solutions

### Issue: Printer not responding
**Solution**:
- Verify IP address is correct
- Check printer is on same network
- Test manually with printer's IP in browser

### Issue: Bluetooth pairing fails
**Solution**:
- Ensure device is paired in OS settings first
- Check device name matches configuration
- Restart Bluetooth on device

### Issue: Text formatting looks wrong
**Solution**:
- Adjust font size in ESC/POS commands
- Test with actual printer model
- Use monospace font for alignment

### Issue: Order items missing
**Solution**:
- Verify category_id is set for all items
- Check kitchen printer categories include item's category
- Log routing logic to see which printers get which items

---

## 📚 Reference Links

- **ESC/POS Command Reference**: https://en.wikipedia.org/wiki/ESC/P
- **Web Bluetooth API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
- **Expo Print**: https://docs.expo.dev/versions/latest/sdk/print/
- **React Native Bluetooth**: https://github.com/react-native-bluetooth-classic/react-native-bluetooth-classic

---

## 🎯 Success Criteria

- [ ] Kitchen settings load in mobile app
- [ ] User can view/edit kitchen printers
- [ ] Orders route correctly by category
- [ ] Kitchen tickets print with correct format
- [ ] Printing works for both network and Bluetooth
- [ ] Error handling for printer failures
- [ ] Print status tracked in order

---

**Status**: Implementation Guide Ready ✅
**Target**: Mobile Phase Implementation
