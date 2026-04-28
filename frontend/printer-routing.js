/**
 * Printer Routing Module
 * Routes print requests to backend endpoints that handle Bluetooth printing
 * The backend ALWAYS generates ESC/POS commands - this ensures consistent formatting
 * across all devices (mobile app, web app, kitchen display)
 * 
 * Backend generates ESC/POS using shared thermalPrinterService.ts
 */

/**
 * Print queue to prevent concurrent writes to same Bluetooth device
 * Maps device ID to a queue of pending print jobs
 */
const printQueues = new Map(); // deviceId -> { isProcessing: bool, queue: [] }
const PRINT_QUEUE_TIMEOUT = 5000; // 5 seconds timeout between prints

function tr(key, fallback = '') {
  if (typeof t === 'function') return t(key);
  return fallback || key;
}

/**
 * Queue a print job and wait for it to complete
 */
async function queuePrintJob(deviceId, printFn) {
  if (!printQueues.has(deviceId)) {
    printQueues.set(deviceId, { isProcessing: false, queue: [] });
  }
  
  const queue = printQueues.get(deviceId);
  queue.queue.push(printFn);
  
  // If already processing, wait for current job to finish
  while (queue.isProcessing) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Mark as processing
  queue.isProcessing = true;
  
  try {
    while (queue.queue.length > 0) {
      const job = queue.queue.shift();
      console.log(`[PrintRouter] Processing queued print job for device: ${deviceId}`);
      await job();
      // Wait before next print to avoid GATT conflicts
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } finally {
    queue.isProcessing = false;
  }
}

/**
 * Try to send ESC/POS data to the local print bridge (print-bridge.js).
 * The bridge is a tiny Node.js HTTP server running on the restaurant's
 * computer at localhost:3001 that forwards bytes over TCP to the printer.
 *
 * Returns true if printing succeeded, false if the bridge is not running.
 */
async function sendViaPrintBridge(networkPrint) {
  const BRIDGE_URL = 'https://localhost:3001/print-escpos';
  const { host, port, escposBase64 } = networkPrint || {};
  if (!host || !port || !escposBase64) {
    console.warn('[PrintBridge] Skipping — networkPrint missing required fields (host/port/escposBase64)');
    return false;
  }
  try {
    console.log(`[PrintBridge] Trying local print bridge for ${host}:${port}…`);
    const resp = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, port, escposBase64 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error || `Bridge returned HTTP ${resp.status}`);
    }
    console.log('[PrintBridge] ✓ Printed via local bridge');
    return true;
  } catch (err) {
    if (err.name === 'TypeError' || err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('Load failed')) {
      // Bridge not running, or HTTPS certificate not yet trusted
      console.warn('[PrintBridge] Bridge not reachable:', err.message);
      alert(
        tr('admin.printer-bridge-not-running',
          `⚠️ Cannot reach the local print bridge.\n\n` +
          `If the bridge is NOT running, start it:\n` +
          `  node print-bridge.js\n\n` +
          `If it IS running but you still see this message, you need to\n` +
          `trust its HTTPS certificate once in your browser:\n` +
          `  1. Open https://localhost:3001 in this browser\n` +
          `  2. Click through the security warning to trust it\n` +
          `  3. Return here and try printing again\n\n` +
          `Alternatively, use the mobile app to print to ${host}:${port}.`
        )
      );
    } else {
      console.error('[PrintBridge] Print error:', err.message);
      alert(`❌ Print bridge error: ${err.message}`);
    }
    return false;
  }
}

/**
 * Append text to ESC/POS commands
 */
