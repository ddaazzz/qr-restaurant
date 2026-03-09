/**
 * ESC/POS Thermal Printer Service
 * Converts receipt data to ESC/POS binary commands for thermal receipt printers
 */

export interface ReceiptData {
  orderNumber?: string;
  tableNumber?: string;
  items?: Array<{ name: string; quantity: number; price?: number }>;
  subtotal?: number;
  serviceCharge?: number;
  total?: number;
  timestamp?: string;
  restaurantName?: string;
}

class ThermalPrinterService {
  /**
   * Convert receipt data to ESC/POS commands
   */
  generateESCPOS(receipt: ReceiptData): Uint8Array {
    const commands: number[] = [];

    // Initialize printer
    commands.push(...this.ESC('*', [0])); // Reset
    commands.push(...this.ESC('a', [1])); // Center alignment

    // Set font size to normal
    commands.push(...this.ESC('!', [0])); // Normal text

    // Print restaurant name if available
    if (receipt.restaurantName) {
      commands.push(...this.printTextCentered(receipt.restaurantName));
      commands.push(10); // Line feed
    }

    // Print header
    commands.push(...this.printTextCentered('========================================'));
    commands.push(10);

    // Print order/table info
    if (receipt.tableNumber) {
      commands.push(...this.printText(`Table: ${receipt.tableNumber}`));
      commands.push(10);
    }
    if (receipt.orderNumber) {
      commands.push(...this.printText(`Order: ${receipt.orderNumber}`));
      commands.push(10);
    }

    // Print timestamp
    if (receipt.timestamp) {
      commands.push(...this.printText(`Time: ${receipt.timestamp}`));
      commands.push(10);
    }

    commands.push(...this.printText('========================================'));
    commands.push(10, 10);

    // Print items
    if (receipt.items && receipt.items.length > 0) {
      commands.push(...this.printTextCentered('ITEMS'));
      commands.push(10);
      
      for (const item of receipt.items) {
        const qtyStr = `x${item.quantity}`;
        const priceStr = item.price ? `${(item.price / 100).toFixed(2)}` : '';
        
        // Item name
        commands.push(...this.printText(item.name));
        commands.push(10);
        
        // Qty and price on same line, right-aligned
        if (priceStr) {
          commands.push(...this.printText(`  ${qtyStr}                    ${priceStr}`));
        } else {
          commands.push(...this.printText(`  ${qtyStr}`));
        }
        commands.push(10);
      }

      commands.push(10);
      commands.push(...this.printText('========================================'));
      commands.push(10, 10);
    }

    // Print totals
    if (receipt.subtotal !== undefined) {
      commands.push(...this.printText(`Subtotal:          ${(receipt.subtotal / 100).toFixed(2)}`));
      commands.push(10);
    }

    if (receipt.serviceCharge && receipt.serviceCharge > 0) {
      commands.push(...this.printText(`Service Charge:    ${(receipt.serviceCharge / 100).toFixed(2)}`));
      commands.push(10);
    }

    if (receipt.total !== undefined) {
      // Bold for total
      commands.push(...this.ESC('!', [0x08])); // Bold
      commands.push(...this.printText(`TOTAL:             ${(receipt.total / 100).toFixed(2)}`));
      commands.push(...this.ESC('!', [0])); // Normal
      commands.push(10);
    }

    commands.push(10);
    commands.push(...this.printText('========================================'));
    commands.push(10, 10);

    // Thank you message
    commands.push(...this.printTextCentered('Thank You!'));
    commands.push(10);
    commands.push(...this.printTextCentered('Please Visit Again'));
    commands.push(10, 10, 10);

    // Cut paper
    commands.push(...this.ESC('m', [])); // Partial cut

    return new Uint8Array(commands);
  }

