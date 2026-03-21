/**
 * ESC/POS Thermal Printer Service
 * Converts receipt data to ESC/POS binary commands for thermal receipt printers
 */

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

class ThermalPrinterService {
  /**
   * Convert receipt data to ESC/POS commands with proper MPT-II initialization
   */
  generateESCPOS(receipt: ReceiptData): Uint8Array {
    const commands: number[] = [];

    // NOTE: Initialization (ESC @) is now done AFTER PIN authentication
    // So DO NOT include it here - the printer is already initialized

    // === QR CODE ONLY RECEIPT (When no items) ===
    // For QR receipts, make QR code the dominant element covering full paper
    if (receipt.qrCode && (!receipt.items || receipt.items.length === 0)) {
      // QR-only layout: matches preview format exactly
      
      // === RESTAURANT NAME - CENTERED BOLD ===
      commands.push(27, 97, 1); // ESC 'a' 1 - Center
      if (receipt.restaurantName && receipt.restaurantName !== 'QR Code') {
        commands.push(27, 33, 8); // ESC '!' 8 - Bold
        this.appendText(commands, receipt.restaurantName);
        commands.push(27, 33, 0); // ESC '!' 0 - Normal
      } else {
        this.appendText(commands, 'Receipt');
      }
      commands.push(10);
      
      // === SEPARATOR LINE ===
      this.appendText(commands, '================================');
      commands.push(10, 10); // LF x2
      
      // === TABLE INFO - LEFT ALIGNED ===
      commands.push(27, 97, 0); // ESC 'a' 0 - Left align
      
      if (receipt.tableNumber) {
        this.appendText(commands, `Table: ${receipt.tableNumber}`);
        commands.push(10);
      }
      
      if (receipt.pax) {
        this.appendText(commands, `Pax: ${receipt.pax}`);
        commands.push(10);
      }
      
      if (receipt.startTime) {
        this.appendText(commands, `Started: ${receipt.startTime}`);
        commands.push(10);
      }
      
      commands.push(10); // LF
      
      // === TEXT ABOVE QR CODE - CENTERED BOLD (appears BEFORE QR) ===
      commands.push(27, 97, 1); // ESC 'a' 1 - Center
      commands.push(27, 33, 8); // ESC '!' 8 - Bold
      this.appendText(commands, 'Scan to Order');
      commands.push(27, 33, 0); // ESC '!' 0 - Normal
      commands.push(10, 10); // LF x2
      
      // === SEPARATOR LINE ===
      this.appendText(commands, '================================');
      commands.push(10, 10); // LF x2
      
      // === LARGE QR CODE - CENTERED ===
      commands.push(27, 97, 1); // ESC 'a' 1 - Center
      this.appendQRCode(commands, receipt.qrCode, receipt.printerPaperWidth);
      commands.push(10, 10); // LF x2
      
      // === TEXT BELOW QR CODE - CENTERED (appears AFTER QR) ===
      commands.push(27, 97, 1); // ESC 'a' 1 - Center
      this.appendText(commands, 'Let us know how we did!');
      commands.push(10, 10); // LF x2
      
      // Paper feed and cut
      commands.push(27, 100, 5); // ESC d 5 - Feed paper 5 lines
      commands.push(27, 105); // ESC i - Full cut
      
      return new Uint8Array(commands);
    }

    // === REGULAR RECEIPT WITH ITEMS ===
    // Alignment: ESC 'a' n - Select alignment (0=left, 1=center, 2=right)
    commands.push(27, 97, 1); // ESC 'a' 1 - Center

    // === HEADER SECTION ===
    // Print restaurant name if available
    if (receipt.restaurantName) {
      this.appendText(commands, receipt.restaurantName);
      commands.push(10); // LF
    } else {
      this.appendText(commands, 'RECEIPT');
      commands.push(10);
    }

    // Separator line
    this.appendText(commands, '========================================');
    commands.push(10, 10); // LF x2

    // === DETAIL SECTION - LEFT ALIGNED ===
    commands.push(27, 97, 0); // ESC 'a' 0 - Left align

    // Print order/table info
    if (receipt.tableNumber) {
      this.appendText(commands, `Table: ${receipt.tableNumber}`);
      commands.push(10);
    }
    if (receipt.orderNumber) {
      this.appendText(commands, `Order: ${receipt.orderNumber}`);
      commands.push(10);
    }

    // Print timestamp
    if (receipt.timestamp) {
      this.appendText(commands, `Time: ${receipt.timestamp}`);
      commands.push(10);
    }

    commands.push(10); // LF

    // Separator
    this.appendText(commands, '========================================');
    commands.push(10, 10);

    // === ITEMS SECTION ===
    if (receipt.items && receipt.items.length > 0) {
      // Center align section header
      commands.push(27, 97, 1); // ESC 'a' 1 - Center
      this.appendText(commands, 'ITEMS');
      commands.push(10);

      // Left align items
      commands.push(27, 97, 0); // ESC 'a' 0 - Left
      commands.push(10);

      for (const item of receipt.items) {
        const qtyStr = `x${item.quantity}`;
        const priceStr = item.price ? `${(item.price / 100).toFixed(2)}` : '';

        // Item name
        this.appendText(commands, item.name);
        commands.push(10);

        // Qty and price
        if (priceStr) {
          const line = `  ${qtyStr}`.padEnd(20) + priceStr;
          this.appendText(commands, line);
        } else {
          this.appendText(commands, `  ${qtyStr}`);
        }
        commands.push(10);
      }

      commands.push(10); // LF

      // Separator
      this.appendText(commands, '========================================');
      commands.push(10, 10);
    }

    // === TOTALS SECTION ===
    commands.push(27, 97, 0); // ESC 'a' 0 - Left align

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
      // Bold text for total: ESC '!' 8
      commands.push(27, 33, 8); // ESC '!' 8 - Bold on
      const totalStr = (receipt.total / 100).toFixed(2);
      this.appendText(commands, `TOTAL                ${totalStr}`);
      commands.push(10);
      commands.push(27, 33, 0); // ESC '!' 0 - Normal
    }

