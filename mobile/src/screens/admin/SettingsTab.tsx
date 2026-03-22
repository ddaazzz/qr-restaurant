import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  TextInput,
  Modal,
  FlatList,
  Share,
  Image,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import QRCode from 'react-native-qrcode-svg';
import { BleManager } from 'react-native-ble-plx';
import { apiClient } from '../../services/apiClient';
import { printerSettingsService } from '../../services/printerSettingsService';

interface RestaurantSettings {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  background_url?: string;
  timezone?: string;
  service_charge_percent?: number;
  theme_color?: string;
  language_preference?: string;
  qr_mode?: 'regenerate' | 'static_table' | 'static_seat';
  booking_time_allowance_mins?: number;
  pos_webhook_url?: string;
  pos_api_key?: string;
  pos_system_type?: string;
}

interface PrinterSettings {
  // Generic printer settings (shared for all doc types)
  // Backend stores only ONE printer config, not separate qr/bill/kitchen
  id?: number;
  printer_type?: string;
  printer_host?: string;
  printer_port?: number;
  printer_usb_vendor_id?: string;
  printer_usb_product_id?: string;
  bluetooth_device_id?: string;
  bluetooth_device_name?: string;
  
  // QR Code Printer Configuration
  qr_printer_type?: string;
  qr_printer_host?: string;
  qr_printer_port?: number;
  qr_bluetooth_device_id?: string;
  qr_bluetooth_device_name?: string;
  qr_auto_print?: boolean;
  
  // Bill/Receipt Printer Configuration
  bill_printer_type?: string;
  bill_printer_host?: string;
  bill_printer_port?: number;
  bill_bluetooth_device_id?: string;
  bill_bluetooth_device_name?: string;
  bill_auto_print?: boolean;
  
  // Kitchen Order Printer Configuration
  kitchen_printer_type?: string;
  kitchen_printer_host?: string;
  kitchen_printer_port?: number;
  kitchen_bluetooth_device_id?: string;
  kitchen_bluetooth_device_name?: string;
  kitchen_auto_print?: boolean;
  
  // Auto-print flags for specific document types (legacy)
  print_logo?: boolean;
  
  // Printer paper width for adaptive QR code sizing
  printer_paper_width?: number;
}

interface Coupon {
  id: number;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value?: number;
  max_uses?: number;
  description?: string;
}

interface Variant {
  id: number;
  name: string;
  required?: boolean;
  min_select?: number | null;
  max_select?: number | null;
  menu_item_name?: string;
  price_cents?: number;
}

interface VariantPreset {
  id: number;
  name: string;
  description?: string;
  variants_count: number;
  options_count?: number;
  variants?: Variant[];
}

interface PaymentTerminal {
  id: number;
  vendor_name: 'kpay' | 'other';
  is_active: boolean;
  app_id: string;
  terminal_ip?: string;
  terminal_port?: number;
  endpoint_path?: string;
  metadata?: Record<string, any>;
  last_tested_at?: string;
  last_error_message?: string;
  created_at?: string;
  updated_at?: string;
}