  /**
   * Send receipt to Bluetooth printer
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
      console.log('[ThermalPrinter] Generated', escposData.length, 'bytes of print data');

      // Connect to device
      console.log('[ThermalPrinter] Connecting to device...');
      let device: any;
      try {
        device = await manager.connectToDevice(deviceId, { timeout });
        console.log('[ThermalPrinter] Connected, discovering services...');
      } catch (e: any) {
        console.error('[ThermalPrinter] Connection failed:', e.message);
        throw e;
      }

      // Discover services and characteristics
      try {
        await device.discoverAllServicesAndCharacteristics();
        console.log('[ThermalPrinter] Services discovered');
      } catch (e: any) {
        console.error('[ThermalPrinter] Discovery failed:', e.message);
        throw e;
      }

      // Find a writable characteristic
      // Try common UUIDs for thermal printers
      const commonServiceUUIDs = [
        '180A', // Device Information
        '180F', // Battery Service
        '1801', // Generic Attribute
        '1800', // Generic Access
        'FFE0', // Many Chinese thermal printers use this
        '0000FFE0-0000-1000-8000-00805F9B34FB', // Nordic UART Service
      ];

      let writeCharacteristic: any = null;

      for (const serviceUUID of commonServiceUUIDs) {
        try {
          const characteristics = await device.characteristicsForService(serviceUUID);
          console.log(`[ThermalPrinter] Service ${serviceUUID} has ${characteristics.length} characteristics`);

          for (const char of characteristics) {
            // Look for write or write-without-response
            if (
              char.isWritableWithoutResponse ||
              char.isWritable
            ) {
              console.log('[ThermalPrinter] Found writable characteristic:', char.uuid);
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
        console.warn('[ThermalPrinter] No writable characteristic found, attempting generic write');
        // Try to get all characteristics and find any writable
        try {
          const allServices = await device.services();
          for (const service of allServices) {
            const chars = await device.characteristicsForService(service.uuid);
            for (const char of chars) {
              if (char.isWritableWithoutResponse || char.isWritable) {
                writeCharacteristic = char;
                console.log('[ThermalPrinter] Found characteristic in service', service.uuid);
                break;
              }
            }
            if (writeCharacteristic) break;
          }
        } catch (e: any) {
          console.error('[ThermalPrinter] Failed to find any writable characteristic:', e.message);
        }
      }

      if (!writeCharacteristic) {
        throw new Error('No writable characteristic found on device');
      }

      // Send data in chunks (most Bluetooth printers have MTU of 20-180 bytes)
      const chunkSize = 20; // Conservative chunk size
      console.log('[ThermalPrinter] Sending data in chunks of', chunkSize, 'bytes');

      for (let i = 0; i < escposData.length; i += chunkSize) {
        const chunk = escposData.slice(i, Math.min(i + chunkSize, escposData.length));
        const chunkArray = Array.from(chunk);

        try {
          if (writeCharacteristic.isWritableWithoutResponse) {
            await writeCharacteristic.writeWithoutResponse(chunkArray);
          } else {
            await writeCharacteristic.write(chunkArray);
          }
          console.log(`[ThermalPrinter] Sent chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(escposData.length / chunkSize)}`);
        } catch (writeErr: any) {
          console.error('[ThermalPrinter] Write failed:', writeErr.message);
          throw writeErr;
        }

        // Small delay between chunks
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log('[ThermalPrinter] All data sent successfully');

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
   * ESC command helper
   */
  private ESC(command: string, params: number[] = []): number[] {
    const result = [27]; // ESC (0x1B)
    result.push(command.charCodeAt(0));
    result.push(...params);
    return result;
  }

  /**
   * Print text (left-aligned)
   */
  private printText(text: string): number[] {
    return Array.from(text).map(char => char.charCodeAt(0)).concat([10]); // LF
  }

  /**
   * Print centered text
   */
  private printTextCentered(text: string): number[] {
    const result = [27, 97, 1]; // ESC 'a' 1 (center align)
    result.push(...Array.from(text).map(char => char.charCodeAt(0)));
    result.push(10); // LF
    result.push(27, 97, 0); // ESC 'a' 0 (left align)
    return result;
  }
}

export const thermalPrinterService = new ThermalPrinterService();