    commands.push(10, 10); // LF x2

    // === QR CODE SECTION ===
    if (receipt.qrCode) {
      commands.push(27, 97, 1); // ESC 'a' 1 - Center
      this.appendQRCode(commands, receipt.qrCode, receipt.printerPaperWidth);
      commands.push(10, 10); // LF x2
    }

    // === FOOTER SECTION ===
    commands.push(27, 97, 1); // ESC 'a' 1 - Center
    
    // Print start time if available
    if (receipt.startTime) {
      this.appendText(commands, `Time: ${receipt.startTime}`);
      commands.push(10);
    }
    
    this.appendText(commands, 'Scan to Place Order');
    commands.push(10, 10, 10); // LF x3

    // === PAPER FEED BEFORE CUT ===
    commands.push(27, 100, 5); // ESC d 5 - Feed paper 5 lines (CRITICAL for actual printing)

    // === PAPER CUT ===
    // ESC 'i' - Full cut (27, 105)
    commands.push(27, 105); // ESC i - Full cut

    return new Uint8Array(commands);
  }

  /**
   * Add ESC/POS QR code commands
   * Uses GS ( k command format for QR code printing
   * Module size: 3=small, 4=medium, 5=large
   * For 80mm printers: use 4, For 58mm printers: use 3
   */
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
    commands.push(moduleSize); // size in modules (4 = reasonable for thermal printer)
    
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

  /**
   * Append text to commands array
   */
  private appendText(commands: number[], text: string): void {
    for (let i = 0; i < text.length; i++) {
      commands.push(text.charCodeAt(i));
    }
  }

  /**
   * Authenticate with Bluetooth printer using PIN
   * Returns true if authentication successful
   */
  private async authenticateWithPrinter(
    device: any,
    pin: string = '0000'
  ): Promise<boolean> {
    try {

      // For some printers, the PIN needs to be sent as data with terminator
      try {
        const chars = await device.characteristicsForService('49535343-fe7d-4ae5-8fa9-9fafd205e455');
        for (const char of chars) {
          if (char.isWritableWithoutResponse || char.isWritable) {
            // Send PIN as ASCII bytes WITH newline terminator (critical for some printers!)
            const pinBytes = pin.split('').map(c => c.charCodeAt(0));
            pinBytes.push(13); // Add CR (carriage return)
            pinBytes.push(10); // Add LF (line feed)
            
            try {
              // Convert to base64 (react-native-ble-plx requires this)
              const pinBase64 = this.arrayToBase64(pinBytes);
              
              if (char.isWritableWithoutResponse) {
                await char.writeWithoutResponse(pinBase64);
              } else {
                await char.write(pinBase64);
              }
              
              // Wait longer for authentication to process - YU568 needs time to switch modes
              await new Promise(resolve => setTimeout(resolve, 1500));
              
              // Try to read response if characteristic is readable
              if (char.isReadable) {
                try {
                  const response = await char.read();
                } catch (readErr) {
                  // Ignore read error, some printers don't respond
                }
              }
              
              return true;
            } catch (writeErr: any) {
              console.warn('[ThermalPrinter] Could not send PIN via write:', writeErr.message);
            }
            break;
          }
        }
      } catch (e: any) {
        console.warn('[ThermalPrinter] Could not find service for PIN:', e.message);
      }

      // If direct PIN write fails, wait for iOS pairing dialog
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return true;
    } catch (err: any) {
      console.error('[ThermalPrinter] Authentication error:', err.message);
      return false;
    }
  }

  /**
   * Send YU568 printer configuration commands AFTER authentication
   * This wakes up the printer and puts it in print mode
   */
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
      
      // Convert to base64 (react-native-ble-plx requires this)
      const initBase64 = this.arrayToBase64(initCommands);
      
      if (char.isWritableWithoutResponse) {
        await char.writeWithoutResponse(initBase64);
      } else if (char.isWritable) {
        await char.write(initBase64);
      }
      
      // Wait for initialization to take effect
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (e: any) {
      console.warn('[ThermalPrinter] initialization after auth failed:', e.message);
    }
  }

  /**
   * Convert array of numbers to base64 string
   */
  private arrayToBase64(arr: number[]): string {
    let binary = '';
    for (let i = 0; i < arr.length; i++) {
      binary += String.fromCharCode(arr[i]);
    }
    return btoa(binary);
  }

  /**
   * Send receipt to Bluetooth printer with proper authentication
   */
  async sendToBluetooth(
    manager: any,
    deviceId: string,
    receiptData: ReceiptData,
    timeout: number = 15000
  ): Promise<boolean> {
    try {
      console.log('[ThermalPrinter] Generating ESC/POS commands for device:', deviceId);

      // Generate ESC/POS data
      const escposData = this.generateESCPOS(receiptData);

      // Connect to device
      let device: any;
      try {
        device = await manager.connectToDevice(deviceId, { timeout });
        console.log('[ThermalPrinter] Connected successfully');
      } catch (e: any) {
        console.error('[ThermalPrinter] Connection failed:', e.message);
        throw e;
      }

      // Discover services and characteristics FIRST
      try {
        console.log('[ThermalPrinter] Discovering services and characteristics...');
        await device.discoverAllServicesAndCharacteristics();
        console.log('[ThermalPrinter] Services discovered successfully');
      } catch (e: any) {
        console.error('[ThermalPrinter] Discovery failed:', e.message);
        throw e;
      }

      // Now authenticate with printer using PIN "0000" (after discovery)
      console.log('[ThermalPrinter] Starting authentication process...');
      const isAuthenticated = await this.authenticateWithPrinter(device, '0000');
      if (!isAuthenticated) {
        console.warn('[ThermalPrinter] Authentication may have failed, continuing anyway...');
      }

      // Find the main writable characteristic (Service 1) for initialization
      let mainWriteChar: any = null;
      try {
        const chars = await device.characteristicsForService('49535343-fe7d-4ae5-8fa9-9fafd205e455');
        for (const char of chars) {
          if (char.isWritableWithoutResponse || char.isWritable) {
            mainWriteChar = char;
            console.log('[ThermalPrinter] Found Service 1 writable characteristic:', char.uuid);
            break;
          }
        }
      } catch (e: any) {
        console.warn('[ThermalPrinter] Could not find Service 1:', e.message);
      }

      // Initialize printer AFTER authentication (critical for YU568!)
      if (mainWriteChar) {
        console.log('[ThermalPrinter] Initializing printer after authentication...');
        await this.initializePrinterAfterAuth(mainWriteChar);
      }

      // Find a writable characteristic
      // Try common UUIDs for thermal printers
      const commonServiceUUIDs = [
        'FFE0', // Many Chinese thermal printers use this
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Nordic UART / similar service
        '180A', // Device Information
        '180F', // Battery Service
        '1801', // Generic Attribute
        '1800', // Generic Access
      ];

      let writeCharacteristic: any = null;

      for (const serviceUUID of commonServiceUUIDs) {
        try {
          const characteristics = await device.characteristicsForService(serviceUUID);
          console.log(`[ThermalPrinter] Service ${serviceUUID} has ${characteristics.length} characteristics`);

          for (const char of characteristics) {
            console.log(`[ThermalPrinter]   Char ${char.uuid}: write=${char.isWritable}, writeNoResp=${char.isWritableWithoutResponse}, read=${char.isReadable}, notify=${char.isNotifiable}, indicate=${char.isIndicatable}`);

            // Look for write or write-without-response
            if (char.isWritableWithoutResponse || char.isWritable) {
              console.log('[ThermalPrinter] ✓ Found writable characteristic:', char.uuid);
              writeCharacteristic = char;
              break;
            }
          }

          if (writeCharacteristic) break;
        } catch (e: any) {
          // Service not found, continue
          console.log(`[ThermalPrinter] Service ${serviceUUID} not available`);
        }
      }

      if (!writeCharacteristic) {
        console.warn('[ThermalPrinter] No writable characteristic found in common services, checking all services');
        // Try to get all characteristics and find any writable
        try {
          const allServices = await device.services();
          console.log(`[ThermalPrinter] Found ${allServices.length} services, scanning all...`);

          for (const service of allServices) {
            try {
              const chars = await device.characteristicsForService(service.uuid);
              console.log(`[ThermalPrinter] Service ${service.uuid} has ${chars.length} chars`);

              for (const char of chars) {
                console.log(`[ThermalPrinter]   Char ${char.uuid}: write=${char.isWritable}, writeNoResp=${char.isWritableWithoutResponse}`);
                if (char.isWritableWithoutResponse || char.isWritable) {
                  writeCharacteristic = char;
                  console.log('[ThermalPrinter] ✓ Found writable characteristic:', char.uuid);
                  break;
                }
              }
              if (writeCharacteristic) break;
            } catch (e: any) {
              console.log(`[ThermalPrinter] Could not read service ${service.uuid}`);
            }
          }
        } catch (e: any) {
          console.error('[ThermalPrinter] Failed to enumerate services:', e.message);
        }
      }

      if (!writeCharacteristic) {
        throw new Error('No writable characteristic found on device');
      }

      // Send data in chunks (most Bluetooth printers have MTU of 20-180 bytes)
      const chunkSize = 20; // Conservative chunk size
      console.log('[ThermalPrinter] Sending data in chunks of', chunkSize, 'bytes');
      console.log('[ThermalPrinter] Characteristic writable:', writeCharacteristic?.isWritable);
      console.log('[ThermalPrinter] Characteristic writeWithoutResponse:', writeCharacteristic?.isWritableWithoutResponse);

      for (let i = 0; i < escposData.length; i += chunkSize) {
        const chunk = escposData.slice(i, Math.min(i + chunkSize, escposData.length));
        const chunkNum = Math.floor(i / chunkSize) + 1;
        const totalChunks = Math.ceil(escposData.length / chunkSize);

        try {
          console.log(`[ThermalPrinter] Chunk ${chunkNum}/${totalChunks}: Sending ${chunk.length} bytes`);

          // Convert chunk to base64 (react-native-ble-plx requires this)
          const chunkBase64 = this.arrayToBase64(Array.from(chunk));

          if (writeCharacteristic.isWritableWithoutResponse) {
            console.log(`[ThermalPrinter] Using writeWithoutResponse`);
            await writeCharacteristic.writeWithoutResponse(chunkBase64);
          } else if (writeCharacteristic.isWritable) {
            console.log(`[ThermalPrinter] Using write with response`);
            await writeCharacteristic.write(chunkBase64);
          } else {
            throw new Error('Characteristic is not writable (no write capability)');
          }

          console.log(`[ThermalPrinter] ✓ Chunk ${chunkNum} sent successfully`);
        } catch (writeErr: any) {
          console.error(`[ThermalPrinter] ✗ Write failed on chunk ${chunkNum}:`, writeErr.message);
          throw writeErr;
        }

        // Increase delay to allow printer to process: 100ms
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('[ThermalPrinter] All data sent successfully');

      // Additional delay to allow printer to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Disconnect
      try {
        await device.cancelConnection();
        console.log('[ThermalPrinter] Disconnected from device');
      } catch (e) {
        console.log('[ThermalPrinter] Could not gracefully disconnect');
      }

      return true;
    } catch (err: any) {
      console.error('[ThermalPrinter] Error sending to Bluetooth:', err.message);
      throw err;
    }
  }

  /**
   * Send minimal test sequence to diagnose printer responsiveness
   * This helps determine if the printer responds to ANY commands
   */
  async sendTestPrint(
    manager: any,
    deviceId: string,
    timeout: number = 15000
  ): Promise<boolean> {
    try {
      console.log('[ThermalPrinter] DIAGNOSTIC: Sending minimal test sequence to:', deviceId);

      // ULTRA-MINIMAL test: Just raw text + LF, no initialization
      const testCommands: number[] = [];
      
      console.log('[ThermalPrinter] TEST: ULTRA-MINIMAL - raw text only');

      // Just send raw text without initialization
      testCommands.push(84, 69, 83, 84); // "TEST"
      console.log('[ThermalPrinter] TEST: "TEST" text');

      // Send multiple line feeds to allow print head to process
      testCommands.push(10); // LF x1
      testCommands.push(10); // LF x2
      testCommands.push(10); // LF x3
      testCommands.push(10); // LF x4
      testCommands.push(10); // LF x5
      console.log('[ThermalPrinter] TEST: 5x Line feeds');

      const testData = new Uint8Array(testCommands);
      console.log('[ThermalPrinter] TEST: Total bytes to send:', testData.length);
      console.log('[ThermalPrinter] TEST: Command bytes:', Array.from(testData));

      // Connect
      let device: any;
      try {
        device = await manager.connectToDevice(deviceId, { timeout });
        console.log('[ThermalPrinter] TEST: Connected successfully');
      } catch (e: any) {
        console.error('[ThermalPrinter] TEST: Connection failed:', e.message);
        throw e;
      }

      // Discover services FIRST
      try {
        console.log('[ThermalPrinter] TEST: Discovering services...');
        await device.discoverAllServicesAndCharacteristics();
        console.log('[ThermalPrinter] TEST: Services discovered');
        
        // DIAGNOSTIC: List ALL services and characteristics
        console.log('[ThermalPrinter] TEST: === ENUMERATING ALL SERVICES ===');
        try {
          const services = await device.services();
          console.log('[ThermalPrinter] TEST: Found', services.length, 'services');
          
          for (const service of services) {
            console.log(`[ThermalPrinter] TEST: Service UUID: ${service.uuid}`);
            
            try {
              const characteristics = await device.characteristicsForService(service.uuid);
              console.log(`[ThermalPrinter] TEST:   Has ${characteristics.length} characteristics:`);
              
              for (const char of characteristics) {
                const props: string[] = [];
                if (char.isReadable) props.push('R');
                if (char.isWritable) props.push('W');
                if (char.isWritableWithoutResponse) props.push('WNR');
                if (char.isNotifiable) props.push('N');
                
                console.log(`[ThermalPrinter] TEST:     ${char.uuid} [${props.join(',')}]`);
              }
            } catch (e: any) {
              console.log(`[ThermalPrinter] TEST:   Error reading chars: ${e.message}`);
            }
          }
        } catch (e: any) {
          console.log(`[ThermalPrinter] TEST: Error enumerating: ${e.message}`);
        }
        console.log('[ThermalPrinter] TEST: === END ENUMERATION ===');
        
      } catch (e: any) {
        console.error('[ThermalPrinter] TEST: Discovery failed:', e.message);
        throw e;
      }

      // Now authenticate with printer using PIN "0000" (after discovery)
      // PIN must be sent ONCE per session and connection stays alive
      console.log('[ThermalPrinter] TEST: Authenticating with PIN (keeping connection alive)');
      const isAuthenticated = await this.authenticateWithPrinter(device, '0000');
      if (!isAuthenticated) {
        console.warn('[ThermalPrinter] TEST: Authentication may have failed, but continuing...');
      }
      
      // Try subscribing to notifications from Service 1
      console.log('[ThermalPrinter] TEST: Setting up notification listener on Service 1');
      try {
        const chars = await device.characteristicsForService('49535343-fe7d-4ae5-8fa9-9fafd205e455');
        for (const char of chars) {
          if (char.isNotifiable) {
            console.log('[ThermalPrinter] TEST: Subscribing to notifications:', char.uuid);
            await char.monitor((error: any, characteristic: any) => {
              if (error) {
                console.log('[ThermalPrinter] TEST: Notification error:', error);
              } else if (characteristic && characteristic.value) {
                const data = Array.from(characteristic.value || []);
                console.log('[ThermalPrinter] TEST: Printer notification:', data);
              }
            });
          }
        }
      } catch (e: any) {
        console.log('[ThermalPrinter] TEST: Could not setup notifications:', e.message);
      }
      
      // Wait briefly after PIN to let printer settle
      console.log('[ThermalPrinter] TEST: Waiting 500ms after PIN before sending print data');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Use Service 1 for everything (it has the light feedback)
      let writeChar: any = null;
      try {
        const chars = await device.characteristicsForService('49535343-fe7d-4ae5-8fa9-9fafd205e455');
        for (const char of chars) {
          if (char.isWritableWithoutResponse || char.isWritable) {
            writeChar = char;
            console.log('[ThermalPrinter] TEST: Found print char in Service 1:', char.uuid);
            break;
          }
        }
      } catch (e: any) {
        console.warn('[ThermalPrinter] TEST: Could not find Service 1:', e.message);
      }

      if (!writeChar) {
        throw new Error('No writable characteristic found');
      }

      // CRITICAL: Send initialization AFTER PIN to put printer in print mode
      console.log('[ThermalPrinter] TEST: Sending initialization after PIN');
      await this.initializePrinterAfterAuth(writeChar);
      
      // Wait for initialization to take effect
      await new Promise(resolve => setTimeout(resolve, 500));

      // Now send the test data (text + feeds)
      console.log('[ThermalPrinter] TEST: Sending', testData.length, 'bytes of print data');
      // Convert to base64 (react-native-ble-plx requires this format)
      const testBase64 = this.arrayToBase64(Array.from(testData));
      await writeChar.writeWithoutResponse(testBase64);
      console.log('[ThermalPrinter] TEST: Data sent successfully');

      // Wait LONGER for printer to process and print
      console.log('[ThermalPrinter] TEST: Waiting 3 seconds for printer to process...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Disconnect
      try {
        await device.cancelConnection();
        console.log('[ThermalPrinter] TEST: Disconnected');
      } catch (e) {
        console.log('[ThermalPrinter] TEST: Could not disconnect');
      }

      return true;
    } catch (err: any) {
      console.error('[ThermalPrinter] TEST: Error:', err.message);
      throw err;
    }
  }
}

export const thermalPrinterService = new ThermalPrinterService();