export const SettingsTab = ({ restaurantId, navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [variantPresets, setVariantPresets] = useState<VariantPreset[]>([]);
  const [paymentTerminals, setPaymentTerminals] = useState<PaymentTerminal[]>([]);

  // Modal states
  const [editMode, setEditMode] = useState(false);
  const [showingPrinterSettingsPage, setShowingPrinterSettingsPage] = useState(false);
  const [editingPrinterType, setEditingPrinterType] = useState<'qr' | 'bill' | 'kitchen' | null>(null);
  const [bluetoothSearching, setBluetoothSearching] = useState(false);
  const [bluetoothDevices, setBluetoothDevices] = useState<Array<{ id: string; name: string; signal: number }>>([]);
  // Modal state: 'printer' | 'bluetooth' | null
  const [activeModal, setActiveModal] = useState<'printer' | 'bluetooth' | null>(null);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showPaymentTerminalModal, setShowPaymentTerminalModal] = useState(false);
  const [editingTerminalId, setEditingTerminalId] = useState<number | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showCouponsModal, setShowCouponsModal] = useState(false);
  const [showVariantPresetsModal, setShowVariantPresetsModal] = useState(false);
  const [selectedVariantPreset, setSelectedVariantPreset] = useState<VariantPreset | null>(null);
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [showStaffQRModal, setShowStaffQRModal] = useState(false);
  const [showKitchenQRModal, setShowKitchenQRModal] = useState(false);
  
  // Format preferences (displayed directly on printer settings page)
  const [qrCodeSize, setQrCodeSize] = useState('medium');
  const [qrTextAbove, setQrTextAbove] = useState('Scan to Order');
  const [qrTextBelow, setQrTextBelow] = useState('Let us know how we did!');
  const [billPaperWidth, setBillPaperWidth] = useState('80');
  const [billShowPhone, setBillShowPhone] = useState(true);
  const [billShowAddress, setBillShowAddress] = useState(true);
  const [billShowTime, setBillShowTime] = useState(true);
  const [billShowItems, setBillShowItems] = useState(true);
  const [billShowTotal, setBillShowTotal] = useState(true);
  const [billFooterMsg, setBillFooterMsg] = useState('Thank you for your business!');

  // Form states
  const [formData, setFormData] = useState<RestaurantSettings | null>(null);
  const [printerFormData, setPrinterFormData] = useState<PrinterSettings | null>(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    min_order_value: '',
    description: '',
  });
  const [terminalForm, setTerminalForm] = useState({
    vendor_name: 'kpay' as 'kpay' | 'other',
    app_id: '',
    app_secret: '',
    terminal_ip: '192.168.50.210',
    terminal_port: '18080',
    endpoint_path: '/v2/pos/sign',
  });
  const [testingTerminal, setTestingTerminal] = useState(false);
  const [terminalTestResult, setTerminalTestResult] = useState<any>(null);

  const fetchSettings = async () => {
    try {
      setError(null);
      // Fetch critical settings first (don't wait for coupons - they're not critical)
      const [settingsRes, printerRes] = await Promise.all([
        apiClient.get(`/api/restaurants/${restaurantId}/settings`),
        apiClient.get(`/api/restaurants/${restaurantId}/printer-settings`),
      ]);

      setSettings(settingsRes.data);
      const printerData = printerRes.data;
      // Fetched printer data from API
      // Ensure printer_type defaults to 'bluetooth' if missing or empty
      if (!printerData.printer_type) {
        console.log('[Settings] Printer type was null/empty, setting to bluetooth');
        printerData.printer_type = 'bluetooth';
      }
      // Printer type set
      setPrinterSettings(printerData);
      setFormData(settingsRes.data);
      setPrinterFormData(printerData);

      // Fetch coupons separately (non-blocking) with shorter timeout
      // Don't block settings load if coupons endpoint is slow/unavailable
      fetchCoupons();
    } catch (err: any) {
      console.error('[Settings] Error fetching settings:', err);
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchCoupons = async () => {
    try {
      const couponsRes = await apiClient.get(`/api/restaurants/${restaurantId}/coupons`);
      const couponsList = Array.isArray(couponsRes.data) ? couponsRes.data : couponsRes.data.coupons || [];
      setCoupons(couponsList);
    } catch (err: any) {
      console.warn('[Settings] Failed to fetch coupons (non-critical):', err.message);
      // Don't show error or block UI - coupons fetching is non-critical
      setCoupons([]);
    }
  };

  const fetchVariantPresets = async () => {
    try {
      const presetsRes = await apiClient.get(`/api/restaurants/${restaurantId}/variant-presets`);
      const presetsList = Array.isArray(presetsRes.data) ? presetsRes.data : presetsRes.data.presets || [];
      setVariantPresets(presetsList);
    } catch (err: any) {
      console.warn('[Settings] Failed to fetch variant presets (non-critical):', err.message);
      // Don't show error or block UI - variant presets fetching is non-critical
      setVariantPresets([]);
    }
  };

  const fetchPaymentTerminals = async () => {
    try {
      const terminalsRes = await apiClient.get(`/api/restaurants/${restaurantId}/payment-terminals`);
      const terminalsList = Array.isArray(terminalsRes.data) ? terminalsRes.data : [];
      setPaymentTerminals(terminalsList);
    } catch (err: any) {
      console.warn('[Settings] Failed to fetch payment terminals (non-critical):', err.message);
      // Don't show error or block UI - payment terminals fetching is non-critical
      setPaymentTerminals([]);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchVariantPresets();
    fetchPaymentTerminals();
  }, [restaurantId]);

  const getPrinterTypeLabel = (type?: string): string => {
    const labels: Record<string, string> = {
      'thermal': 'Thermal Network Printer',
      'bluetooth': 'Bluetooth Printer',
    };
    const label = labels[type || ''] || '—';
    console.log('[Printer] getPrinterTypeLabel called with:', type, '-> result:', label);
    return label;
  };

  const saveSettings = async () => {
    try {
      if (!formData) return;

      await apiClient.patch(`/api/restaurants/${restaurantId}/settings`, {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        timezone: formData.timezone,
        service_charge_percent: parseFloat(formData.service_charge_percent?.toString() || '0'),
        language_preference: formData.language_preference,
        logo_url: formData.logo_url,
        background_url: formData.background_url,
        booking_time_allowance_mins: parseInt(formData.booking_time_allowance_mins?.toString() || '30'),
        qr_mode: formData.qr_mode,
      });

      setSettings(formData);
      setEditMode(false);
      Alert.alert('Success', 'Settings saved successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to save settings');
    }
  };

  const savePrinterSettings = async () => {
    try {
      if (!printerFormData || !editingPrinterType) return;

      const prefix = editingPrinterType; // 'qr', 'bill', or 'kitchen'
      const payload: any = {};

      // Save to per-printer-type columns: {prefix}_printer_type, {prefix}_printer_host, etc.
      payload[`${prefix}_printer_type`] = printerFormData.printer_type;
      payload[`${prefix}_printer_host`] = printerFormData.printer_host;
      payload[`${prefix}_printer_port`] = parseInt((printerFormData.printer_port as any)?.toString() || '9100');

      // Include Bluetooth device info if it's a bluetooth printer
      if (printerFormData.printer_type === 'bluetooth') {
        payload[`${prefix}_bluetooth_device_id`] = printerFormData.bluetooth_device_id;
        payload[`${prefix}_bluetooth_device_name`] = printerFormData.bluetooth_device_name;
      } else {
        // Clear bluetooth fields if switching away from bluetooth
        payload[`${prefix}_bluetooth_device_id`] = null;
        payload[`${prefix}_bluetooth_device_name`] = null;
      }

      // Save auto-print flag for the specific printer type
      if (editingPrinterType === 'bill') {
        payload.bill_auto_print = printerFormData.bill_auto_print || false;
      } else if (editingPrinterType === 'kitchen') {
        payload.kitchen_auto_print = printerFormData.kitchen_auto_print || false;
      } else if (editingPrinterType === 'qr') {
        payload.qr_auto_print = printerFormData.qr_auto_print || false;
      }

      // Save printer paper width if provided
      if (printerFormData.printer_paper_width) {
        payload.printer_paper_width = printerFormData.printer_paper_width;
      }

      console.log(`[SettingsTab] Saving ${editingPrinterType} printer settings with payload:`, payload);

      await apiClient.patch(`/api/restaurants/${restaurantId}/printer-settings`, payload);

      // Update local state with new data
      setPrinterSettings({ ...printerSettings, ...payload } as PrinterSettings);
      
      // Invalidate cache so next fetch gets fresh data from backend
      printerSettingsService.invalidateCache(restaurantId);
      
      setEditingPrinterType(null);
      setActiveModal(null);
      Alert.alert('Success', `${editingPrinterType.toUpperCase()} printer settings saved!`);
    } catch (err: any) {
      console.error('[SettingsTab] Error saving printer settings:', err);
      Alert.alert('Error', err.response?.data?.error || 'Failed to save printer settings');
    }
  };

  const saveQRFormatSettings = async () => {
    try {
      const payload = {
        qr_code_size: qrCodeSize,
        qr_text_above: qrTextAbove,
        qr_text_below: qrTextBelow,
      };

      console.log('[SettingsTab] Saving QR Code Format settings:', payload);

      await apiClient.patch(`/api/restaurants/${restaurantId}/printer-settings`, payload);

      // Invalidate cache so next fetch gets fresh data from backend
      printerSettingsService.invalidateCache(restaurantId);
      
      Alert.alert('Success', 'QR Code Format settings saved!');
    } catch (err: any) {
      console.error('[SettingsTab] Error saving QR Code Format settings:', err);
      Alert.alert('Error', err.response?.data?.error || 'Failed to save QR Code Format settings');
    }
  };

  const startBluetoothSearch = async () => {
    try {
      setBluetoothSearching(true);
      setBluetoothDevices([]);

      // Request permissions through BleManager's native implementation
      console.log('Initializing Bluetooth...');
      const manager = new BleManager();
      
      try {
        // Check Bluetooth state
        const state = await manager.state();
        console.log('[Bluetooth] Manager state:', state);
        
        if (state !== 'PoweredOn') {
          Alert.alert('Bluetooth', 'Please enable Bluetooth on your device and try again');
          return;
        }
      } catch (err) {
        console.warn('Bluetooth state check failed, attempting to scan anyway:', err);
      }

      const foundDevices: Map<string, { id: string; name: string; signal: number }> = new Map();

      // Start scanning immediately
      console.log('Starting device scan...');
      manager.startDeviceScan(null, null, (error: any, device: any) => {
        if (error) {
          console.error('Bluetooth scan callback error:', error);
          return;
        }

        // Add any device found (with or without name)
        if (device && device.id) {
          const deviceName = device.name && device.name.trim().length > 0 
            ? device.name 
            : `Device ${device.id.substring(0, 8)}`;
          
          if (!foundDevices.has(device.id)) {
            foundDevices.set(device.id, {
              id: device.id,
              name: deviceName,
              signal: device.rssi || 0,
            });
            
            // Update state immediately
            setBluetoothDevices(Array.from(foundDevices.values()));
            console.log(`📱 Found Bluetooth device: ${deviceName} (ID: ${device.id}, Signal: ${device.rssi})`);
          }
        }
      });

      // Stop scanning after 10 seconds
      setTimeout(() => {
        manager.stopDeviceScan();
        setBluetoothSearching(false);
        console.log(`✓ Bluetooth scan completed. Found ${foundDevices.size} devices`);
        
        if (foundDevices.size === 0) {
          Alert.alert('No Devices Found', 'No Bluetooth devices detected. Make sure your printer is powered on and in pairing mode.\n\nTip: On iOS, ensure Location permission is granted. On Android, ensure Bluetooth permission is granted.');
        }
      }, 10000);
    } catch (err: any) {
      console.error('❌ Bluetooth search error:', err);
      setBluetoothSearching(false);
      Alert.alert('Error', 'Failed to search for Bluetooth devices: ' + err.message + '\n\nMake sure Bluetooth permissions are granted.');
    }
  };

  const selectBluetoothDevice = (device: { id: string; name: string; signal: number }) => {
    if (!editingPrinterType) return;

    // Use prefixed fields for each printer type (qr_, bill_, kitchen_)
    const payload: any = {
      ...printerFormData,
    };
    
    const prefix = editingPrinterType; // 'qr', 'bill', or 'kitchen'
    payload[`${prefix}_bluetooth_device_id`] = device.id;
    payload[`${prefix}_bluetooth_device_name`] = device.name;

    setPrinterFormData(payload as PrinterSettings);

    setActiveModal('printer');
    Alert.alert('✓ Device Selected', `"${device.name}" has been selected for your ${editingPrinterType.toUpperCase()} printer.`);
  };

  // Bluetooth device selection is now handled at runtime during printing

  const createCoupon = async () => {
    try {
      if (!couponForm.code || !couponForm.discount_value) {
        Alert.alert('Validation', 'Please fill in all required fields');
        return;
      }

      await apiClient.post(`/api/restaurants/${restaurantId}/coupons`, {
        code: couponForm.code.toUpperCase(),
        discount_type: couponForm.discount_type,
        discount_value: parseFloat(couponForm.discount_value),
        min_order_value: couponForm.min_order_value ? parseFloat(couponForm.min_order_value) : null,
        description: couponForm.description || null,
      });

      await fetchSettings();
      setCouponForm({
        code: '',
        discount_type: 'percentage',
        discount_value: '',
        min_order_value: '',
        description: '',
      });
      setShowCouponModal(false);
      Alert.alert('Success', 'Coupon created!');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create coupon');
    }
  };

  const deleteCoupon = async (couponId: number) => {
    Alert.alert('Delete Coupon', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/coupons/${couponId}`);
            await fetchSettings();
            Alert.alert('Success', 'Coupon deleted!');
          } catch (err: any) {
            Alert.alert('Error', 'Failed to delete coupon');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  // Payment Terminal Functions
  const savePaymentTerminal = async () => {
    try {
      if (!terminalForm.app_id || !terminalForm.app_secret || !terminalForm.terminal_ip || !terminalForm.terminal_port) {
        Alert.alert('Validation', 'Please fill in all required fields');
        return;
      }

      const payload = {
        vendor_name: terminalForm.vendor_name,
        app_id: terminalForm.app_id,
        app_secret: terminalForm.app_secret,
        terminal_ip: terminalForm.terminal_ip,
        terminal_port: parseInt(terminalForm.terminal_port),
        endpoint_path: terminalForm.endpoint_path || '/v2/pos/sign',
      };

      if (editingTerminalId) {
        // Update existing terminal
        await apiClient.patch(`/api/restaurants/${restaurantId}/payment-terminals/${editingTerminalId}`, payload);
        Alert.alert('Success', 'Payment terminal updated successfully!');
      } else {
        // Create new terminal
        await apiClient.post(`/api/restaurants/${restaurantId}/payment-terminals`, payload);
        Alert.alert('Success', 'Payment terminal created successfully!');
      }

      await fetchPaymentTerminals();
      resetTerminalForm();
      setShowPaymentTerminalModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to save payment terminal');
    }
  };

  const testPaymentTerminal = async () => {
    try {
      if (!editingTerminalId) {
        Alert.alert('Error', 'Please save the terminal configuration first');
        return;
      }

      setTestingTerminal(true);
      const response = await apiClient.post(
        `/api/restaurants/${restaurantId}/payment-terminals/${editingTerminalId}/test`
      );

      setTerminalTestResult(response.data);
      
      if (response.data.success) {
        Alert.alert(
          'Connection Successful! 🎉',
          `Connected to ${terminalForm.vendor_name.toUpperCase()} terminal at ${terminalForm.terminal_ip}:${terminalForm.terminal_port}`
        );
      } else {
        Alert.alert(
          'Connection Failed',
          response.data.error || response.data.message
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to test terminal connection');
    } finally {
      setTestingTerminal(false);
    }
  };

  const deletePaymentTerminal = async (terminalId: number) => {
    Alert.alert('Delete Payment Terminal', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/restaurants/${restaurantId}/payment-terminals/${terminalId}`);
            await fetchPaymentTerminals();
            Alert.alert('Success', 'Payment terminal deleted!');
          } catch (err: any) {
            Alert.alert('Error', 'Failed to delete payment terminal');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const editPaymentTerminal = (terminal: PaymentTerminal) => {
    setEditingTerminalId(terminal.id);
    setTerminalForm({
      vendor_name: terminal.vendor_name,
      app_id: terminal.app_id,
      app_secret: '', // Don't pre-fill secret for security
      terminal_ip: terminal.terminal_ip || '192.168.50.210',
      terminal_port: terminal.terminal_port?.toString() || '18080',
      endpoint_path: terminal.endpoint_path || '/v2/pos/sign',
    });
    setTerminalTestResult(null);
    setShowPaymentTerminalModal(true);
  };

  const resetTerminalForm = () => {
    setEditingTerminalId(null);
    setTerminalForm({
      vendor_name: 'kpay',
      app_id: '',
      app_secret: '',
      terminal_ip: '192.168.50.210',
      terminal_port: '18080',
      endpoint_path: '/v2/pos/sign',
    });
    setTerminalTestResult(null);
  };

  const copyToClipboard = async (text: string, label: string) => {
    // In React Native, we'd use a library like @react-native-clipboard/clipboard
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  const getWebOrigin = () => {
    // This should match your backend server URL
    // For development, you might need to set this via environment variables
    return 'http://localhost:3000'; // Update based on your setup
  };

  const generateStaffQRUrl = () => {
    return `${getWebOrigin()}/staff.html?rid=${restaurantId}`;
  };

  const generateKitchenQRUrl = () => {
    return `${getWebOrigin()}/kitchen.html?rid=${restaurantId}`;
  };

  const shareQRCode = async (type: 'staff' | 'kitchen') => {
    try {
      const url = type === 'staff' ? generateStaffQRUrl() : generateKitchenQRUrl();
      const title = type === 'staff' ? 'Staff Login QR Code' : 'Kitchen Login QR Code';
      
      await Share.share({
        message: `${title}\n\nScan this link with your phone to login:\n${url}`,
        url: url, // For iOS
        title: title,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share QR code');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Bluetooth Device Search Modal - rendered at root level so it's always available
  const bluetoothModal = (
    <Modal
      transparent={true}
      visible={activeModal === 'bluetooth'}
      animationType="slide"
      onRequestClose={() => setActiveModal(null)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🔍 Search Bluetooth Devices</Text>
            <TouchableOpacity onPress={() => setActiveModal(null)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, { marginBottom: 16, marginHorizontal: 16 }]}
            onPress={startBluetoothSearch}
            disabled={bluetoothSearching}
          >
            <Text style={styles.btnText}>{bluetoothSearching ? '🔄 Scanning...' : '🔍 Scan for Devices'}</Text>
          </TouchableOpacity>

          <ScrollView style={{ flex: 1, marginHorizontal: 0 }}>
            {bluetoothDevices.length > 0 ? (
              bluetoothDevices.map((device) => (
                <TouchableOpacity
                  key={device.id}
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: '#e5e7eb',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                  }}
                  onPress={() => selectBluetoothDevice(device)}
                >
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#1f2937' }}>{device.name}</Text>
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>Signal: {device.signal} dBm</Text>
                </TouchableOpacity>
              ))
            ) : bluetoothSearching ? (
              <Text style={[styles.helperText, { marginHorizontal: 16, marginTop: 20 }]}>Searching for devices...</Text>
            ) : (
              <Text style={[styles.helperText, { marginHorizontal: 16, marginTop: 20 }]}>Click "Scan for Devices" to search for nearby Bluetooth devices</Text>
            )}
          </ScrollView>

          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => {
                setActiveModal(null);
                setShowingPrinterSettingsPage(false);
              }}
            >
              <Text style={styles.btnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Printer Configuration Page View (when editing a specific printer type)
  if (showingPrinterSettingsPage && editingPrinterType) {
    return (
      <>
        <View style={styles.container}>
        {/* Page Header */}
        <View style={{ padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.printerPageTitle}>
            {editingPrinterType === 'qr' && '📋 QR Code Printer'}
            {editingPrinterType === 'bill' && '🧾 Bill Printer'}
            {editingPrinterType === 'kitchen' && '🍳 Kitchen Order Printer'}
          </Text>
          <TouchableOpacity onPress={() => setEditingPrinterType(null)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={{ marginHorizontal: 16, marginTop: 16 }}>
            {/* Auto-Print Toggle */}
            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.label}>Auto-Print</Text>
                <Switch
                  value={
                    editingPrinterType === 'bill'
                      ? (printerFormData?.bill_auto_print || false)
                      : editingPrinterType === 'kitchen'
                      ? (printerFormData?.kitchen_auto_print || false)
                      : editingPrinterType === 'qr'
                      ? (printerFormData?.qr_auto_print || false)
                      : false
                  }
                  onValueChange={(value) => {
                    if (editingPrinterType === 'bill') {
                      setPrinterFormData({ ...printerFormData, bill_auto_print: value } as PrinterSettings);
                    } else if (editingPrinterType === 'kitchen') {
                      setPrinterFormData({ ...printerFormData, kitchen_auto_print: value } as PrinterSettings);
                    } else if (editingPrinterType === 'qr') {
                      setPrinterFormData({ ...printerFormData, qr_auto_print: value } as PrinterSettings);
                    }
                  }}
                />
              </View>
            </View>

            {/* Printer Type Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Printer Type</Text>
              <View>
                {['thermal', 'bluetooth'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={{ paddingVertical: 8 }}
                    onPress={() => {
                      setPrinterFormData({ ...printerFormData, printer_type: type } as PrinterSettings);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          borderWidth: 2,
                          borderColor: printerFormData?.printer_type === type ? '#3b82f6' : '#d1d5db',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        {printerFormData?.printer_type === type && (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' }} />
                        )}
                      </View>
                      <Text style={{ marginLeft: 10, fontSize: 14, color: '#1f2937' }}>{getPrinterTypeLabel(type)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Thermal Printer Config */}
            {printerFormData?.printer_type === 'thermal' && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>IP Address</Text>
                  <TextInput
                    style={styles.input}
                    value={printerFormData?.printer_host?.toString() || ''}
                    onChangeText={(text) => {
                      setPrinterFormData({ ...printerFormData, printer_host: text } as PrinterSettings);
                    }}
                    placeholder="e.g., 192.168.1.100"
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Port</Text>
                  <TextInput
                    style={styles.input}
                    value={printerFormData?.printer_port?.toString() || '9100'}
                    onChangeText={(text) => {
                      setPrinterFormData({ ...printerFormData, printer_port: parseInt(text) || 9100 } as PrinterSettings);
                    }}
                    placeholder="9100"
                    keyboardType="number-pad"
                  />
                </View>
              </>
            )}

            {/* Bluetooth Printer Config */}
            {printerFormData?.printer_type === 'bluetooth' && (
              <>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { marginBottom: 16 }]}
                  onPress={() => setActiveModal('bluetooth')}
                >
                  <Text style={styles.btnText}>🔍 Scan for Bluetooth Devices</Text>
                </TouchableOpacity>

                {(printerFormData?.bluetooth_device_name || 
                  (editingPrinterType === 'qr' && printerSettings?.qr_bluetooth_device_name) ||
                  (editingPrinterType === 'bill' && printerSettings?.bill_bluetooth_device_name) ||
                  (editingPrinterType === 'kitchen' && printerSettings?.kitchen_bluetooth_device_name)) && (
                  <View style={{ backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#86efac', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#059669', marginBottom: 4 }}>✓ Connected Device</Text>
                    <Text style={{ fontSize: 14, color: '#1f2937', fontWeight: '500' }}>
                      {printerFormData?.bluetooth_device_name || 
                      (editingPrinterType === 'qr' ? printerSettings?.qr_bluetooth_device_name : '') ||
                      (editingPrinterType === 'bill' ? printerSettings?.bill_bluetooth_device_name : '') ||
                      (editingPrinterType === 'kitchen' ? printerSettings?.kitchen_bluetooth_device_name : '')}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>ID: {printerFormData?.bluetooth_device_id || 
                      (editingPrinterType === 'qr' ? printerSettings?.qr_bluetooth_device_id : '') ||
                      (editingPrinterType === 'bill' ? printerSettings?.bill_bluetooth_device_id : '') ||
                      (editingPrinterType === 'kitchen' ? printerSettings?.kitchen_bluetooth_device_id : '')}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>

        <View style={styles.formActions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => setEditingPrinterType(null)}
          >
            <Text style={styles.btnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => savePrinterSettings()}
          >
            <Text style={styles.btnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
      {bluetoothModal}
    </>
  );
  }

  // Printer Settings Full Page View
  if (showingPrinterSettingsPage) {
    return (
      <>
        <View style={styles.container}>
        {/* Page Header */}
        <View style={{ padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.printerPageTitle}>🖨️ Printer Settings</Text>
          <TouchableOpacity onPress={() => setShowingPrinterSettingsPage(false)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* QR Code Format Section */}
          <View style={{ marginHorizontal: 16, marginTop: 16 }}>
            <Text style={[styles.label, { fontSize: 14, fontWeight: '600', marginBottom: 12 }]}>📋 QR Code Format</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>QR Code Size</Text>
              <View style={styles.toggleGroup}>
                {['small', 'medium', 'large'].map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.typeBtn,
                      qrCodeSize === size && styles.typeBtnActive,
                    ]}
                    onPress={() => setQrCodeSize(size)}
                  >
                    <Text
                      style={[
                        styles.typeBtnText,
                        qrCodeSize === size && styles.typeBtnTextActive,
                      ]}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Text Above QR Code</Text>
              <TextInput
                style={styles.input}
                value={qrTextAbove}
                onChangeText={setQrTextAbove}
                placeholder="e.g., Scan to Order"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Text Below QR Code</Text>
              <TextInput
                style={styles.input}
                value={qrTextBelow}
                onChangeText={setQrTextBelow}
                placeholder="e.g., Let us know how we did!"
              />
            </View>

            <View style={[styles.formGroup, { marginBottom: 20 }]}>
              <Text style={styles.label}>📄 Preview</Text>
              <View style={{
                borderColor: '#ddd',
                borderWidth: 2,
                borderRadius: 6,
                padding: 16,
                backgroundColor: '#f9fafb',
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 8 }}>La Cave (Sai Ying Pun)</Text>
                <Text style={{ fontSize: 10, marginBottom: 2 }}>Table: T02</Text>
                <Text style={{ fontSize: 10, marginBottom: 8 }}>Time: 2026-03-13 18:24</Text>
                <Text style={{ fontSize: 10, marginBottom: 12 }}>{'='.repeat(40)}</Text>
                <View style={{
                  width: qrCodeSize === 'small' ? 120 : qrCodeSize === 'medium' ? 150 : 180,
                  height: qrCodeSize === 'small' ? 120 : qrCodeSize === 'medium' ? 150 : 180,
                  backgroundColor: '#f0f0f0',
                  borderWidth: 1,
                  borderColor: '#ccc',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 12,
                }}>
                  <Text style={{ fontSize: 11, color: '#999' }}>QR Code</Text>
                </View>
                <Text style={{ fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{qrTextAbove}</Text>
                <Text style={{ fontSize: 10, marginBottom: 8, textAlign: 'center' }}>{qrTextBelow}</Text>
                <Text style={{ fontSize: 9, color: '#666' }}>Powered by Chuio</Text>
              </View>
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 20, marginBottom: 20 }} />
          </View>

          {/* Bill Format Section */}
          <View style={{ marginHorizontal: 16 }}>
            <Text style={[styles.label, { fontSize: 14, fontWeight: '600', marginBottom: 12 }]}>🧾 Bill Format</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Paper Width</Text>
              <View style={styles.toggleGroup}>
                {['58', '80'].map((width) => (
                  <TouchableOpacity
                    key={width}
                    style={[
                      styles.typeBtn,
                      billPaperWidth === width && styles.typeBtnActive,
                    ]}
                    onPress={() => setBillPaperWidth(width)}
                  >
                    <Text
                      style={[
                        styles.typeBtnText,
                        billPaperWidth === width && styles.typeBtnTextActive,
                      ]}
                    >
                      {width}mm
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.label}>Show Phone</Text>
                <Switch value={billShowPhone} onValueChange={setBillShowPhone} />
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.label}>Show Address</Text>
                <Switch value={billShowAddress} onValueChange={setBillShowAddress} />
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.label}>Show Order Time</Text>
                <Switch value={billShowTime} onValueChange={setBillShowTime} />
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.label}>Show Items</Text>
                <Switch value={billShowItems} onValueChange={setBillShowItems} />
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.label}>Show Total</Text>
                <Switch value={billShowTotal} onValueChange={setBillShowTotal} />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Footer Message</Text>
              <TextInput
                style={styles.input}
                value={billFooterMsg}
                onChangeText={setBillFooterMsg}
                placeholder="Thank you for your business!"
              />
            </View>

            <View style={[styles.formGroup, { marginBottom: 20 }]}>
              <Text style={styles.label}>📄 Preview</Text>
              <View style={{
                borderColor: '#ddd',
                borderWidth: 2,
                borderRadius: 6,
                padding: 12,
                backgroundColor: '#f9fafb',
              }}>
                <Text style={{
                  fontSize: billPaperWidth === '58' ? 11 : 13,
                  fontWeight: '600',
                  textAlign: 'center',
                  marginBottom: 2,
                  fontFamily: 'Courier New',
                }}>La Cave (Sai Ying Pun)</Text>
                {billShowPhone && (
                  <Text style={{
                    fontSize: billPaperWidth === '58' ? 9 : 11,
                    textAlign: 'center',
                    marginBottom: 1,
                    fontFamily: 'Courier New',
                  }}>Phone: +852 1234 5678</Text>
                )}
                {billShowAddress && (
                  <Text style={{
                    fontSize: billPaperWidth === '58' ? 9 : 11,
                    textAlign: 'center',
                    marginBottom: 4,
                    fontFamily: 'Courier New',
                  }}>123 Main Street</Text>
                )}
                <Text style={{
                  fontSize: billPaperWidth === '58' ? 9 : 11,
                  textAlign: 'center',
                  marginVertical: 4,
                  letterSpacing: 1,
                  fontFamily: 'Courier New',
                }}>{'='.repeat(billPaperWidth === '58' ? 40 : 50)}</Text>
                {billShowTime && (
                  <Text style={{
                    fontSize: billPaperWidth === '58' ? 9 : 11,
                    textAlign: 'center',
                    marginVertical: 2,
                    fontFamily: 'Courier New',
                  }}>Order Time: 2026-03-13 18:24</Text>
                )}
                <Text style={{
                  fontSize: billPaperWidth === '58' ? 9 : 11,
                  marginVertical: 2,
                  fontFamily: 'Courier New',
                }}>Table: T02       Pax: 4</Text>
                {billShowItems && (
                  <>
                    <Text style={{
                      fontSize: billPaperWidth === '58' ? 9 : 11,
                      marginVertical: 4,
                      fontFamily: 'Courier New',
                    }}>Domaine Rolet          $450</Text>
                  </>
                )}
                {billShowTotal && (
                  <>
                    <Text style={{
                      fontSize: billPaperWidth === '58' ? 9 : 11,
                      textAlign: 'right',
                      marginVertical: 2,
                      fontFamily: 'Courier New',
                    }}>Subtotal: $450</Text>
                    <Text style={{
                      fontSize: billPaperWidth === '58' ? 11 : 13,
                      fontWeight: 'bold',
                      textAlign: 'right',
                      marginVertical: 2,
                      fontFamily: 'Courier New',
                    }}>Total: $450</Text>
                  </>
                )}
                <Text style={{
                  fontSize: billPaperWidth === '58' ? 9 : 11,
                  textAlign: 'center',
                  marginVertical: 4,
                  fontFamily: 'Courier New',
                }}>{'='.repeat(billPaperWidth === '58' ? 40 : 50)}</Text>
                <Text style={{
                  fontSize: billPaperWidth === '58' ? 10 : 12,
                  fontWeight: '600',
                  textAlign: 'center',
                  marginVertical: 6,
                  fontFamily: 'Courier New',
                }}>Thank You</Text>
                <Text style={{
                  fontSize: billPaperWidth === '58' ? 8 : 10,
                  textAlign: 'center',
                  marginBottom: 2,
                  fontFamily: 'Courier New',
                }}>{billFooterMsg}</Text>
                <Text style={{
                  fontSize: billPaperWidth === '58' ? 8 : 10,
                  textAlign: 'center',
                  color: '#666',
                  fontFamily: 'Courier New',
                }}>Powered by Chuio</Text>
              </View>
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 20, marginBottom: 20 }} />
          </View>

          {/* Printer Configuration - Separate for each type */}
          <View style={{ marginHorizontal: 16 }}>
            <Text style={[styles.label, { fontSize: 14, fontWeight: '600', marginBottom: 12 }]}>🖨️ Printer Configuration</Text>
            
            {/* QR Code Printer */}
            <View style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#93c5fd', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937' }}>📋 QR Code Printer</Text>
              </View>
              {printerSettings?.qr_printer_type && (
                <>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
                    Type: {getPrinterTypeLabel(printerSettings.qr_printer_type)}
                  </Text>
                  {printerSettings.qr_bluetooth_device_name && (
                    <Text style={{ fontSize: 12, color: '#059669', marginBottom: 2 }}>
                      ✓ Device: {printerSettings.qr_bluetooth_device_name}
                    </Text>
                  )}
                  {printerSettings.qr_printer_host && (
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                      Host: {printerSettings.qr_printer_host}:{printerSettings.qr_printer_port}
                    </Text>
                  )}
                </>
              )}
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { paddingVertical: 8 }]}
                onPress={() => {
                  setEditingPrinterType('qr');
                  // Load current QR printer settings into form
                  const qrSettings: PrinterSettings = {
                    printer_type: printerSettings?.qr_printer_type || 'thermal',
                    printer_host: printerSettings?.qr_printer_host,
                    printer_port: printerSettings?.qr_printer_port,
                    bluetooth_device_id: printerSettings?.qr_bluetooth_device_id,
                    bluetooth_device_name: printerSettings?.qr_bluetooth_device_name,
                    qr_auto_print: printerSettings?.qr_auto_print,
                  };
                  setPrinterFormData(qrSettings);
                }}
              >
                <Text style={styles.btnText}>⚙️ Configure</Text>
              </TouchableOpacity>
            </View>

            {/* Bill Printer */}
            <View style={{ backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937' }}>🧾 Bill Printer</Text>
              </View>
              {printerSettings?.bill_printer_type && (
                <>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
                    Type: {getPrinterTypeLabel(printerSettings.bill_printer_type)}
                  </Text>
                  {printerSettings.bill_bluetooth_device_name && (
                    <Text style={{ fontSize: 12, color: '#059669', marginBottom: 2 }}>
                      ✓ Device: {printerSettings.bill_bluetooth_device_name}
                    </Text>
                  )}
                  {printerSettings.bill_printer_host && (
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                      Host: {printerSettings.bill_printer_host}:{printerSettings.bill_printer_port}
                    </Text>
                  )}
                </>
              )}
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { paddingVertical: 8 }]}
                onPress={() => {
                  setEditingPrinterType('bill');
                  // Load current Bill printer settings into form
                  const billSettings: PrinterSettings = {
                    printer_type: printerSettings?.bill_printer_type || 'thermal',
                    printer_host: printerSettings?.bill_printer_host,
                    printer_port: printerSettings?.bill_printer_port,
                    bluetooth_device_id: printerSettings?.bill_bluetooth_device_id,
                    bluetooth_device_name: printerSettings?.bill_bluetooth_device_name,
                    bill_auto_print: printerSettings?.bill_auto_print,
                  };
                  setPrinterFormData(billSettings);
                }}
              >
                <Text style={styles.btnText}>⚙️ Configure</Text>
              </TouchableOpacity>
            </View>

            {/* Kitchen Printer */}
            <View style={{ backgroundColor: '#fce7f3', borderWidth: 1, borderColor: '#fbcfe8', borderRadius: 8, padding: 14, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937' }}>🍳 Kitchen Order Printer</Text>
              </View>
              {printerSettings?.kitchen_printer_type && (
                <>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
                    Type: {getPrinterTypeLabel(printerSettings.kitchen_printer_type)}
                  </Text>
                  {printerSettings.kitchen_bluetooth_device_name && (
                    <Text style={{ fontSize: 12, color: '#059669', marginBottom: 2 }}>
                      ✓ Device: {printerSettings.kitchen_bluetooth_device_name}
                    </Text>
                  )}
                  {printerSettings.kitchen_printer_host && (
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                      Host: {printerSettings.kitchen_printer_host}:{printerSettings.kitchen_printer_port}
                    </Text>
                  )}
                </>
              )}
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { paddingVertical: 8 }]}
                onPress={() => {
                  setEditingPrinterType('kitchen');
                  // Load current Kitchen printer settings into form
                  const kitchenSettings: PrinterSettings = {
                    printer_type: printerSettings?.kitchen_printer_type || 'thermal',
                    printer_host: printerSettings?.kitchen_printer_host,
                    printer_port: printerSettings?.kitchen_printer_port,
                    bluetooth_device_id: printerSettings?.kitchen_bluetooth_device_id,
                    bluetooth_device_name: printerSettings?.kitchen_bluetooth_device_name,
                    kitchen_auto_print: printerSettings?.kitchen_auto_print,
                  };
                  setPrinterFormData(kitchenSettings);
                }}
              >
                <Text style={styles.btnText}>⚙️ Configure</Text>
              </TouchableOpacity>
            </View>

            {/* Back Button */}
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary, { paddingVertical: 10 }]}
              onPress={() => setShowingPrinterSettingsPage(false)}
            >
              <Text style={styles.btnText}>← Back</Text>
            </TouchableOpacity>
          </View>

          {/* Save Button for QR Format Settings */}
          <View style={{marginHorizontal: 16, marginBottom: 20}}>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={saveQRFormatSettings}
            >
              <Text style={styles.btnText}>✓ Save QR Format</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
      {bluetoothModal}
    </>
  );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Restaurant Information */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🏪 Restaurant Information</Text>
          {!editMode && (
            <TouchableOpacity
              onPress={() => {
                setFormData(settings);
                setEditMode(true);
              }}
            >
              <Text style={styles.editBtn}>✎ Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {editMode && formData ? (
          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Restaurant Name</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Enter restaurant name"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.input, { minHeight: 80 }]}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                placeholder="Enter address"
                multiline
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Timezone</Text>
              <TextInput
                style={styles.input}
                value={formData.timezone}
                onChangeText={(text) => setFormData({ ...formData, timezone: text })}
                placeholder="e.g., UTC, EST, PST"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Preferred Language</Text>
              <TextInput
                style={styles.input}
                value={formData.language_preference}
                onChangeText={(text) => setFormData({ ...formData, language_preference: text })}
                placeholder="e.g., en, es, fr"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Service Charge (%)</Text>
              <TextInput
                style={styles.input}
                value={formData.service_charge_percent?.toString() || '0'}
                onChangeText={(text) =>
                  setFormData({ ...formData, service_charge_percent: parseFloat(text) || 0 })
                }
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Logo URL</Text>
              <TextInput
                style={styles.input}
                value={formData.logo_url || ''}
                onChangeText={(text) => setFormData({ ...formData, logo_url: text })}
                placeholder="https://..."
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Background URL</Text>
              <TextInput
                style={styles.input}
                value={formData.background_url || ''}
                onChangeText={(text) => setFormData({ ...formData, background_url: text })}
                placeholder="https://..."
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Booking Time Allowance (minutes)</Text>
              <TextInput
                style={styles.input}
                value={formData.booking_time_allowance_mins?.toString() || '30'}
                onChangeText={(text) =>
                  setFormData({ ...formData, booking_time_allowance_mins: parseInt(text) || 30 })
                }
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => {
                  setEditMode(false);
                  setFormData(settings);
                }}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={saveSettings}>
                <Text style={styles.btnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : settings ? (
          <>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{settings.name}</Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{settings.phone || '—'}</Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Address</Text>
              <Text style={styles.value}>{settings.address || '—'}</Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Timezone</Text>
              <Text style={styles.value}>{settings.timezone || 'UTC'}</Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Preferred Language</Text>
              <Text style={styles.value}>{settings.language_preference || '—'}</Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Service Charge</Text>
              <Text style={styles.value}>{settings.service_charge_percent || 0} %</Text>
            </View>
            {settings.logo_url && (
              <View style={styles.settingItem}>
                <Text style={styles.label}>Logo</Text>
                <Text style={styles.value}>✓ Uploaded</Text>
              </View>
            )}
            {settings.background_url && (
              <View style={styles.settingItem}>
                <Text style={styles.label}>Background</Text>
                <Text style={styles.value}>✓ Uploaded</Text>
              </View>
            )}
          </>
        ) : null}
      </View>

      {/* Printer Settings */}
      <View style={styles.section}>
        <TouchableOpacity
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 }}
          onPress={() => setShowingPrinterSettingsPage(true)}
        >
          <Text style={styles.sectionTitle}>🖨️ Printer Settings</Text>
          <Text style={{ fontSize: 18, color: '#6b7280' }}>→</Text>
        </TouchableOpacity>

        {printerSettings && !showingPrinterSettingsPage ? (
          <>
            {/* Quick preview of printer settings */}
            <View style={[styles.settingItem, { borderBottomWidth: 0, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#f9fafb', borderRadius: 8, marginBottom: 12 }]}>
              <Text style={styles.label}>Configured Printers</Text>
              <Text style={styles.value}>QR Code, Bill, Kitchen Order</Text>
              <Text style={[styles.value, { fontSize: 11, color: '#6b7280', marginTop: 4 }]}>Tap header to manage</Text>
            </View>
          </>
        ) : null}
      </View>

      {/* Payment Terminal Card */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>💳 Payment Terminal</Text>
          <TouchableOpacity
            style={[styles.btn, styles.btnSmall, styles.btnPrimary]}
            onPress={() => {
              resetTerminalForm();
              setShowPaymentTerminalModal(true);
            }}
          >
            <Text style={styles.btnSmallText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {paymentTerminals.length > 0 ? (
          <FlatList
            data={paymentTerminals}
            renderItem={({ item: terminal }) => (
              <View style={[styles.terminalCard, terminal.is_active && styles.terminalCardActive]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.terminalVendor}>{terminal.vendor_name.toUpperCase()}</Text>
                    {terminal.is_active && (
                      <View style={{ backgroundColor: '#059669', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: 'white' }}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>ID: {terminal.app_id}</Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                    {terminal.terminal_ip}:{terminal.terminal_port}
                  </Text>
                  {terminal.last_tested_at && (
                    <Text style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>
                      ✓ Last tested: {new Date(terminal.last_tested_at).toLocaleDateString()}
                    </Text>
                  )}
                  {terminal.last_error_message && (
                    <Text style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
                      ⚠️ Error: {terminal.last_error_message}
                    </Text>
                  )}
                </View>
                <View style={{ marginLeft: 12, justifyContent: 'space-around' }}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnSmall, styles.btnPrimary]}
                    onPress={() => editPaymentTerminal(terminal)}
                  >
                    <Text style={styles.btnSmallText}>✎</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnSmall, { backgroundColor: '#ef4444' }, { marginTop: 4 }]}
                    onPress={() => deletePaymentTerminal(terminal.id)}
                  >
                    <Text style={styles.btnSmallText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
          />
        ) : (
          <Text style={styles.emptyText}>No payment terminals configured yet</Text>
        )}
      </View>

      {/* QR Code Settings */}
      {bluetoothModal}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📱 QR Code Settings</Text>
        {settings && (
          <>
            <View style={styles.settingItem}>
              <Text style={styles.label}>QR Mode</Text>
              <Text style={styles.value}>{settings.qr_mode || 'regenerate'}</Text>
            </View>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => setShowQRModal(true)}
            >
              <Text style={styles.btnText}>Change QR Mode</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Staff & Kitchen Login QR Codes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔑 Staff & Kitchen Login QR Codes</Text>
        <Text style={styles.sectionDescription}>
          Share these QR codes with your staff. Each staff member scans their unique QR code to login with their PIN.
        </Text>
        <View style={styles.qrCodeContainer}>
          <TouchableOpacity
            style={styles.qrCodeButton}
            onPress={() => setShowStaffQRModal(true)}
          >
            <Text style={styles.qrCodeButtonText}>👤 View Staff QR Code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.qrCodeButton, styles.kitchenQRButton]}
            onPress={() => setShowKitchenQRModal(true)}
          >
            <Text style={styles.qrCodeButtonText}>🍳 View Kitchen QR Code</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.qrCodeHint}>
          Tap the buttons above to view the QR codes and share them with your staff.
        </Text>
      </View>

      {/* Coupons */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🎟️ Coupons</Text>
          <TouchableOpacity
            style={[styles.btn, styles.btnSmall, styles.btnPrimary]}
            onPress={() => setShowCouponModal(true)}
          >
            <Text style={styles.btnSmallText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {coupons.length > 0 ? (
          <FlatList
            data={coupons}
            renderItem={({ item: coupon }) => (
              <View style={styles.couponCard}>
                <View>
                  <Text style={styles.couponCode}>{coupon.code}</Text>
                  <Text style={styles.couponValue}>
                    {coupon.discount_type === 'percentage'
                      ? `${coupon.discount_value}%`
                      : `$${coupon.discount_value}`}
                  </Text>
                  {coupon.description && (
                    <Text style={styles.couponDesc}>{coupon.description}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteCoupon(coupon.id)}
                >
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            )}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
          />
        ) : (
          <Text style={styles.emptyText}>No coupons yet</Text>
        )}
      </View>

      {/* Variant Presets */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🏷️ Variant Presets</Text>
          <TouchableOpacity
            style={[styles.btn, styles.btnSmall, styles.btnPrimary]}
            onPress={() => {
              // Show create preset dialog
              Alert.prompt(
                '➕ Create Variant Preset',
                'Enter variant title (e.g., "Drink Size", "Temperature")',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                  {
                    text: 'Create',
                    onPress: (name: string | undefined) => {
                      if (name) {
                        // For now, log the intent - API integration would go here
                        Alert.alert('Success', `Preset "${name}" created! You can now add options.`);
                      }
                    },
                  },
                ],
                'plain-text'
              );
            }}
          >
            <Text style={styles.btnSmallText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {variantPresets.length > 0 ? (
          <FlatList
            data={variantPresets}
            renderItem={({ item: preset }) => (
              <TouchableOpacity
                style={styles.presetCard}
                onPress={() => {
                  setSelectedVariantPreset(preset);
                }}
              >
                <View style={styles.presetCardHeader}>
                  <View>
                    <Text style={styles.presetName}>{preset.name}</Text>
                    {preset.description && (
                      <Text style={styles.presetDescription}>{preset.description}</Text>
                    )}
                  </View>
                  <View style={styles.variantBadge}>
                    <Text style={styles.variantBadgeText}>{preset.options_count || 0}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
          />
        ) : (
          <Text style={styles.emptyText}>No variant presets yet</Text>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Logout Button */}
      <TouchableOpacity
        style={[styles.btn, styles.btnDanger, { marginVertical: 12 }]}
        onPress={() => {
          Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Logout',
              onPress: () => navigation.navigate('Login'),
              style: 'destructive',
            },
          ]);
        }}
      >
        <Text style={styles.btnText}>🚪 Logout</Text>
      </TouchableOpacity>

      {/* Coupon Modal */}
      <Modal visible={showCouponModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Coupon</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Coupon Code</Text>
              <TextInput
                style={styles.input}
                value={couponForm.code}
                onChangeText={(text) =>
                  setCouponForm({ ...couponForm, code: text.toUpperCase() })
                }
                placeholder="e.g., SAVE10"
                maxLength={50}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Discount Type</Text>
              <View style={styles.toggleGroup}>
                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    couponForm.discount_type === 'percentage' && styles.typeBtnActive,
                  ]}
                  onPress={() => setCouponForm({ ...couponForm, discount_type: 'percentage' })}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      couponForm.discount_type === 'percentage' && styles.typeBtnTextActive,
                    ]}
                  >
                    Percentage
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    couponForm.discount_type === 'fixed' && styles.typeBtnActive,
                  ]}
                  onPress={() => setCouponForm({ ...couponForm, discount_type: 'fixed' })}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      couponForm.discount_type === 'fixed' && styles.typeBtnTextActive,
                    ]}
                  >
                    Fixed
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Discount Value</Text>
              <TextInput
                style={styles.input}
                value={couponForm.discount_value}
                onChangeText={(text) =>
                  setCouponForm({ ...couponForm, discount_value: text })
                }
                placeholder="Amount"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Min Order Value (optional)</Text>
              <TextInput
                style={styles.input}
                value={couponForm.min_order_value}
                onChangeText={(text) =>
                  setCouponForm({ ...couponForm, min_order_value: text })
                }
                placeholder="Minimum order amount"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                value={couponForm.description}
                onChangeText={(text) =>
                  setCouponForm({ ...couponForm, description: text })
                }
                placeholder="Coupon description"
                multiline
              />
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => {
                  setShowCouponModal(false);
                  setCouponForm({
                    code: '',
                    discount_type: 'percentage',
                    discount_value: '',
                    min_order_value: '',
                    description: '',
                  });
                }}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={createCoupon}
              >
                <Text style={styles.btnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Terminal Modal */}
      <Modal visible={showPaymentTerminalModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingTerminalId ? '✎ Edit Payment Terminal' : '➕ Add Payment Terminal'}
            </Text>

            {/* Vendor Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Payment Vendor</Text>
              <View>
                {(['kpay', 'other'] as const).map((vendor) => (
                  <TouchableOpacity
                    key={vendor}
                    style={{ paddingVertical: 8 }}
                    onPress={() => setTerminalForm({ ...terminalForm, vendor_name: vendor })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          borderWidth: 2,
                          borderColor: terminalForm.vendor_name === vendor ? '#3b82f6' : '#d1d5db',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        {terminalForm.vendor_name === vendor && (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' }} />
                        )}
                      </View>
                      <Text style={{ marginLeft: 10, fontSize: 14, color: '#1f2937', fontWeight: '500' }}>
                        {vendor === 'kpay' ? 'KPay' : 'Other'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* App ID */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>App ID / Terminal ID</Text>
              <TextInput
                style={styles.input}
                value={terminalForm.app_id}
                onChangeText={(text) => setTerminalForm({ ...terminalForm, app_id: text })}
                placeholder="Enter app ID"
              />
            </View>

            {/* App Secret */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>App Secret / Token</Text>
              <TextInput
                style={styles.input}
                value={terminalForm.app_secret}
                onChangeText={(text) => setTerminalForm({ ...terminalForm, app_secret: text })}
                placeholder="Enter app secret"
                secureTextEntry
              />
            </View>

            {/* Terminal IP */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Terminal IP Address</Text>
              <TextInput
                style={styles.input}
                value={terminalForm.terminal_ip}
                onChangeText={(text) => setTerminalForm({ ...terminalForm, terminal_ip: text })}
                placeholder="e.g., 192.168.50.210"
              />
            </View>

            {/* Terminal Port */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Terminal Port</Text>
              <TextInput
                style={styles.input}
                value={terminalForm.terminal_port}
                onChangeText={(text) => setTerminalForm({ ...terminalForm, terminal_port: text })}
                placeholder="e.g., 18080"
                keyboardType="number-pad"
              />
            </View>

            {/* Endpoint Path */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>API Endpoint Path</Text>
              <TextInput
                style={styles.input}
                value={terminalForm.endpoint_path}
                onChangeText={(text) => setTerminalForm({ ...terminalForm, endpoint_path: text })}
                placeholder="e.g., /v2/pos/sign"
              />
            </View>

            {/* Test Result */}
            {terminalTestResult && (
              <View style={[styles.formGroup, {
                borderRadius: 6,
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: terminalTestResult.success ? '#ecfdf5' : '#fef2f2',
                borderWidth: 1,
                borderColor: terminalTestResult.success ? '#86efac' : '#fecaca'
              }]}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: terminalTestResult.success ? '#059669' : '#dc2626',
                  marginBottom: 4
                }}>
                  {terminalTestResult.success ? '✓ Connection Successful' : '⚠️ Connection Failed'}
                </Text>
                <Text style={{ fontSize: 12, color: '#1f2937' }}>
                  {terminalTestResult.message}
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => {
                  setShowPaymentTerminalModal(false);
                  resetTerminalForm();
                }}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              
              {editingTerminalId && (
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: '#f59e0b' }]}
                  onPress={testPaymentTerminal}
                  disabled={testingTerminal}
                >
                  <Text style={styles.btnText}>{testingTerminal ? '⏳ Testing...' : '🧪 Test'}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={savePaymentTerminal}
              >
                <Text style={styles.btnText}>{editingTerminalId ? '✓ Update' : '✓ Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Mode Modal */}
      <Modal visible={showQRModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select QR Mode</Text>

            {(['regenerate', 'static_table', 'static_seat'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.option, settings?.qr_mode === mode && styles.optionActive]}
                onPress={async () => {
                  try {
                    await apiClient.patch(`/api/restaurants/${restaurantId}/settings`, {
                      qr_mode: mode,
                    });
                    setSettings({ ...settings!, qr_mode: mode });
                    setShowQRModal(false);
                    Alert.alert('Success', 'QR mode updated!');
                  } catch {
                    Alert.alert('Error', 'Failed to update QR mode');
                  }
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    settings?.qr_mode === mode && styles.optionTextActive,
                  ]}
                >
                  {mode === 'regenerate'
                    ? 'Regenerate (Per Order)'
                    : mode === 'static_table'
                      ? 'Static (Per Table)'
                      : 'Static (Per Seat)'}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary, { marginTop: 12 }]}
              onPress={() => setShowQRModal(false)}
            >
              <Text style={styles.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Staff QR Code Modal */}
      <Modal visible={showStaffQRModal} transparent animationType="slide">
        <View style={styles.qrModalOverlay}>
          <View style={styles.qrModalContent}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>Staff Login QR Code</Text>
              <TouchableOpacity onPress={() => setShowStaffQRModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.qrModalBody}>
              <Text style={styles.qrModalDescription}>
                Table staff can scan this QR code to access the staff login. Share this code with your table staff members.
              </Text>

              <View style={styles.qrCodeWrapper}>
                <QRCode
                  value={generateStaffQRUrl()}
                  size={200}
                  color="#2C3E50"
                  backgroundColor="#fff"
                />
              </View>

              <Text style={styles.qrModalUrl}>{generateStaffQRUrl()}</Text>

              <View style={styles.qrActionButtons}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => shareQRCode('staff')}
                >
                  <Text style={styles.btnText}>📤 Share QR Code</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => setShowStaffQRModal(false)}
            >
              <Text style={styles.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Kitchen QR Code Modal */}
      <Modal visible={showKitchenQRModal} transparent animationType="slide">
        <View style={styles.qrModalOverlay}>
          <View style={styles.qrModalContent}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>Kitchen Login QR Code</Text>
              <TouchableOpacity onPress={() => setShowKitchenQRModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.qrModalBody}>
              <Text style={styles.qrModalDescription}>
                Kitchen staff can scan this QR code to access the kitchen dashboard. Share this code with your kitchen staff members.
              </Text>

              <View style={styles.qrCodeWrapper}>
                <QRCode
                  value={generateKitchenQRUrl()}
                  size={200}
                  color="#2C3E50"
                  backgroundColor="#fff"
                />
              </View>

              <Text style={styles.qrModalUrl}>{generateKitchenQRUrl()}</Text>

              <View style={styles.qrActionButtons}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => shareQRCode('kitchen')}
                >
                  <Text style={styles.btnText}>📤 Share QR Code</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => setShowKitchenQRModal(false)}
            >
              <Text style={styles.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Variant Presets Modal */}
      <Modal visible={showVariantPresetsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🏷️ Variant Presets</Text>
              <TouchableOpacity onPress={() => setShowVariantPresetsModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedVariantPreset ? (
              <>
                <ScrollView style={styles.presetDetailScroll}>
                  <View style={styles.modalBody}>
                    <Text style={styles.presetDetailTitle}>{selectedVariantPreset.name}</Text>
                    {selectedVariantPreset.description && (
                      <Text style={styles.presetDetailDesc}>{selectedVariantPreset.description}</Text>
                    )}

                    <TouchableOpacity
                      style={[styles.btn, styles.btnPrimary, { marginBottom: 16 }]}
                      onPress={() => {
                        // Show create option dialog
                        Alert.prompt(
                          '➕ Add New Option',
                          'Enter option name (e.g., "Small", "Medium", "Large")',
                          [
                            {
                              text: 'Cancel',
                              style: 'cancel',
                            },
                            {
                              text: 'Add',
                              onPress: (name: string | undefined) => {
                                if (name) {
                                  Alert.alert('Success', `Option "${name}" added to "${selectedVariantPreset.name}"`);
                                }
                              },
                            },
                          ],
                          'plain-text'
                        );
                      }}
                    >
                      <Text style={styles.btnText}>+ Add Option</Text>
                    </TouchableOpacity>

                    <Text style={styles.variantsLabel}>Options in "{selectedVariantPreset.name}":</Text>
                    {selectedVariantPreset.variants && selectedVariantPreset.variants.length > 0 ? (
                      selectedVariantPreset.variants.map((option, idx) => (
                        <View key={idx} style={styles.variantDetailItem}>
                          <View style={styles.variantDetailContent}>
                            <Text style={styles.variantDetailName}>{option.name}</Text>
                            {option.price_cents && option.price_cents > 0 && (
                              <Text style={styles.variantDetailMeta}>
                                +${(option.price_cents / 100).toFixed(2)}
                              </Text>
                            )}
                          </View>
                          <View style={{ flexDirection: 'row', gap: 6, marginLeft: 10 }}>
                            <TouchableOpacity
                              style={[styles.btn, styles.btnSmall, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}
                              onPress={() => Alert.alert('Edit', `Edit option: ${option.name}`)}
                            >
                              <Text style={[styles.btnSmallText, { color: '#1e40af' }]}>✏️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.btn, styles.btnSmall, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]}
                              onPress={() =>
                                Alert.alert(
                                  'Delete',
                                  `Delete option "${option.name}"?`,
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Delete', style: 'destructive', onPress: () => {} },
                                  ]
                                )
                              }
                            >
                              <Text style={[styles.btnSmallText, { color: '#991b1b' }]}>🗑️</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No options yet. Click "Add Option" to add one.</Text>
                    )}
                  </View>
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnSecondary]}
                    onPress={() => setSelectedVariantPreset(null)}
                  >
                    <Text style={styles.btnText}>Back</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <ScrollView style={styles.presetsListScroll}>
                  <View style={styles.modalBody}>
                    {variantPresets.length > 0 ? (
                      variantPresets.map((preset) => (
                        <TouchableOpacity
                          key={preset.id}
                          style={styles.presetListItem}
                          onPress={() => setSelectedVariantPreset(preset)}
                        >
                          <View>
                            <Text style={styles.presetListName}>{preset.name}</Text>
                            {preset.description && (
                              <Text style={styles.presetListDesc}>{preset.description}</Text>
                            )}
                          </View>
                          <View style={styles.presetListBadge}>
                            <Text style={styles.presetListBadgeText}>{preset.variants_count}</Text>
                          </View>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>📋 No variant presets created yet</Text>
                    )}
                  </View>
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnSecondary]}
                    onPress={() => setShowVariantPresetsModal(false)}
                  >
                    <Text style={styles.btnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  printerPageTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  backButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  editBtn: {
    color: '#3b82f6',
    fontWeight: '600',
    fontSize: 13,
  },
  settingItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 10,
  },
  label: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  form: {
    gap: 12,
  },
  formGroup: {
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
  },
  displayValue: {
    fontSize: 13,
    color: '#2C3E50',
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    overflow: 'hidden',
  },
  printerTypeButtons: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  typeButton: {
    flex: 0.45,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  typeButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
  },
  typeButtonText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 12,
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
  toggleGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  formActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnSmall: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  btnPrimary: {
    backgroundColor: '#3b82f6',
    flex: 1,
  },
  btnSecondary: {
    backgroundColor: '#e5e7eb',
    flex: 1,
  },
  btnDanger: {
    backgroundColor: '#dc2626',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  btnSmallText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  qrCodeContainer: {
    flexDirection: 'column',
    gap: 12,
    marginVertical: 12,
  },
  qrCodeButton: {
    backgroundColor: '#2C3E50',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kitchenQRButton: {
    backgroundColor: '#2C3E50',
  },
  qrCodeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  qrCodeHint: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  couponCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  couponCode: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  couponValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 4,
  },
  couponDesc: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  deleteBtn: {
    padding: 8,
  },
  deleteBtnText: {
    fontSize: 16,
  },
  emptyText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 16,
  },
  terminalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#f3f4f6',
    padding: 14,
    marginBottom: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  terminalCardActive: {
    borderLeftColor: '#059669',
    backgroundColor: '#f0fdf4',
  },
  terminalVendor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  presetCard: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
    elevation: 1,
  },
  presetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  presetName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  presetDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  variantBadge: {
    backgroundColor: '#dbeafe',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    minWidth: 35,
    alignItems: 'center',
  },
  variantBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
  },
  presetListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  presetListName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  presetListDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  presetListBadge: {
    backgroundColor: '#dbeafe',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  presetListBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
  },
  presetDetailScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  presetsListScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  presetDetailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  presetDetailDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 16,
  },
  variantsLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  variantDetailItem: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
  },
  variantDetailContent: {
    flex: 1,
  },
  variantDetailName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  requiredBadge: {
    color: '#dc2626',
    fontWeight: '900',
  },
  variantDetailMeta: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  variantDetailFrom: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  variantDetailRequired: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '600',
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: '#fee',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  errorText: {
    color: '#c33',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 24,
    flex: 1,
    maxHeight: '95%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 0,
    color: '#1f2937',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 12,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  closeButton: {
    fontSize: 24,
    color: '#6b7280',
    fontWeight: '300',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  typeBtnActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
  },
  typeBtnText: {
    color: '#6b7280',
    fontWeight: '500',
    fontSize: 13,
  },
  typeBtnTextActive: {
    color: '#fff',
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  optionActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  optionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#3b82f6',
  },
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingTop: 50,
  },
  qrModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 'auto',
    maxHeight: '90%',
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  qrModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  qrModalBody: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrModalDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  qrCodeWrapper: {
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrModalUrl: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Courier New',
  },
  qrActionButtons: {
    width: '100%',
  },
  printerListContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  printerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  printerItemContent: {
    flex: 1,
  },
  printerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  printerIP: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontFamily: 'Courier New',
  },
  selectArrow: {
    fontSize: 20,
    color: '#3b82f6',
    marginLeft: 16,
  },
  connectedDeviceBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
