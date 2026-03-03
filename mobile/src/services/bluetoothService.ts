import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { Platform } from 'react-native';
import * as ExpoDevice from 'expo-device';
import * as Permissions from 'expo-permissions';
import { BluetoothPrinter, PrinterConfig } from '../types';

class BluetoothService {
  private manager: BleManager;
  private connectedDevices: Map<string, Device> = new Map();
  private scanSubscription: Subscription | null = null;
  private discoveredDevices: Map<string, Device> = new Map();

  constructor() {
    this.manager = new BleManager();
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const { status } = await Permissions.askAsync(Permissions.IOS.LOCATION);
      return status === 'granted';
    } else {
      const { status: scanStatus } = await Permissions.askAsync(
        Permissions.ANDROID.BLUETOOTH_SCAN
      );
      const { status: connectStatus } = await Permissions.askAsync(
        Permissions.ANDROID.BLUETOOTH_CONNECT
      );
      const { status: locStatus } = await Permissions.askAsync(
        Permissions.ANDROID.ACCESS_FINE_LOCATION
      );
      return scanStatus === 'granted' && connectStatus === 'granted' && locStatus === 'granted';
    }
  }

  async scanForPrinters(): Promise<BluetoothPrinter[]> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Bluetooth permissions not granted');
      }

      this.discoveredDevices.clear();
      const printers: BluetoothPrinter[] = [];

      return new Promise((resolve, reject) => {
        this.scanSubscription = this.manager.startDeviceScan(
          null,
          null,
          (error, device) => {
            if (error) {
              this.scanSubscription?.remove();
              reject(error);
              return;
            }

            if (device && this.isPrinterDevice(device)) {
              if (!this.discoveredDevices.has(device.id)) {
                this.discoveredDevices.set(device.id, device);
                printers.push({
                  id: device.id,
                  name: device.name || 'Unknown Printer',
                  location: 'kitchen',
                  isConnected: false,
                });
              }
            }
          }
        );

        // Stop scanning after 10 seconds
        setTimeout(() => {
          this.scanSubscription?.remove();
          this.scanSubscription = null;
          resolve(printers);
        }, 10000);
      });
    } catch (error) {
      console.error('Error scanning for printers:', error);
      throw error;
    }
  }

  private isPrinterDevice(device: Device): boolean {
    const name = device.name?.toLowerCase() || '';
    const printerKeywords = [
      'printer',
      'thermal',
      'receipt',
      'pos',
      'epson',
      'star',
      'sunmi',
      'zebra',
    ];
    return printerKeywords.some((keyword) => name.includes(keyword)) || device.manufacturerData;
  }

  async connectToPrinter(deviceId: string): Promise<boolean> {
    try {
      const device = this.discoveredDevices.get(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      await device.connect();
      await device.discoverAllServicesAndCharacteristics();
      this.connectedDevices.set(deviceId, device);
      return true;
    } catch (error) {
      console.error('Error connecting to printer:', error);
      throw error;
    }
  }

  async disconnectPrinter(deviceId: string): Promise<boolean> {
    try {
      const device = this.connectedDevices.get(deviceId);
      if (device) {
        await device.cancelConnection();
        this.connectedDevices.delete(deviceId);
      }
      return true;
    } catch (error) {
      console.error('Error disconnecting printer:', error);
      throw error;
    }
  }

  async isPrinterConnected(deviceId: string): Promise<boolean> {
    try {
      const device = this.connectedDevices.get(deviceId);
      if (!device) return false;

      const isConnected = await device.isConnected();
      if (!isConnected) {
        this.connectedDevices.delete(deviceId);
      }
      return isConnected;
    } catch (error) {
      console.error('Error checking printer connection:', error);
      return false;
    }
  }

  async printOrder(
    deviceId: string,
    orderData: any,
    config?: PrinterConfig
  ): Promise<boolean> {
    try {
      const isConnected = await this.isPrinterConnected(deviceId);
      if (!isConnected) {
        throw new Error('Printer not connected');
      }

      const device = this.connectedDevices.get(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      // Generate ESC/POS thermal receipt
      const receiptData = this.generateThermalReceipt(orderData, config);

      // Find the printer service and characteristics
      const services = await device.services();
      for (const service of services) {
        const characteristics = await service.characteristics();
        for (const characteristic of characteristics) {
          // Look for write characteristic (typically UUID with write property)
          if (characteristic.isWritableWithoutResponse || characteristic.isWritable) {
            // Send data in chunks if necessary
            const maxChunkSize = 20;
            for (let i = 0; i < receiptData.length; i += maxChunkSize) {
              const chunk = receiptData.slice(i, i + maxChunkSize);
              await device.writeCharacteristicWithResponseForService(
                service.uuid,
                characteristic.uuid,
                this.bytesToBase64(chunk)
              );
            }
            return true;
          }
        }
      }

      throw new Error('Could not find writable printer characteristic');
    } catch (error) {
      console.error('Error printing:', error);
      throw error;
    }
  }

  private generateThermalReceipt(orderData: any, config?: PrinterConfig): Uint8Array {
    const commands: number[] = [];

    // ESC/POS commands initialization
    commands.push(...this.escPosCommand('ESC', '@')); // Initialize
    commands.push(...this.escPosCommand('ESC', '!', 0x38)); // Bold and large font

    // Add restaurant header
    if (orderData.restaurantName) {
      commands.push(...this.centerText(orderData.restaurantName));
    }

    commands.push(...this.horizontalLine());

    // Order details
    commands.push(...this.printLine(`Order #${orderData.orderId || 'N/A'}`));
    commands.push(...this.printLine(`Table: ${orderData.tableNumber || 'N/A'}`));
    commands.push(...this.printLine(`Time: ${new Date().toLocaleTimeString()}`));
    commands.push(...this.horizontalLine());

    // Items
    commands.push(...this.escPosCommand('ESC', '!', 0x00)); // Normal font
    if (orderData.items && Array.isArray(orderData.items)) {
      for (const item of orderData.items) {
        const itemName = `${item.quantity}x ${item.name}`;
        commands.push(...this.printLine(itemName));

        if (item.selectedOptions && Array.isArray(item.selectedOptions)) {
          for (const option of item.selectedOptions) {
            commands.push(...this.printLine(`  - ${option.name}`));
          }
        }

        if (item.notes) {
          commands.push(...this.printLine(`  Note: ${item.notes}`));
        }
      }
    }

    commands.push(...this.horizontalLine());

    // Total
    commands.push(...this.escPosCommand('ESC', '!', 0x08)); // Bold
    const total = orderData.totalAmount || 0;
    commands.push(...this.rightAlignText(`Total: $${total.toFixed(2)}`));
    commands.push(...this.escPosCommand('ESC', '!', 0x00)); // Normal

    commands.push(...this.horizontalLine());
    commands.push(...this.centerText('Thank you!'));

    // Feed and cut
    commands.push(...this.escPosCommand('ESC', 'i')); // Partial cut
    commands.push(...this.escPosCommand('LF')); // Line feed

    return new Uint8Array(commands);
  }

  private escPosCommand(...args: any[]): number[] {
    const commands: number[] = [];

    for (const arg of args) {
      if (arg === 'ESC') commands.push(0x1b);
      else if (arg === 'LF') commands.push(0x0a);
      else if (typeof arg === 'number') commands.push(arg);
      else if (typeof arg === 'string')
        commands.push(...arg.split('').map((c) => c.charCodeAt(0)));
    }

    return commands;
  }

  private printLine(text: string): number[] {
    const commands = [...text.split('').map((c) => c.charCodeAt(0))];
    commands.push(0x0a); // Line feed
    return commands;
  }

  private centerText(text: string): number[] {
    const commands = [0x1b, 0x61, 0x01]; // Center alignment
    commands.push(...text.split('').map((c) => c.charCodeAt(0)));
    commands.push(0x0a);
    commands.push(0x1b, 0x61, 0x00); // Left alignment
    return commands;
  }

  private rightAlignText(text: string): number[] {
    const commands = [0x1b, 0x61, 0x02]; // Right alignment
    commands.push(...text.split('').map((c) => c.charCodeAt(0)));
    commands.push(0x0a);
    commands.push(0x1b, 0x61, 0x00); // Left alignment
    return commands;
  }

  private horizontalLine(): number[] {
    return this.printLine('==================================');
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  stopScan(): void {
    if (this.scanSubscription) {
      this.scanSubscription.remove();
      this.scanSubscription = null;
    }
  }

  getConnectedPrinters(): BluetoothPrinter[] {
    return Array.from(this.connectedDevices.entries()).map(([id, device]) => ({
      id,
      name: device.name || 'Unknown Printer',
      location: 'kitchen',
      isConnected: true,
    }));
  }
}

export const bluetoothService = new BluetoothService();