function appendText(commands, text) {
  if (!text) return;
  for (let i = 0; i < text.length; i++) {
    commands.push(text.charCodeAt(i));
  }
}
function generateQRCodeESCPOS(receiptData) {
  const commands = [];
  
  // Initialize
  commands.push(0x1B, 0x40); // ESC @
  commands.push(0x1B, 0x33, 0x1E); // ESC 3 30 (line spacing)
  commands.push(0x1B, 0x4D, 0x00); // ESC M 0 (font)
  
  // Restaurant name (bold, centered)
  commands.push(0x1B, 0x61, 0x01); // ESC a 1 (center)
  commands.push(0x1B, 0x21, 0x08); // ESC ! 8 (bold on)
  appendText(commands, receiptData.restaurantName || 'Restaurant');
  commands.push(0x1B, 0x21, 0x00); // ESC ! 0 (bold off)
  commands.push(0x0A); // LF
  
  // Separator line
  appendText(commands, '========================================');
  commands.push(0x0A);
  
  // Table info (left-aligned)
  commands.push(0x1B, 0x61, 0x00); // ESC a 0 (left align)
  
  if (receiptData.tableName) {
    appendText(commands, `Table: ${receiptData.tableName}`);
    commands.push(0x0A);
  }
  
  if (receiptData.pax) {
    appendText(commands, `Pax: ${receiptData.pax}`);
    commands.push(0x0A);
  }
  
  if (receiptData.startedTime) {
    appendText(commands, `Started: ${receiptData.startedTime}`);
    commands.push(0x0A);
  }
  
  // Separator line
  commands.push(0x0A);
  appendText(commands, '========================================');
  commands.push(0x0A, 0x0A);
  
  // QR Code placeholder text since ESC/POS doesn't reliably support QR code images
  commands.push(0x1B, 0x61, 0x01); // Center align
  appendText(commands, '[QR CODE]');
  commands.push(0x0A);
  appendText(commands, receiptData.qrToken || '');
  commands.push(0x0A, 0x0A);
  
  // Text above QR code (if configured)
  if (receiptData.textAboveQR) {
    commands.push(0x1B, 0x21, 0x08); // Bold on
    appendText(commands, receiptData.textAboveQR);
    commands.push(0x1B, 0x21, 0x00); // Bold off
  } else {
    commands.push(0x1B, 0x21, 0x08); // Bold on
    appendText(commands, 'Scan to Order');
    commands.push(0x1B, 0x21, 0x00); // Bold off
  }
  commands.push(0x0A);
  
  // Separator line
  commands.push(0x1B, 0x61, 0x00); // Left align
  appendText(commands, '========================================');
  commands.push(0x0A);
  
  // Text below QR code (if configured)
  commands.push(0x1B, 0x61, 0x01); // Center align
  if (receiptData.textBelowQR) {
    appendText(commands, receiptData.textBelowQR);
  } else {
    appendText(commands, 'Let us know how we did!');
  }
  commands.push(0x1B, 0x61, 0x00); // Left align
  commands.push(0x0A);
  
  // Paper feed and cut
  commands.push(0x1B, 0x64, 0x05); // ESC d 5 (feed 5 lines)
  commands.push(0x1B, 0x69); // ESC i (full cut)
  
  return new Uint8Array(commands);
}

/**
 * Generate ESC/POS commands from receipt data (matching mobile app format)
 */
/**
 * NOTE: ESC/POS generation has been moved to the backend
 * The backend uses the shared thermalPrinterService (/backend/src/services/thermalPrinterService.ts)
 * which is also used by the mobile app.
 * This ensures 100% identical formatting across all platforms (web, mobile, kitchen display).
 * 
 * The backend returns escposArray or escposBase64 in the Bluetooth payload.
 */

/**
 * Handle Bluetooth printer communication using Web Bluetooth API
 * Uses persistent session if available, otherwise requests device
 * This minimizes user prompts - device picker only shows once per session
 */
async function handleBluetoothPrint(bluetoothPayload) {
  try {
    const { printerConfig, data } = bluetoothPayload;
    const deviceName = printerConfig.bluetoothDeviceName;
    const printerType = data?.type?.toUpperCase() || 'UNKNOWN';
    
    console.log('[PrintRouter] Bluetooth print - device:', deviceName, 'type:', printerType);
    
    // Use device name as queue ID to prevent concurrent writes to same device
    const queueId = deviceName || printerType;
    
    // Queue the actual print job
    await queuePrintJob(queueId, async () => {
      await performBluetoothPrint(bluetoothPayload);
    });
  } catch (err) {
    console.error('[PrintRouter] Bluetooth print failed:', err);
    throw err;
  }
}

/**
 * Perform the actual Bluetooth print operation
 */
async function performBluetoothPrint(bluetoothPayload) {
  const { printerConfig, data } = bluetoothPayload;
  const deviceName = printerConfig.bluetoothDeviceName;
  const printerType = data?.type?.toUpperCase() || 'UNKNOWN';
  
  try {
    // Check if there's an active session from printer settings
    let session = null;
    if (window.bluetoothSessions && window.bluetoothSessions[printerType.toUpperCase()]) {
      session = window.bluetoothSessions[printerType.toUpperCase()];
      if (session.connected && session.device && session.characteristic) {
        console.log('[PrintRouter] Using active session for:', printerType);
      } else {
        // Session exists but not connected
        session = null;
      }
    }
    
    let device, writableChar, serviceUuid = null;
    
    if (session) {
      // Reuse session device
      device = session.device;
      writableChar = session.characteristic;
      serviceUuid = session.service?.uuid;
      console.log('[PrintRouter] Using session device:', device.name);
    } else {
      // No session - try to load device UUID from database
      console.log('[PrintRouter] No session found, loading device UUID from database for printer type:', printerType);
      
      try {
        const restaurantId = localStorage.getItem('restaurantId');
        const uuidResponse = await fetch(
          `${API}/restaurants/${restaurantId}/bluetooth-device-uuid/${printerType.toLowerCase()}`
        );
        
        if (uuidResponse.ok) {
          const deviceInfo = await uuidResponse.json();
          serviceUuid = deviceInfo.serviceUuid;
          console.log('[PrintRouter] Loaded device UUID from database:', serviceUuid);
        } else {
          console.log('[PrintRouter] Device UUID not in database, will use fallback UUIDs');
        }
      } catch (e) {
        console.warn('[PrintRouter] Failed to load device UUID from database:', e.message);
      }

      // Request device (on already-paired device, won't show picker)
      console.log('[PrintRouter] Requesting device:', deviceName);
      device = await navigator.bluetooth.requestDevice({
        filters: [
          { name: deviceName }
        ],
        optionalServices: [
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          '0000ffe0-0000-1000-8000-00805f9b34fb',
          '0000fff0-0000-1000-8000-00805f9b34fb'
        ]
      });
      
      if (!device) {
        throw new Error(`Bluetooth printer "${deviceName}" not found or not paired`);
      }

      console.log('[PrintRouter] Found device:', device.name);
      
      // Get GATT and service
      const server = await device.gatt.connect();
      let service;
      
      // Try saved UUID first if available
      if (serviceUuid) {
        try {
          service = await server.getPrimaryService(serviceUuid);
          console.log('[PrintRouter] Connected to service using saved UUID:', serviceUuid);
        } catch (e) {
          console.warn('[PrintRouter] Saved UUID failed, trying fallback UUIDs');
          serviceUuid = null;
        }
      }
      
      // If saved UUID didn't work or wasn't available, try fallback UUIDs
      if (!service) {
        try {
          service = await server.getPrimaryService('49535343-fe7d-4ae5-8fa9-9fafd205e455');
        } catch (e) {
          try {
            service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
          } catch (e2) {
            try {
              service = await server.getPrimaryService('0000fff0-0000-1000-8000-00805f9b34fb');
            } catch (e3) {
              throw new Error('Could not find any supported service on printer');
            }
          }
        }
      }
      
      // Find writable characteristic
      const characteristics = await service.getCharacteristics();
      writableChar = characteristics.find(c => 
        c.properties.writeWithoutResponse || c.properties.write
      );
      
      if (!writableChar) {
        throw new Error('No writable characteristic found on printer');
      }
    }

    console.log(`[PrintRouter] Printing to ${device.name}...`);
    
    // Only authenticate/initialize if not using session (session already did this)
    if (!session) {
      // Only connect GATT if we just requested the device (not from session)
      const server = await device.gatt.connect();
      console.log('[PrintRouter] GATT server connected');
      
      // Minimal initialization - just line spacing and center align
      // Removed ESC @ (0x1B 0x40) which was being echoed as '@' character
      const initCommands = [
        0x1B, 0x33, 0x1E,     // ESC 3 30 (line spacing)
        0x1B, 0x4D, 0x00,     // ESC M 0 (font)
        0x1B, 0x61, 0x01      // ESC a 1 (center align)
      ];
      
      try {
        if (writableChar.properties.writeWithoutResponse) {
          await writableChar.writeValue(new Uint8Array(initCommands));
        } else {
          await writableChar.writeValue(new Uint8Array(initCommands));
        }
        console.log('[PrintRouter] Printer initialized');
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) {
        console.warn('[PrintRouter] Printer initialization warning:', e.message);
      }
    }
    
    // Validate data exists before sending ESC/POS
    if (!data) {
      throw new Error('Missing data payload - Bluetooth print data not provided by backend');
    }
    
    // Use ESC/POS commands generated by backend (shared with mobile app)
    // Backend uses thermalPrinterService for consistent formatting across all apps
    let escposData;
    
    if (data.escposArray) {
      // Backend-generated ESC/POS commands (preferred - ensures synchronization)
      escposData = new Uint8Array(data.escposArray);
      console.log('[PrintRouter] Using backend-generated ESC/POS commands (shared thermalPrinterService)');
    } else if (data.escposBase64) {
      // Fallback: decode base64 ESC/POS if array not available
      const binaryString = atob(data.escposBase64);
      escposData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        escposData[i] = binaryString.charCodeAt(i);
      }
      console.log('[PrintRouter] Decoded base64 ESC/POS commands');
    } else {
      throw new Error('No ESC/POS data provided by backend');
    }
    
    console.log('[PrintRouter] ESC/POS data length:', escposData.length, 'bytes');
    
    // Send data in chunks (matching mobile app's 20-byte chunks)
    const chunkSize = 20;
    for (let i = 0; i < escposData.length; i += chunkSize) {
      const chunk = escposData.slice(i, i + chunkSize);
      try {
        if (writableChar.properties.writeWithoutResponse) {
          await writableChar.writeValue(chunk);
        } else {
          await writableChar.writeValue(chunk);
        }
        console.log(`[PrintRouter] Sent chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(escposData.length/chunkSize)}`);
        // Wait 100ms between chunks (matches mobile app)
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.error(`[PrintRouter] Error sending chunk:`, e);
        throw new Error(`Failed to send data chunk: ${e.message}`);
      }
    }
    
    console.log('[PrintRouter] All data sent successfully');
    console.log(`[PrintRouter] Successfully printed to: ${device.name}`);
    
    // Only disconnect if not using session (keep session alive for next print)
    if (!session) {
      try {
        await device.gatt.disconnect();
        console.log('[PrintRouter] Disconnected from device');
      } catch (e) {
        console.warn('[PrintRouter] Error disconnecting:', e);
      }
    } else {
      console.log('[PrintRouter] Keeping session connection open for next print');
    }
    
    return true;
  } catch (err) {
    console.log('[PrintRouter] Bluetooth error:', {
      name: err.name,
      message: err.message,
      device: bluetoothPayload.printerConfig.bluetoothDeviceName
    });
    
    // Provide user-friendly error messages
    let errorMsg = '';
    if (err.name === 'NotFoundError') {
      errorMsg = '⚠️ Bluetooth printer not found.\n\nMake sure:\n1. Printer is powered on\n2. Printer is paired with your device\n3. Printer name matches: ' + bluetoothPayload.printerConfig.bluetoothDeviceName;
    } else if (err.name === 'NotSupportedError') {
      errorMsg = '⚠️ Web Bluetooth not supported on this browser.\n\nSupported: Chrome, Edge (Windows/macOS/Linux/Android)';
    } else if (err.name === 'SecurityError') {
      errorMsg = '⚠️ Web Bluetooth requires HTTPS.\n\nAccess the app over HTTPS (secure).';
    } else if (err.name === 'AbortError') {
      console.log('[PrintRouter] User cancelled device selection');
      return false; // User cancelled - no error alert
    } else {
      errorMsg = '❌ Bluetooth error: ' + err.message + '\n\nWill use browser print instead.';
    }
    
    if (errorMsg) {
      alert(errorMsg);
    }
    
    // Fall back to browser print
    console.log('[PrintRouter] Falling back to browser print');
    if (bluetoothPayload.data && bluetoothPayload.data.html) {
      handleBrowserPrint(bluetoothPayload.data.html);
    }
    return false;
  }
}

/**
 * Print QR code via backend endpoint
 * Backend generates the HTML and routes to configured printer
 */
async function printQRViaAPI(restaurantId, sessionId, tableId, tableName, qrToken, priority = 10) {
  try {
    console.log('[PrintRouter] Printing QR code:', { tableId, tableName, qrToken });
    
    const response = await fetch(`${API}/restaurants/${restaurantId}/print-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        tableId,
        tableName,
        qrToken,
        priority
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to print QR: ${error}`);
    }

    const result = await response.json();
    console.log('[PrintRouter] QR print response:', result);
    
    if (result.html) {
      // Browser printing - open print dialog
      console.log('[PrintRouter] Received HTML, opening print dialog');
      handleBrowserPrint(result.html);
      alert(tr('admin.printer-open-dialog', '✅ Print dialog opened. Please select a printer and confirm.'));
      return result;
    } else if (result.bluetoothPayload) {
      // Bluetooth printing via Web Bluetooth API
      console.log('[PrintRouter] Received Bluetooth payload');
      const success = await handleBluetoothPrint(result.bluetoothPayload);
      if (!success) {
        // Fallback: show browser print
        if (result.bluetoothPayload.data && result.bluetoothPayload.data.html) {
          handleBrowserPrint(result.bluetoothPayload.data.html);
        }
      }
      return result;
    } else if (result.jobId) {
      // Queued for printing
      console.log('[PrintRouter] QR code queued with job ID:', result.jobId);
      alert(tr('admin.printer-queued-qr', '✅ QR code queued for printing'));
      return result;
    } else if (result.networkPrint) {
      // Network printer: try local print bridge first, fall back to instructions.
      if (result.html) {
        console.log('[PrintRouter] Network printer — using HTML fallback for browser print');
        handleBrowserPrint(result.html);
        alert(tr('admin.printer-open-dialog', '✅ Print dialog opened. Please select a printer and confirm.'));
      } else {
        await sendViaPrintBridge(result.networkPrint);
      }
      return result;
    }
    
    console.warn('[PrintRouter] Unexpected response format:', result);
    return result;
  } catch (err) {
    console.error('[PrintRouter] QR print error:', err);
    
    // Friendly error messages
    let userMessage = err.message;
    if (err.message && err.message.includes('No QR printer configured')) {
      userMessage = tr('admin.printer-qr-not-configured', '⚠️ QR printer not configured.\n\nPlease set up a printer in Settings first.');
    } else if (err.message && err.message.includes('not paired')) {
      userMessage = tr('admin.printer-bt-not-paired', '⚠️ Bluetooth printer not paired.\n\nPlease pair your printer in your system Bluetooth settings, then configure it in QR printer settings.');
    }
    
    alert('❌ ' + userMessage);
    throw err;
  }
}

/**
 * Print order/receipt via backend endpoint
 * Backend generates the HTML and routes to configured printer
 */
async function printOrderViaAPI(restaurantId, orderId, priority = 0) {
  try {
    console.log('[PrintRouter] Printing order:', orderId);
    
    const response = await fetch(`${API}/restaurants/${restaurantId}/print-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        priority
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to print order: ${error}`);
    }

    const result = await response.json();
    console.log('[PrintRouter] Order print response:', result);

    if (result.html) {
      // Browser printing
      console.log('[PrintRouter] Received HTML, opening print dialog');
      handleBrowserPrint(result.html);
      alert(tr('admin.printer-open-dialog', '✅ Print dialog opened. Please select a printer and confirm.'));
      return result;
    } else if (result.bluetoothPayload) {
      // Bluetooth printing via Web Bluetooth API
      console.log('[PrintRouter] Received Bluetooth payload');
      const success = await handleBluetoothPrint(result.bluetoothPayload);
      if (!success) {
        // Fallback: show browser print
        if (result.bluetoothPayload.data && result.bluetoothPayload.data.html) {
          handleBrowserPrint(result.bluetoothPayload.data.html);
        }
      }
      return result;
    } else if (result.jobId) {
      // Queued for printing
      console.log('[PrintRouter] Order queued with job ID:', result.jobId);
      alert(tr('admin.printer-queued-order', '✅ Order queued for printing'));
      return result;
    }

    console.warn('[PrintRouter] Unexpected response format:', result);
    return result;
  } catch (err) {
    console.error('[PrintRouter] Order print error:', err);
    
    // Friendly error messages
    let userMessage = err.message;
    if (err.message && err.message.includes('No printer configured')) {
      userMessage = tr('admin.printer-order-not-configured', '⚠️ Order printer not configured.\n\nPlease set up a printer in Settings first.');
    } else if (err.message && err.message.includes('not paired')) {
      userMessage = tr('admin.printer-bt-not-paired', '⚠️ Bluetooth printer not paired.\n\nPlease pair your printer in your system Bluetooth settings, then configure it in order printer settings.');
    } else if (err.message && err.message.includes('device not configured')) {
      userMessage = tr('admin.printer-bt-device-not-configured', '⚠️ Bluetooth printer device not configured.\n\nPlease set up the printer device in Settings first.');
    }
    
    alert('❌ ' + userMessage);
    throw err;
  }
}

/**
 * Print bill/receipt via backend endpoint
 * Backend generates the HTML and routes to configured printer
 */
async function printBillViaAPI(restaurantId, sessionId, billData, priority = 5) {
  try {
    console.log('[PrintRouter] Printing bill for session:', sessionId);
    
    const response = await fetch(`${API}/restaurants/${restaurantId}/print-bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        billData,
        priority
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to print bill: ${error}`);
    }

    const result = await response.json();
    console.log('[PrintRouter] Bill print response:', result);

    if (result.html) {
      // Browser printing
      console.log('[PrintRouter] Received HTML, opening print dialog');
      handleBrowserPrint(result.html);
      alert(tr('admin.printer-open-dialog', '✅ Print dialog opened. Please select a printer and confirm.'));
      return result;
    } else if (result.bluetoothPayload) {
      // Bluetooth printing via Web Bluetooth API
      console.log('[PrintRouter] Received Bluetooth payload');
      const success = await handleBluetoothPrint(result.bluetoothPayload);
      if (!success) {
        // Fallback: show browser print
        if (result.bluetoothPayload.data && result.bluetoothPayload.data.html) {
          handleBrowserPrint(result.bluetoothPayload.data.html);
        }
      }
      return result;
    } else if (result.networkPrint) {
      // Network printer: try local print bridge first, fall back to instructions.
      if (result.html) {
        // Backend provided an HTML fallback — use it directly
        console.log('[PrintRouter] Network printer — using HTML fallback for browser print');
        handleBrowserPrint(result.html);
        alert(tr('admin.printer-open-dialog', '✅ Print dialog opened. Please select a printer and confirm.'));
      } else {
        await sendViaPrintBridge(result.networkPrint);
      }
      return result;
    } else if (result.jobId) {
      console.log('[PrintRouter] Bill sent with job ID:', result.jobId);
      alert(tr('admin.printer-queued-bill', '✅ Bill sent to printer'));
      return result;
    } else if (result.success) {
      console.log('[PrintRouter] Bill printed successfully');
      alert(tr('admin.printer-print-success', '✅ Bill printed successfully'));
      return result;
    }

    console.warn('[PrintRouter] Unexpected response format:', result);
    return result;
  } catch (err) {
    console.error('[PrintRouter] Bill print error:', err);
    
    // Friendly error messages
    let userMessage = err.message;
    if (err.message && err.message.includes('No printer configured')) {
      userMessage = tr('admin.printer-bill-not-configured', '⚠️ Bill printer not configured.\n\nPlease set up a printer in Settings first.');
    } else if (err.message && err.message.includes('not paired')) {
      userMessage = tr('admin.printer-bt-not-paired', '⚠️ Bluetooth printer not paired.\n\nPlease pair your printer in your system Bluetooth settings, then configure it in bill printer settings.');
    } else if (err.message && err.message.includes('device not configured')) {
      userMessage = tr('admin.printer-bt-device-not-configured', '⚠️ Bluetooth printer device not configured.\n\nPlease set up the printer device in Settings first.');
    }
    
    alert('❌ ' + userMessage);
    throw err;
  }
}

/**
 * Browser print - fallback method
 */
function handleBrowserPrint(htmlContent) {
  try {
    const win = window.open('', '_blank');
    if (!win) {
      throw new Error('Popup blocked. Please allow popups for printing.');
    }

    // Write HTML content to the new window
    win.document.write(htmlContent);
    win.document.close();

    // Ensure the print dialog is triggered
    // This works because the HTML has onload script, but we also trigger it here as a fallback
    win.onload = function() {
      console.log('[PrintRouter] Window loaded, triggering print');
      setTimeout(() => {
        try {
          win.print();
          console.log('[PrintRouter] Print dialog triggered');
        } catch (e) {
          console.error('[PrintRouter] Error triggering print:', e);
        }
      }, 500);
    };

    // Also set a timeout to ensure print is called even if onload doesn't fire
    setTimeout(() => {
      try {
        if (!win.closed) {
          console.log('[PrintRouter] Fallback: triggering print dialog');
          win.print();
        }
      } catch (e) {
        console.error('[PrintRouter] Fallback print error:', e);
      }
    }, 1000);

    console.log('[PrintRouter] Browser print window opened');
    return true;
  } catch (err) {
    console.error('[PrintRouter] Browser print error:', err);
    throw err;
  }
}



/**
 * Print kitchen order via backend endpoint
 * Kitchen orders are always auto-printed (no settings check needed)
 * Used by kitchen display system for real-time order auto-print
 */
async function printKitchenOrder(order, restaurantId) {
  try {
    if (!order || !order.id) {
      throw new Error('Missing order ID');
    }

    console.log('[PrintRouter] Printing kitchen order:', order.id, 'for restaurant:', restaurantId);
    
    const response = await fetch(`${API}/restaurants/${restaurantId}/print-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        orderType: 'kitchen',
        priority: 10 // Higher priority for kitchen orders
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to print kitchen order: ${error}`);
    }

    const result = await response.json();
    console.log('[PrintRouter] Kitchen order print response:', result);

    if (result.bluetoothPayload && result.bluetoothPayload.printerConfig) {
      // Bluetooth printing via Web Bluetooth API
      console.log('[PrintRouter] Received Bluetooth payload for kitchen order');
      const success = await handleBluetoothPrint(result.bluetoothPayload);
      if (!success) {
        // Fallback: show browser print for troubleshooting
        if (result.bluetoothPayload.data && result.bluetoothPayload.data.html) {
          console.log('[PrintRouter] Bluetooth failed, falling back to browser print');
          handleBrowserPrint(result.bluetoothPayload.data.html);
        }
      }
      return result;
    } else if (result.html) {
      // Browser printing
      console.log('[PrintRouter] Using browser print for kitchen order');
      handleBrowserPrint(result.html);
      return result;
    } else if (result.jobId) {
      // Queued for printing
      console.log('[PrintRouter] Kitchen order queued with job ID:', result.jobId);
      return result;
    }

    console.log('[PrintRouter] Kitchen order printed successfully');
    return result;
  } catch (err) {
    console.error('[PrintRouter] Kitchen order print error:', err);
    throw err;
  }
}



/**
 * Export functions to global window object for access from other modules
 * This ensures functions are available when called from admin-tables.js, etc.
 */
if (typeof window !== 'undefined') {
  window.printQRViaAPI = printQRViaAPI;
  window.printOrderViaAPI = printOrderViaAPI;
  window.printBillViaAPI = printBillViaAPI;
  window.printKitchenOrder = printKitchenOrder;
  window.handleBluetoothPrint = handleBluetoothPrint;
  window.handleBrowserPrint = handleBrowserPrint;
  window.generateQRCodeESCPOS = generateQRCodeESCPOS;
}
